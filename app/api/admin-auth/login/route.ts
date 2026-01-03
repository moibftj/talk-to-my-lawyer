import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminCredentials, createAdminSession, type AdminSubRole } from '@/lib/auth/admin-session'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

/**
 * Admin login endpoint - Role-based authentication with sub-role routing
 *
 * No shared secret required. Each admin uses their own credentials.
 * Access is determined by:
 * 1. `role = 'admin'` in the profiles table
 * 2. `admin_sub_role` determines which portal they access:
 *    - 'super_admin' → /secure-admin-gateway (full access)
 *    - 'attorney_admin' → /attorney-portal (review only)
 *
 * Security benefits:
 * - Individual accountability (each admin has unique credentials)
 * - No shared secret to leak or rotate
 * - Easy deactivation (just change the user's role)
 * - Full audit trail of which admin performed each action
 * - Separation of duties between system and attorney admins
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, "15 m")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Verify credentials and check admin role (returns subRole)
    const result = await verifyAdminCredentials(email, password)

    if (!result.success) {
      // Log failed login attempt for security monitoring
      console.warn('[AdminAuth] Failed login attempt:', {
        email,
        timestamp: new Date().toISOString(),
        error: result.error
      })

      return NextResponse.json(
        { error: result.error || 'Authentication failed' },
        { status: 401 }
      )
    }

    // Create admin session with sub-role
    const subRole: AdminSubRole = result.subRole || 'super_admin'
    await createAdminSession(result.userId!, email, subRole)

    // Determine redirect URL based on sub-role
    const redirectUrl = subRole === 'attorney_admin'
      ? '/attorney-portal/review'
      : '/secure-admin-gateway/dashboard'

    return NextResponse.json({
      success: true,
      message: 'Admin authentication successful',
      redirectUrl,
      subRole
    })

  } catch (error) {
    console.error('[AdminAuth] Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
