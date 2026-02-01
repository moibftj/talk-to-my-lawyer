/**
 * Employee Referral Link API
 *
 * Returns the employee's coupon code and referral links.
 * Restricted to employees only.
 */
import { NextRequest } from 'next/server'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { db } from '@/lib/db/client-factory'

export const runtime = 'nodejs'

// GET - Get referral link for current employee
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, ...getRateLimitTuple('EMPLOYEE_READ'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await db.server()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    // Verify user is an employee
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || (profile as any).role !== 'employee') {
      return errorResponses.forbidden('Only employees can access referral links')
    }

    // Get existing coupon for this employee
    const { data: coupon } = await supabase
      .from('employee_coupons')
      .select('*')
      .eq('employee_id', user.id)
      .single()

    if (!coupon) {
      return successResponse({
        hasCoupon: false,
        message: 'No coupon code assigned yet. Please contact admin.'
      })
    }

    // Generate referral link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://talk-to-my-lawyer.com'
    const referralLink = `${baseUrl}?ref=${(coupon as any).code}`
    const signupLink = `${baseUrl}/auth/signup?coupon=${(coupon as any).code}`

    return successResponse({
      hasCoupon: true,
      coupon: {
        code: (coupon as any).code,
        discountPercent: (coupon as any).discount_percent,
        usageCount: (coupon as any).usage_count,
        isActive: (coupon as any).is_active
      },
      links: {
        referral: referralLink,
        signup: signupLink,
        share: {
          twitter: `https://twitter.com/intent/tweet?text=Get%20${(coupon as any).discount_percent}%25%20off%20professional%20legal%20letters%20with%20my%20code%20${(coupon as any).code}!&url=${encodeURIComponent(referralLink)}`,
          linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(referralLink)}&title=Get%20${(coupon as any).discount_percent}%25%20off%20legal%20letters`,
          whatsapp: `https://wa.me/?text=Get%20${(coupon as any).discount_percent}%25%20off%20professional%20legal%20letters%20with%20code%20${(coupon as any).code}%20${encodeURIComponent(referralLink)}`,
          email: `mailto:?subject=Get%20${(coupon as any).discount_percent}%25%20off%20legal%20letters&body=Use%20my%20referral%20code%20${(coupon as any).code}%20to%20get%20${(coupon as any).discount_percent}%25%20off%20at%20${encodeURIComponent(referralLink)}`
        }
      }
    })
  } catch (error) {
    return handleApiError(error, 'ReferralLink')
  }
}
