/**
 * Password Update API
 *
 * Updates the authenticated user's password.
 * Used after clicking the password reset link from email.
 */
import { NextRequest } from 'next/server'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { db } from '@/lib/db/client-factory'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, ...getRateLimitTuple('AUTH_UPDATE_PASSWORD'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const { newPassword } = await request.json()

    if (!newPassword) {
      return errorResponses.validation('New password is required', [
        { field: 'newPassword', message: 'Password is required' }
      ])
    }

    if (newPassword.length < 6) {
      return errorResponses.validation('Password must be at least 6 characters long', [
        { field: 'newPassword', message: 'Password must be at least 6 characters' }
      ])
    }

    const supabase = await db.server()

    // For Supabase password reset, we don't need to manually handle tokens
    // The session will have the user context when they click the reset link
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[Update Password] No authenticated user:', userError)
      return errorResponses.badRequest('Invalid or expired reset link')
    }

    // Update the user's password
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      console.error('[Update Password] Error:', error)
      return errorResponses.badRequest('Failed to update password')
    }

    return successResponse({
      message: 'Password updated successfully'
    })
  } catch (error) {
    return handleApiError(error, 'UpdatePassword')
  }
}
