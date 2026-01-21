import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { safeApplyRateLimit, apiRateLimit } from '@/lib/rate-limit-redis'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { requireSuperAdminAuth, getAdminSession } from '@/lib/auth/admin-session'

/**
 * POST /api/gdpr/delete-account
 *
 * Creates a request to delete user account and all associated data
 * (GDPR Article 17 - Right to Erasure / Right to be Forgotten)
 *
 * Body:
 * - reason: string (optional) - Why the user wants to delete their account
 * - confirmEmail: string (required) - User must confirm by typing their email
 *
 * Note: Deletion requests require admin approval for security and legal compliance.
 * Some data may be retained for legal/regulatory requirements (e.g., financial records).
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (10 requests per 15 minutes)
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 10, "15 m")
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
    const { reason, confirmEmail } = body

    // Get user profile to verify email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    // Verify email confirmation
    if (!confirmEmail || confirmEmail.toLowerCase() !== profile?.email?.toLowerCase()) {
      return NextResponse.json({
        error: 'Email confirmation does not match your account email',
      }, { status: 400 })
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
      return NextResponse.json({
        error: 'You already have a pending deletion request',
        existingRequest,
      }, { status: 429 })
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

    return NextResponse.json({
      success: true,
      requestId: deletionRequest.id,
      status: 'pending',
      message: 'Your account deletion request has been submitted. An administrator will review it within 30 days. You will receive an email confirmation.',
    })
  } catch (error: any) {
    console.error('[DeleteAccount] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create deletion request', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gdpr/delete-account
 *
 * Get deletion request status for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    return NextResponse.json({
      success: true,
      requests: requests || [],
    })
  } catch (error: any) {
    console.error('[GetDeletionRequests] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get deletion requests', message: error.message },
      { status: 500 }
    )
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
      return NextResponse.json({ error: 'Admin session not found' }, { status: 401 })
    }

    const body = await request.json()
    const { requestId, userId } = body

    if (!requestId || !userId) {
      return NextResponse.json({
        error: 'requestId and userId are required',
      }, { status: 400 })
    }

    // Use service role for deletions
    const supabase = getServiceRoleClient()

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

    return NextResponse.json({
      success: true,
      message: 'Account and all associated data have been permanently deleted',
    })
  } catch (error: any) {
    console.error('[DeleteAccount] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete account', message: error.message },
      { status: 500 }
    )
  }
}
