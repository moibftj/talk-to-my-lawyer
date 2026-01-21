import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getStripeClient } from '@/lib/stripe/client'
import { authenticateUser } from '@/lib/auth/authenticate-user'
import { subscriptionRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getServiceRoleClient } from '@/lib/supabase/admin'

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
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }
    const supabase = getServiceRoleClient()

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

    // Look for pending subscription to complete
    const { data: pendingSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!pendingSubscription) {
      // No pending subscription - check if already completed (race with webhook)
      const { data: activeSubscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_session_id', sessionId)
        .eq('status', 'active')
        .single()

      if (activeSubscription) {
        return NextResponse.json({
          success: true,
          subscriptionId: activeSubscription.id,
          letters: letters,
          message: 'Subscription already activated by webhook',
        })
      }

      console.error('[Verify Payment] No pending subscription found for user:', userId)
      return NextResponse.json({ error: 'No pending subscription found' }, { status: 400 })
    }

    // Use atomic transaction to complete subscription with commission
    // This prevents race conditions with the webhook
    const { data: atomicResult, error: atomicError } = await supabase.rpc('complete_subscription_with_commission', {
      p_user_id: userId,
      p_subscription_id: pendingSubscription.id,
      p_stripe_session_id: sessionId,
      p_stripe_customer_id: session.customer as string || null,
      p_plan_type: planType,
      p_monthly_allowance: letters,
      p_total_letters: letters,
      p_final_price: finalPrice,
      p_base_price: basePrice,
      p_discount_amount: discount,
      p_coupon_code: couponCode,
      p_employee_id: employeeId,
      p_commission_rate: 0.05,
    })

    if (atomicError) {
      // Check if it's a "subscription already active" error (webhook completed first)
      if (atomicError.message?.includes('already active') || atomicError.code === '23505') {
        const { data: completedSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('stripe_session_id', sessionId)
          .eq('status', 'active')
          .single()

        if (completedSub) {
          return NextResponse.json({
            success: true,
            subscriptionId: completedSub.id,
            letters: letters,
            message: 'Subscription already activated by webhook',
          })
        }
      }

      console.error('[Verify Payment] Atomic subscription completion failed:', atomicError)
      throw new Error(`Failed to complete subscription: ${atomicError.message}`)
    }

    if (!atomicResult || !atomicResult[0]?.success) {
      const errorMsg = atomicResult?.[0]?.error_message || 'Unknown error'
      console.error('[Verify Payment] Atomic subscription completion returned error:', errorMsg)
      throw new Error(`Failed to complete subscription: ${errorMsg}`)
    }

    const result = atomicResult[0]

    return NextResponse.json({
      success: true,
      subscriptionId: result.subscription_id,
      letters: letters,
      message: 'Subscription activated successfully',
    })
  } catch (error) {
    console.error('[Verify Payment] Error:', error)
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 },
    )
  }
}
