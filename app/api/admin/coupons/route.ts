import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdminAuth } from '@/lib/auth/admin-session'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 30, '1 m')
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const authError = await requireSuperAdminAuth()
    if (authError) return authError

    const supabase = await createClient()

    // Fetch all employee coupons with usage and commission data
    const { data: coupons, error: couponsError } = await supabase
      .from('employee_coupons')
      .select(`
        id,
        code,
        discount_percent,
        is_active,
        usage_count,
        created_at,
        employee_id,
        profiles!employee_id (
          full_name,
          email
        )
      `)
      .order('usage_count', { ascending: false })

    if (couponsError) {
      console.error('[CouponAnalytics] Error fetching coupons:', couponsError)
      return NextResponse.json(
        { error: 'Failed to fetch coupon data' },
        { status: 500 }
      )
    }

    // Calculate commission totals per employee
    const { data: commissions, error: commissionsError } = await supabase
      .from('commissions')
      .select('employee_id, commission_amount, status')

    if (commissionsError) {
      console.error('[CouponAnalytics] Error fetching commissions:', commissionsError)
    }

    // Calculate discount totals from subscriptions
    const { data: subscriptionsWithDiscount, error: subsError } = await supabase
      .from('subscriptions')
      .select('employee_id, discount, coupon_code')
      .not('employee_id', 'is', null)

    if (subsError) {
      console.error('[CouponAnalytics] Error fetching subscriptions:', subsError)
    }

    // Build commission totals by employee
    const commissionsByEmployee: Record<string, { total: number; paid: number }> = {}
    commissions?.forEach(c => {
      if (!c.employee_id) return
      if (!commissionsByEmployee[c.employee_id]) {
        commissionsByEmployee[c.employee_id] = { total: 0, paid: 0 }
      }
      const entry = commissionsByEmployee[c.employee_id]
      if (entry) {
        entry.total += Number(c.commission_amount || 0)
        if (c.status === 'paid') {
          entry.paid += Number(c.commission_amount || 0)
        }
      }
    })

    // Build discount totals by employee
    const discountsByEmployee: Record<string, number> = {}
    subscriptionsWithDiscount?.forEach(s => {
      if (s.employee_id) {
        if (!discountsByEmployee[s.employee_id]) {
          discountsByEmployee[s.employee_id] = 0
        }
        const current = discountsByEmployee[s.employee_id]
        if (current !== undefined) {
          discountsByEmployee[s.employee_id] = current + Number(s.discount || 0)
        }
      }
    })

    // Enrich coupon data
    const enrichedCoupons = coupons?.map(coupon => {
      const employeeCommissions = commissionsByEmployee[coupon.employee_id] || { total: 0, paid: 0 }
      const employeeDiscounts = discountsByEmployee[coupon.employee_id] || 0

      return {
        id: coupon.id,
        code: coupon.code,
        employee_name: (coupon.profiles as any)?.full_name || 'Unknown',
        employee_email: (coupon.profiles as any)?.email || '',
        discount_percent: coupon.discount_percent,
        is_active: coupon.is_active,
        usage_count: coupon.usage_count || 0,
        total_discount_given: employeeDiscounts,
        total_commissions_earned: employeeCommissions.total,
        created_at: coupon.created_at
      }
    }) || []

    // Calculate summary stats
    const summary = {
      total_coupons: enrichedCoupons.length,
      active_coupons: enrichedCoupons.filter(c => c.is_active).length,
      total_uses: enrichedCoupons.reduce((sum, c) => sum + c.usage_count, 0),
      total_discount_given: enrichedCoupons.reduce((sum, c) => sum + c.total_discount_given, 0),
      total_commissions_paid: Object.values(commissionsByEmployee).reduce((sum, c) => sum + c.paid, 0),
      avg_discount_per_use: enrichedCoupons.reduce((sum, c) => sum + c.usage_count, 0) > 0
        ? enrichedCoupons.reduce((sum, c) => sum + c.total_discount_given, 0) / enrichedCoupons.reduce((sum, c) => sum + c.usage_count, 0)
        : 0
    }

    // Top performers (top 10 by usage)
    const topPerformers = [...enrichedCoupons]
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      data: {
        summary,
        coupons: enrichedCoupons,
        top_performers: topPerformers
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('[CouponAnalytics] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch coupon analytics' },
      { status: 500 }
    )
  }
}
