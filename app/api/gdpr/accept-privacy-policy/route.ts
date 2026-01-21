import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

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
    // Apply rate limiting - 10 requests per minute per IP
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, 10, "1 m")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    const { data, error } = await supabase.rpc('record_privacy_acceptance', {
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

    return NextResponse.json({
      success: true,
      acceptanceId: data,
      policyVersion,
    })
  } catch (error: any) {
    console.error('[AcceptPrivacyPolicy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to record privacy policy acceptance', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gdpr/accept-privacy-policy
 *
 * Checks if user has accepted the current privacy policy
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const requiredVersion = searchParams.get('version') || '1.0'

    // Check if user has accepted the policy
    const { data: hasAccepted, error } = await supabase.rpc('has_accepted_privacy_policy', {
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

    return NextResponse.json({
      hasAccepted: hasAccepted || false,
      requiredVersion,
      acceptances: acceptances || [],
    })
  } catch (error: any) {
    console.error('[CheckPrivacyPolicy] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check privacy policy acceptance', message: error.message },
      { status: 500 }
    )
  }
}
