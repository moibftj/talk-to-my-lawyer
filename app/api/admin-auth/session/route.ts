import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, getJWTSecret } from '@/lib/security/jwt'

const ADMIN_SESSION_COOKIE = 'admin_session'
const SESSION_EXPIRY_MINUTES = 30

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const redirect = request.nextUrl.searchParams.get('redirect') || '/secure-admin-gateway/dashboard'

  if (!token) {
    return NextResponse.redirect(new URL('/secure-admin-gateway/login', request.url))
  }

  try {
    const secret = getJWTSecret()
    const sessionData = verifySessionToken(token, secret)

    if (!sessionData) {
      console.warn('[AdminAuth] Invalid token in session setup')
      return NextResponse.redirect(new URL('/secure-admin-gateway/login', request.url))
    }

    const response = NextResponse.redirect(new URL(redirect, request.url))

    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: SESSION_EXPIRY_MINUTES * 60,
      path: '/'
    })

    console.log('[AdminAuth] Session cookie set via redirect for:', sessionData.email)

    return response
  } catch (error) {
    console.error('[AdminAuth] Session setup error:', error)
    return NextResponse.redirect(new URL('/secure-admin-gateway/login', request.url))
  }
}
