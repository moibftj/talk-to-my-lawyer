import { NextRequest, NextResponse } from 'next/server'

/**
 * Verify CRON job authentication
 *
 * Supports three authentication methods:
 * 1. Authorization header with Bearer token
 * 2. Query parameter 'secret'
 * 3. x-cron-secret header (for edge compatibility)
 *
 * @param request - The incoming request
 * @returns NextResponse with 401 error if unauthorized, or null if authorized
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  // If no CRON_SECRET is configured, behavior depends on environment
  if (!cronSecret) {
    if (isProduction) {
      // In production, require CRON_SECRET for security
      console.error('[CronAuth] CRITICAL: CRON_SECRET not configured in production!')
      console.error('[CronAuth] Cron endpoints are exposed without authentication!')
      return NextResponse.json(
        { error: 'Server configuration error: CRON_SECRET not set' },
        { status: 500 }
      )
    }
    // In development, allow access with a warning
    console.warn('[CronAuth] No CRON_SECRET configured - allowing access (development mode)')
    return null
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) {
    return null
  }

  // Check x-cron-secret header (for edge compatibility)
  const cronSecretHeader = request.headers.get('x-cron-secret')
  if (cronSecretHeader === cronSecret) {
    return null
  }

  // Check query parameter as fallback
  const url = new URL(request.url)
  const secretParam = url.searchParams.get('secret')
  if (secretParam === cronSecret) {
    return null
  }

  // Unauthorized
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Higher-order function to wrap a CRON handler with authentication
 *
 * @example
 * export const GET = withCronAuth(async (request) => {
 *   // Your cron logic here
 *   return NextResponse.json({ success: true })
 * })
 */
export function withCronAuth(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const authError = verifyCronAuth(request)
    if (authError) {
      return authError
    }
    return handler(request)
  }
}
