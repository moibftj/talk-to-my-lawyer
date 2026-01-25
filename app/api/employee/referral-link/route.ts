import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'

export const runtime = 'nodejs'

// GET - Get referral link for current employee
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, ...getRateLimitTuple('EMPLOYEE_READ'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an employee
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can access referral links' }, { status: 403 })
    }

    // Get existing coupon for this employee
    const { data: coupon, error: couponError } = await supabase
      .from('employee_coupons')
      .select('*')
      .eq('employee_id', user.id)
      .single()

    if (!coupon) {
      return NextResponse.json({
        success: true,
        data: {
          hasCoupon: false,
          message: 'No coupon code assigned yet. Please contact admin.'
        }
      })
    }

    // Generate referral link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://talk-to-my-lawyer.com'
    const referralLink = `${baseUrl}?ref=${coupon.code}`
    const signupLink = `${baseUrl}/auth/signup?coupon=${coupon.code}`

    return NextResponse.json({
      success: true,
      data: {
        hasCoupon: true,
        coupon: {
          code: coupon.code,
          discountPercent: coupon.discount_percent,
          usageCount: coupon.usage_count,
          isActive: coupon.is_active
        },
        links: {
          referral: referralLink,
          signup: signupLink,
          share: {
            twitter: `https://twitter.com/intent/tweet?text=Get%20${coupon.discount_percent}%25%20off%20professional%20legal%20letters%20with%20my%20code%20${coupon.code}!&url=${encodeURIComponent(referralLink)}`,
            linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(referralLink)}&title=Get%20${coupon.discount_percent}%25%20off%20legal%20letters`,
            whatsapp: `https://wa.me/?text=Get%20${coupon.discount_percent}%25%20off%20professional%20legal%20letters%20with%20code%20${coupon.code}%20${encodeURIComponent(referralLink)}`,
            email: `mailto:?subject=Get%20${coupon.discount_percent}%25%20off%20legal%20letters&body=Use%20my%20referral%20code%20${coupon.code}%20to%20get%20${coupon.discount_percent}%25%20off%20at%20${encodeURIComponent(referralLink)}`
          }
        }
      }
    })
  } catch (error: any) {
    console.error('[ReferralLink] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
