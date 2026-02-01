/**
 * GDPR Account Deletion API
 *
 * POST: Creates a request to delete user account (GDPR Article 17 - Right to Erasure)
 * GET: Get deletion request status for the current user
 * DELETE: Admin endpoint to approve and execute account deletion
 */
import { NextRequest } from 'next/server'
import { safeApplyRateLimit, apiRateLimit } from '@/lib/rate-limit-redis'
import { requireSuperAdminAuth, getAdminSession } from '@/lib/auth/admin-session'
import { getRateLimitTuple } from '@/lib/config'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { db } from '@/lib/db/client-factory'

/**
 * POST /api/gdpr/delete-account
 *
 * Creates a request to delete user account and all associated data
 * (GDPR Article 17 - Right to Erasure / Right to be Forgotten)
 *
 * Body:
 * - reason: string (optional) - Why the user wants to delete their account
 * - confirmEmail: string (required) - User must confirm by typing their email
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, ...getRateLimitTuple('GDPR_DELETE'))
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
    const { reason, confirmEmail } = body

    // Get user profile to verify email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    // Verify email confirmation
    if (!confirmEmail || confirmEmail.toLowerCase() !== profile?.email?.toLowerCase()) {
      return errorResponses.validation('Email confirmation does not match your account email', [
        { field: 'confirmEmail', message: 'Please type your email address exactly as it appears on your account' }
      ])
    }

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Check for existing pending deletion request
    const { data: existingRequest } = await supabase
      .from('data_deletion_requests')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])
      .maybeSingle()

    if (existingRequest) {
      return errorResponses.rateLimited('You already have a pending deletion request')
    }

    // Create deletion request
    const { data: deletionRequest, error: insertError } = await supabase
      .from('data_deletion_requests')
      .insert({
        user_id: user.id,
        status: 'pending',
        reason: reason || 'User requested account deletion',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[DeleteAccount] Failed to create request:', insertError)
      throw insertError
    }

    // Log the deletion request
    await supabase.rpc('log_data_access', {
      p_user_id: user.id,
      p_accessed_by: user.id,
      p_access_type: 'delete',
      p_resource_type: 'account',
      p_resource_id: user.id,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_details: JSON.stringify({ deletion_request_id: deletionRequest.id }),
    })

    return successResponse({
      requestId: deletionRequest.id,
      status: 'pending',
      message: 'Your account deletion request has been submitted. An administrator will review it within 30 days. You will receive an email confirmation.',
    })
  } catch (error) {
    return handleApiError(error, 'DeleteAccount')
  }
}

/**
 * GET /api/gdpr/delete-account
 *
 * Get deletion request status for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await db.server()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    // Get all deletion requests for this user
    const { data: requests, error } = await supabase
      .from('data_deletion_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('[GetDeletionRequests] Error:', error)
      throw error
    }

    return successResponse({
      requests: requests || [],
    })
  } catch (error) {
    return handleApiError(error, 'GetDeletionRequests')
  }
}

/**
 * DELETE /api/gdpr/delete-account
 *
 * Admin endpoint to approve and execute account deletion
 * Requires super admin authentication via admin session
 */
export async function DELETE(request: NextRequest) {
  try {
    // Use proper admin session validation (includes CSRF, timeout, role verification)
    const authError = await requireSuperAdminAuth()
    if (authError) {
      return authError
    }

    // Get admin session for audit logging
    const adminSession = await getAdminSession()
    if (!adminSession) {
      return errorResponses.unauthorized('Admin session not found')
    }

    const body = await request.json()
    const { requestId, userId } = body

    if (!requestId || !userId) {
      return errorResponses.validation('Missing required fields', [
        { field: 'requestId', message: 'Request ID is required' },
        { field: 'userId', message: 'User ID is required' }
      ])
    }

    // Use service role for deletions
    const supabase = db.serviceRole()

    // Update deletion request to approved and completed
    await supabase
      .from('data_deletion_requests')
      .update({
        status: 'completed',
        approved_at: new Date().toISOString(),
        approved_by: adminSession.userId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    // Delete user data in proper order (respecting foreign key constraints)
    // Note: RLS and CASCADE will handle most deletions automatically

    // 1. Delete letters
    await supabase.from('letters').delete().eq('user_id', userId)

    // 2. Delete subscriptions
    await supabase.from('subscriptions').delete().eq('user_id', userId)

    // 3. Delete commissions
    await supabase.from('commissions').delete().eq('employee_id', userId)

    // 4. Delete employee coupons
    await supabase.from('employee_coupons').delete().eq('employee_id', userId)

    // 5. Delete profile
    await supabase.from('profiles').delete().eq('id', userId)

    // 6. Delete auth user (already using service role client)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error('[DeleteAccount] Failed to delete auth user:', deleteAuthError)
      throw deleteAuthError
    }

    return successResponse({
      message: 'Account and all associated data have been permanently deleted',
    })
  } catch (error) {
    return handleApiError(error, 'DeleteAccountAdmin')
  }
}
