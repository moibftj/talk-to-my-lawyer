/**
 * Privacy Policy Acceptance API
 *
 * POST: Records user's acceptance of the privacy policy
 * GET: Checks if user has accepted the current privacy policy
 */
import { NextRequest } from 'next/server'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { db } from '@/lib/db/client-factory'

/**
 * POST /api/gdpr/accept-privacy-policy
 *
 * Records user's acceptance of the privacy policy
 *
 * Body:
 * - policyVersion: string (default: '1.0')
 * - marketingConsent: boolean (optional)
 * - analyticsConsent: boolean (optional)
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, ...getRateLimitTuple('GDPR_ACCEPT_POLICY'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await db.server()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    const body = await request.json()
    const {
      policyVersion = '1.0',
      marketingConsent = false,
      analyticsConsent = false,
    } = body

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Record the acceptance
    const { data, error } = await (supabase as any).rpc('record_privacy_acceptance', {
      p_user_id: user.id,
      p_policy_version: policyVersion,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_marketing_consent: marketingConsent,
      p_analytics_consent: analyticsConsent,
    })

    if (error) {
      console.error('[AcceptPrivacyPolicy] Error:', error)
      throw error
    }

    return successResponse({
      acceptanceId: data,
      policyVersion,
    })
  } catch (error) {
    return handleApiError(error, 'AcceptPrivacyPolicy')
  }
}

/**
 * GET /api/gdpr/accept-privacy-policy
 *
 * Checks if user has accepted the current privacy policy
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await db.server()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    const searchParams = request.nextUrl.searchParams
    const requiredVersion = searchParams.get('version') || '1.0'

    // Check if user has accepted the policy
    const { data: hasAccepted, error } = await (supabase as any).rpc('has_accepted_privacy_policy', {
      p_user_id: user.id,
      p_required_version: requiredVersion,
    })

    if (error) {
      console.error('[CheckPrivacyPolicy] Error:', error)
      throw error
    }

    // Get all acceptances for this user
    const { data: acceptances } = await supabase
      .from('privacy_policy_acceptances')
      .select('*')
      .eq('user_id', user.id)
      .order('accepted_at', { ascending: false })

    return successResponse({
      hasAccepted: hasAccepted || false,
      requiredVersion,
      acceptances: acceptances || [],
    })
  } catch (error) {
    return handleApiError(error, 'CheckPrivacyPolicy')
  }
}
