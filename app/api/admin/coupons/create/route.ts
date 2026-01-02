import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { validateAdminAction } from '@/lib/admin/letter-actions'

export const runtime = 'nodejs'

interface CreateCouponRequest {
  code?: string // Optional - will generate if not provided
  discountPercent: number
  maxUses?: number // Optional - unlimited if not set
  expiresAt?: string // Optional - never expires if not set
  description?: string
}

function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed ambiguous characters
  let code = 'PROMO'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, '1 m')
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    const body: CreateCouponRequest = await request.json()
    const { code, discountPercent, maxUses, expiresAt, description } = body

    // Validate discount percent
    if (!discountPercent || discountPercent < 1 || discountPercent > 100) {
      return NextResponse.json(
        { error: 'discountPercent must be between 1 and 100' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Generate or validate coupon code
    let couponCode = code?.toUpperCase().trim() || generateCouponCode()

    // Check if code already exists
    const { data: existing } = await supabase
      .from('employee_coupons')
      .select('code')
      .eq('code', couponCode)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `Coupon code '${couponCode}' already exists` },
        { status: 409 }
      )
    }

    // Create the promo coupon (employee_id is NULL for promo codes)
    const { data: coupon, error: insertError } = await supabase
      .from('employee_coupons')
      .insert({
        employee_id: null, // NULL indicates this is a promo code, not employee coupon
        code: couponCode,
        discount_percent: discountPercent,
        is_active: true,
        usage_count: 0,
        max_uses: maxUses || null,
        expires_at: expiresAt || null,
        description: description || null
      })
      .select()
      .single()

    if (insertError) {
      console.error('[CreateCoupon] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create coupon', details: insertError.message },
        { status: 500 }
      )
    }

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      admin_id: (await supabase.auth.getUser()).data.user?.id || 'system',
      action: 'create_promo_coupon',
      resource_type: 'coupon',
      resource_id: coupon.id,
      changes: { code: couponCode, discountPercent, maxUses, expiresAt }
    })

    return NextResponse.json({
      success: true,
      message: `Promo coupon '${couponCode}' created successfully`,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_percent: coupon.discount_percent,
        max_uses: coupon.max_uses,
        expires_at: coupon.expires_at,
        is_active: coupon.is_active,
        created_at: coupon.created_at
      }
    })
  } catch (error: any) {
    console.error('[CreateCoupon] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create coupon', message: error.message },
      { status: 500 }
    )
  }
}

// Toggle coupon active status
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 20, '1 m')
    if (rateLimitResponse) return rateLimitResponse

    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    const { couponId, isActive } = await request.json()

    if (!couponId) {
      return NextResponse.json({ error: 'couponId is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('employee_coupons')
      .update({ is_active: isActive })
      .eq('id', couponId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Coupon ${isActive ? 'activated' : 'deactivated'} successfully`,
      coupon: data
    })
  } catch (error: any) {
    console.error('[ToggleCoupon] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
