import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createStripeClient } from '@/lib/stripe/client'
import { authenticateUser } from '@/lib/auth/authenticate-user'
import { subscriptionRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

function getStripeClient(): Stripe {
  const stripe = createStripeClient()

  if (!stripe) {
    throw new Error('Missing or invalid STRIPE_SECRET_KEY environment variable')
  }

  return stripe
}

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase service configuration')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, subscriptionRateLimit, 3, '1 h')
    if (rateLimitResponse) return rateLimitResponse

    const authResult = await authenticateUser()
    if (!authResult.authenticated || !authResult.user) {
      return authResult.errorResponse!
    }
    const user = authResult.user

    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const stripe = getStripeClient()
    const supabase = getSupabaseServiceClient()

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }

    if (session.client_reference_id && session.client_reference_id !== user.id) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 })
    }

    // Check if subscription already exists for this session
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_session_id', sessionId)
      .single()

    if (existingSub) {
      return NextResponse.json({
        success: true,
        subscriptionId: existingSub.id,
        message: 'Subscription already created',
      })
    }

    const metadata = session.metadata || {}
    const userId = user.id
    const planType = metadata.plan_type

    if (!metadata.user_id || metadata.user_id !== user.id) {
      return NextResponse.json({ error: 'Session metadata invalid for this user' }, { status: 403 })
    }

    if (!planType) {
      return NextResponse.json({ error: 'Missing session metadata' }, { status: 400 })
    }

    const letters = parseInt(metadata.letters ?? '0')
    const basePrice = parseFloat(metadata.base_price ?? '0')
    const discount = parseFloat(metadata.discount ?? '0')
    const finalPrice = parseFloat(metadata.final_price ?? '0')
    const couponCode = metadata.coupon_code || null
    const employeeId = metadata.employee_id || null

    // Create subscription in database
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan: planType,
        plan_type: planType,
        status: 'active',
        price: finalPrice,
        discount: discount,
        coupon_code: couponCode,
        remaining_letters: letters,
        credits_remaining: letters,
        last_reset_at: new Date().toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        stripe_session_id: sessionId,
      })
      .select()
      .single()

    if (subError) {
      console.error('Error creating subscription:', subError)
      throw subError
    }

    // Record coupon usage
    if (couponCode) {
      await supabase
        .from('coupon_usage')
        .insert({
          user_id: userId,
          coupon_code: couponCode,
          employee_id: employeeId,
          discount_percent: basePrice ? (discount / basePrice) * 100 : 0,
          amount_before: basePrice,
          amount_after: finalPrice,
        })
    }

    // Create commission for employee
    if (employeeId && subscription) {
      const commissionAmount = finalPrice * 0.05

      await supabase
        .from('commissions')
        .insert({
          employee_id: employeeId,
          subscription_id: subscription.id,
          subscription_amount: finalPrice,
          commission_rate: 0.05,
          commission_amount: commissionAmount,
          status: 'pending',
        })

      // Update coupon usage count
      const { data: currentCoupon } = await supabase
        .from('employee_coupons')
        .select('usage_count')
        .eq('code', couponCode)
        .single()

      await supabase
        .from('employee_coupons')
        .update({
          usage_count: (currentCoupon?.usage_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('code', couponCode)
    }

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      letters: letters,
      message: 'Subscription created successfully',
    })
  } catch (error) {
    console.error('[Verify Payment] Error:', error)
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 },
    )
  }
}
