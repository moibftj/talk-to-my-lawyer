import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { subscriptionRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { validateCouponWithFraudDetection } from '@/lib/fraud-detection/coupon-fraud'
import { authenticateUser } from '@/lib/auth/authenticate-user'
import { PLAN_CONFIG } from '@/lib/constants'
import { createStripeClient } from '@/lib/stripe/client'

const stripe = createStripeClient()

const TEST_MODE = process.env.ENABLE_TEST_MODE === 'true'

// Production guard: prevent test mode from being enabled in production
if (TEST_MODE && process.env.NODE_ENV === 'production') {
  throw new Error('[CRITICAL] Test mode is not allowed in production environment. Set ENABLE_TEST_MODE=false.')
}

export async function POST(request: NextRequest) {
  console.log('[Checkout] Request received, TEST_MODE:', TEST_MODE)

  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, subscriptionRateLimit, 3, "1 h")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Authenticate user
    const authResult = await authenticateUser()
    if (!authResult.authenticated || !authResult.user) {
      return authResult.errorResponse!
    }
    const user = authResult.user
    
    console.log('[Checkout] Auth check - user:', user.id)

    const supabase = await createClient()
    const body = await request.json()
    const { planType, couponCode } = body

    const selectedPlan = PLAN_CONFIG[planType]
    if (!selectedPlan) {
      return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 })
    }

    const basePrice = selectedPlan.price

    let discount = 0
    let employeeId = null
    let couponId = null

    if (couponCode) {
      // Special handling for TALK3 coupon (100% discount, no database lookup, no commission)
      if (couponCode.toUpperCase() === 'TALK3') {
        discount = 100
        employeeId = null // No commission for TALK3
        couponId = null
      } else {
        // Enhanced coupon validation with fraud detection
        console.log('[Checkout] Validating coupon with fraud detection:', couponCode)
        const couponValidation = await validateCouponWithFraudDetection(couponCode, request, user.id)

        if (!couponValidation.isValid) {
          console.error('[Checkout] Coupon validation failed:', {
            couponCode,
            error: couponValidation.error,
            fraudRisk: couponValidation.fraudResult?.riskScore
          })

          return NextResponse.json({
            error: couponValidation.error || 'Invalid coupon code',
            fraudDetection: couponValidation.fraudResult ? {
              riskScore: couponValidation.fraudResult.riskScore,
              action: couponValidation.fraudResult.action,
              reasons: couponValidation.fraudResult.reasons
            } : undefined
          }, { status: 400 })
        }

        // Log fraud detection results for monitoring
        if (couponValidation.fraudResult) {
          console.warn('[Checkout] Fraud detection result:', {
            couponCode,
            riskScore: couponValidation.fraudResult.riskScore,
            action: couponValidation.fraudResult.action,
            reasons: couponValidation.fraudResult.reasons
          })
        }

        // Check employee coupons in database (including special promo codes)
        const { data: coupon } = await supabase
          .from('employee_coupons')
          .select('*')
          .eq('code', couponCode)
          .eq('is_active', true)
          .single()

        if (coupon) {
          discount = coupon.discount_percent
          employeeId = coupon.employee_id
          couponId = coupon.id

          // Log coupon usage with fraud detection context
          await supabase
            .from('coupon_usage')
            .insert({
              user_id: user.id,
              coupon_code: couponCode,
              employee_id: employeeId,
              // subscription_id will be added after successful checkout
              discount_percent: discount,
              amount_before: basePrice,
              amount_after: (basePrice * (100 - discount)) / 100,
              ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
              user_agent: request.headers.get('user-agent') || 'unknown',
              fraud_risk_score: couponValidation.fraudResult?.riskScore || 0,
              fraud_detection_data: couponValidation.fraudResult || null,
              created_at: new Date().toISOString()
            })
            console.log('[Checkout] Coupon usage logged')
        }
      }
    }

    const discountAmount = (basePrice * discount) / 100
    const finalPrice = basePrice - discountAmount

    // Special handling for TALK3 coupon with test mode
    if (couponCode && couponCode.toUpperCase() === 'TALK3' && TEST_MODE) {
      console.log('[Checkout] TALK3 coupon in TEST MODE: Creating dummy subscription')

      // Create subscription directly as if payment succeeded
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan: planType,
          plan_type: planType,
          status: 'active',
          price: 0, // Free for TALK3
          discount: basePrice,
          coupon_code: 'TALK3',
          credits_remaining: selectedPlan.letters,
          remaining_letters: selectedPlan.letters,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()

      if (subError) {
        console.error('[Checkout] TALK3 TEST MODE: Subscription creation error:', subError)
        throw new Error(`Failed to create subscription: ${subError.message}`)
      }

      // Track coupon usage for TALK3 (but no commission)
      await supabase
        .from('coupon_usage')
        .insert({
          user_id: user.id,
          coupon_code: 'TALK3',
          employee_id: null,
          discount_percent: 100,
          amount_before: basePrice,
          amount_after: 0
        })

      console.log('[Checkout] TALK3 TEST MODE: Dummy subscription created successfully')

      return NextResponse.json({
        success: true,
        testMode: true,
        talk3Coupon: true,
        subscriptionId: subscription.id,
        letters: selectedPlan.letters,
        message: 'TALK3 TEST MODE: Free subscription created successfully',
        redirectUrl: `/dashboard/subscription?success=true&test=true&talk3=true`
      })
    }

    // If 100% discount (non-TALK3), create subscription atomically
    if (finalPrice === 0) {
      // Use atomic transaction function to create subscription with commission
      const { data: atomicResult, error: atomicError } = await supabase.rpc('create_free_subscription', {
        p_user_id: user.id,
        p_plan_type: planType,
        p_monthly_allowance: selectedPlan.letters,
        p_total_letters: selectedPlan.letters,
        p_final_price: finalPrice,
        p_base_price: basePrice,
        p_discount_amount: discountAmount,
        p_coupon_code: couponCode || null,
        p_employee_id: employeeId || null,
        p_commission_rate: 0.05,
      })

      if (atomicError || !atomicResult || !atomicResult[0]?.success) {
        console.error('[Checkout] Atomic subscription creation failed:', atomicError)
        throw new Error(`Failed to create subscription: ${atomicError?.message || atomicResult?.[0]?.error_message || 'Unknown error'}`)
      }

      const result = atomicResult[0]

      return NextResponse.json({
        success: true,
        subscriptionId: result.subscription_id,
        letters: selectedPlan.letters,
        message: 'Subscription created successfully'
      })
    }

    // ===== TEST MODE: Simulate successful payment without Stripe =====
    if (TEST_MODE) {
      console.log('[Checkout] TEST MODE: Simulating payment for user:', user.id)

      // Use atomic transaction function for test mode as well
      const { data: atomicResult, error: atomicError } = await supabase.rpc('create_free_subscription', {
        p_user_id: user.id,
        p_plan_type: planType,
        p_monthly_allowance: selectedPlan.letters,
        p_total_letters: selectedPlan.letters,
        p_final_price: finalPrice,
        p_base_price: basePrice,
        p_discount_amount: discountAmount,
        p_coupon_code: couponCode || null,
        p_employee_id: employeeId || null,
        p_commission_rate: 0.05,
      })

      if (atomicError || !atomicResult || !atomicResult[0]?.success) {
        console.error('[Checkout] TEST MODE: Atomic subscription creation failed:', atomicError)
        throw new Error(`Failed to create subscription: ${atomicError?.message || atomicResult?.[0]?.error_message || 'Unknown error'}`)
      }

      const result = atomicResult[0]

      console.log('[Checkout] TEST MODE: Payment simulated successfully')

      return NextResponse.json({
        success: true,
        testMode: true,
        subscriptionId: result.subscription_id,
        letters: selectedPlan.letters,
        message: 'TEST MODE: Subscription created successfully (simulated payment)',
        redirectUrl: `/dashboard/subscription?success=true&test=true`
      })
    }

    // ===== PRODUCTION MODE: Use Stripe for real payments =====
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.')
    }

    // Create subscription record as 'pending' before payment
    const { data: pendingSubscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan: planType,
        plan_type: planType,
        status: 'pending',
        price: finalPrice,
        discount: discountAmount,
        coupon_code: couponCode || null,
        credits_remaining: 0, // No credits until payment confirmed
        remaining_letters: 0,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single()

    if (subError) {
      console.error('[Checkout] Failed to create pending subscription:', subError)
      throw new Error(`Failed to create subscription: ${subError.message}`)
    }

    // Create Stripe Checkout Session for paid plans
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Use subscription ID as idempotency key to prevent duplicate checkout sessions on retries
    const idempotencyKey = `checkout_${pendingSubscription.id}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: selectedPlan.name,
              description: `${selectedPlan.letters} Legal ${selectedPlan.letters === 1 ? 'Letter' : 'Letters'}`,
            },
            unit_amount: Math.round(finalPrice * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/subscription?canceled=true`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        subscription_id: pendingSubscription.id,
        plan_type: planType,
        letters: selectedPlan.letters.toString(),
        base_price: basePrice.toString(),
        discount: discountAmount.toString(),
        final_price: finalPrice.toString(),
        coupon_code: couponCode || '',
        employee_id: employeeId || '',
        coupon_id: couponId || ''
      }
    }, {
      idempotencyKey, // Prevent duplicate charges on request retries
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url
    })

  } catch (error: any) {
    console.error('[Checkout] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create checkout',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}
