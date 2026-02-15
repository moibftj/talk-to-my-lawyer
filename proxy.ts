/**
 * Next.js Request Proxy (Node.js Runtime)
 *
 * Replaces the deprecated middleware.ts pattern in Next.js 16+
 * Handles session refresh, route protection, and role-based redirects.
 *
 * All authentication uses standard Supabase auth - no custom JWT,
 * no portal IDs, no session keys, no 3FA for any user type.
 *
 * ARCHITECTURE:
 * - Root `proxy.ts` → calls `lib/supabase/proxy.ts` (updateSession function)
 * - All users (subscribers, employees, admins) use Supabase auth
 * - Admin role and sub-role checked from profiles table
 *
 * PROTECTED ROUTES:
 * - `/dashboard/*` → Supabase authenticated subscribers/employees
 * - `/secure-admin-gateway/dashboard/*` → Super Admin only (Supabase auth + role check)
 * - `/secure-admin-gateway/review/*` → Super Admin only (Supabase auth + role check)
 * - `/attorney-portal/review/*` → Attorney Admin only (Supabase auth + role check)
 *
 * ENV VARIABLES:
 * - NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anon key
 * - ADMIN_PORTAL_ROUTE - Route prefix for admin portal (default: secure-admin-gateway)
 */

import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import * as Sentry from '@sentry/nextjs'

// Use Node.js runtime for Supabase SSR cookie handling
export const runtime = 'nodejs'

export default async function proxy(request: NextRequest) {
  try {
    // API routes should be handled by route handlers directly.
    // Bypassing auth/session middleware avoids unexpected API method/status behavior.
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.next({ request })
    }

    return await updateSession(request)
  } catch (error) {
    // Capture middleware errors in Sentry
    Sentry.captureException(error, {
      tags: {
        proxy: true,
        path: request.nextUrl.pathname,
        method: request.method,
      },
      extra: {
        url: request.url,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
      },
    })

    // Add breadcrumb for proxy error
    Sentry.addBreadcrumb({
      category: 'proxy',
      message: `Proxy error on ${request.nextUrl.pathname}`,
      level: 'error',
      data: {
        method: request.method,
        path: request.nextUrl.pathname,
      },
    })

    // Fallback response - redirect to error page
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        requestId: crypto.randomUUID(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
