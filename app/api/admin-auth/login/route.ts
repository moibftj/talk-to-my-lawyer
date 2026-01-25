import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { verifyAdminCredentials, createAdminSession, type AdminSubRole } from '@/lib/auth/admin-session'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'

/**
 * Admin login endpoint - Role-based authentication with sub-role routing
 *
 * Three-factor authentication:
 * 1. ADMIN_PORTAL_KEY (shared secret environment variable)
 * 2. Individual admin email/password (Supabase Auth)
 * 3. `role = 'admin'` in the profiles table
 *
 * Access portal is determined by `admin_sub_role`:
 * - 'super_admin' → /secure-admin-gateway (full access)
 * - 'attorney_admin' → /attorney-portal (review only)
 *
 * Security benefits:
 * - Portal key prevents unauthorized access to admin endpoints
 * - Individual accountability (each admin has unique credentials)
 * - Full audit trail of which admin performed each action
 * - Separation of duties between system and attorney admins
 * - Easy deactivation (just change the user's role)
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, ...getRateLimitTuple('AUTH_LOGIN'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const body = await request.json()
    const { email, password, portalKey } = body

    if (!email || !password || !portalKey) {
      return NextResponse.json(
        { error: 'Email, password, and portal key are required' },
        { status: 400 }
      )
    }

    // Verify portal key (3rd factor authentication)
    const validPortalKey = process.env.ADMIN_PORTAL_KEY
    if (!validPortalKey) {
      console.error('[AdminAuth] ADMIN_PORTAL_KEY not configured')
      return NextResponse.json(
        { error: 'Admin portal not properly configured' },
        { status: 500 }
      )
    }

    // Use timing-safe comparison to prevent timing attacks
    const portalKeyBuffer = Buffer.from(portalKey)
    const validKeyBuffer = Buffer.from(validPortalKey)

    if (portalKeyBuffer.length !== validKeyBuffer.length ||
        !timingSafeEqual(portalKeyBuffer, validKeyBuffer)) {
      console.warn('[AdminAuth] Invalid portal key attempt:', {
        email,
        timestamp: new Date().toISOString()
      })
      return NextResponse.json(
        { error: 'Invalid portal key' },
        { status: 401 }
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
