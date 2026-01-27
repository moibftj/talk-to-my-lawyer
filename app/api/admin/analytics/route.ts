import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdminAuth } from '@/lib/auth/admin-session'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, ...getRateLimitTuple('ADMIN_READ'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const authError = await requireSuperAdminAuth()
    if (authError) return authError

    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const daysBack = parseInt(searchParams.get('days') || '30', 10)
    const monthsBack = parseInt(searchParams.get('months') || '12', 10)

    const rpc = supabase.rpc as any
    const [
      dashboardStats,
      letterStats,
      subscriptionAnalytics,
      revenueSummary
    ] = await Promise.all([
      rpc('get_admin_dashboard_stats'),
      rpc('get_letter_statistics', { days_back: daysBack }),
      rpc('get_subscription_analytics'),
      rpc('get_revenue_summary', { months_back: monthsBack })
    ])

    if (dashboardStats.error) {
      console.error('[Analytics] Dashboard stats error:', dashboardStats.error)
    }
    if (letterStats.error) {
      console.error('[Analytics] Letter stats error:', letterStats.error)
    }
    if (subscriptionAnalytics.error) {
      console.error('[Analytics] Subscription analytics error:', subscriptionAnalytics.error)
    }
    if (revenueSummary.error) {
      console.error('[Analytics] Revenue summary error:', revenueSummary.error)
    }

    const dashboard = dashboardStats.data?.[0] || {
      total_users: 0,
      total_subscribers: 0,
      total_employees: 0,
      pending_letters: 0,
      approved_letters_today: 0,
      total_revenue: 0,
      pending_commissions: 0
    }

    const letters = letterStats.data?.[0] || {
      total_letters: 0,
      pending_count: 0,
      approved_count: 0,
      rejected_count: 0,
      failed_count: 0,
      avg_review_time_hours: 0
    }

    const subscriptions = subscriptionAnalytics.data?.[0] || {
      active_subscriptions: 0,
      monthly_subscriptions: 0,
      yearly_subscriptions: 0,
      one_time_purchases: 0,
      total_credits_remaining: 0,
      avg_credits_per_user: 0
    }

    return NextResponse.json({
      success: true,
      data: {
        dashboard,
        letters,
        subscriptions,
        revenue: revenueSummary.data || []
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Analytics] Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}
