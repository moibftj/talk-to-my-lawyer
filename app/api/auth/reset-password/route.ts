import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { errorResponses, handleApiError, successResponse } from '@/lib/api/api-error-handler'
import { getRateLimitTuple } from '@/lib/config'
import { getAppUrl } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, ...getRateLimitTuple('AUTH_PASSWORD_RESET'))
    if (rateLimitResponse) return rateLimitResponse

    const { email } = await request.json()

    if (!email) {
      return errorResponses.validation('Email is required')
    }

    const supabase = await createClient()

    // Generate password reset token
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppUrl()}/auth/reset-password`,
    })

    if (error) {
      console.error('[Reset Password] Error:', error)
      // Don't reveal if email exists or not for security
      return errorResponses.validation(
        'If an account with this email exists, a password reset link has been sent.'
      )
    }

    return successResponse({
      message: 'If an account with this email exists, a password reset link has been sent.',
      success: true
    })

  } catch (error) {
    return handleApiError(error, 'Reset Password')
  }
}