import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { verifyAdminCredentials, type AdminSubRole } from '@/lib/auth/admin-session'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'
import { createSessionToken, getJWTSecret } from '@/lib/security/jwt'

const ADMIN_SESSION_COOKIE = 'admin_session'
const SESSION_EXPIRY_MINUTES = 30

export async function POST(request: NextRequest) {
  try {
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

    const validPortalKey = process.env.ADMIN_PORTAL_KEY
    if (!validPortalKey) {
      console.error('[AdminAuth] ADMIN_PORTAL_KEY not configured')
      return NextResponse.json(
        { error: 'Admin portal not properly configured' },
        { status: 500 }
      )
    }

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

    const result = await verifyAdminCredentials(email, password)

    if (!result.success) {
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

    const subRole: AdminSubRole = result.subRole || 'super_admin'

    const secret = getJWTSecret()
    const token = createSessionToken(
      result.userId!,
      email,
      subRole,
      SESSION_EXPIRY_MINUTES,
      secret
    )

    const redirectUrl = subRole === 'attorney_admin'
      ? '/attorney-portal/review'
      : '/secure-admin-gateway/dashboard'

    console.log('[AdminAuth] Admin authenticated, issuing token:', {
      userId: result.userId,
      email,
      subRole,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Admin authentication successful',
      redirectUrl,
      subRole,
      token
    })

  } catch (error) {
    console.error('[AdminAuth] Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
