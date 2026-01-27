import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'

export const runtime = 'nodejs'

// GET - Fetch billing/payment history for current user
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, ...getRateLimitTuple('BILLING_HISTORY'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all subscriptions (payment history)
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        plan_type,
        price,
        discount,
        coupon_code,
        status,
        credits_remaining,
        stripe_subscription_id,
        current_period_start,
        current_period_end,
        created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (subError) {
      console.error('[BillingHistory] Error:', subError)
      return NextResponse.json({ error: 'Failed to fetch billing history' }, { status: 500 })
    }

    // Calculate totals
    const totalSpent = subscriptions?.reduce((sum: number, sub: any) => {
      return sum + (Number(sub.price) - Number(sub.discount || 0))
    }, 0) || 0

    const totalDiscounts = subscriptions?.reduce((sum: number, sub: any) => {
      return sum + Number(sub.discount || 0)
    }, 0) || 0

    // Format billing history
    const billingHistory = subscriptions?.map((sub: any) => ({
      id: sub.id,
      date: sub.created_at,
      description: formatPlanType(sub.plan_type),
      amount: Number(sub.price),
      discount: Number(sub.discount || 0),
      netAmount: Number(sub.price) - Number(sub.discount || 0),
      couponCode: sub.coupon_code,
      status: sub.status,
      periodStart: sub.current_period_start,
      periodEnd: sub.current_period_end,
      stripeId: sub.stripe_subscription_id,
      creditsRemaining: sub.credits_remaining
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        history: billingHistory,
        summary: {
          totalTransactions: billingHistory.length,
          totalSpent,
          totalDiscounts,
          activeSubscription: billingHistory.find((h: any) => h.status === 'active') || null
        }
      }
    })
  } catch (error: any) {
    console.error('[BillingHistory] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function formatPlanType(planType: string): string {
  const planNames: Record<string, string> = {
    'monthly': 'Monthly Subscription',
    'yearly': 'Yearly Subscription',
    'one_time': 'One-Time Purchase',
    'starter': 'Starter Plan',
    'professional': 'Professional Plan',
    'enterprise': 'Enterprise Plan'
  }
  return planNames[planType] || planType?.replace(/_/g, ' ') || 'Subscription'
}
