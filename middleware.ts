/**
 * Next.js Middleware (Edge Runtime)
 *
 * In Next.js 16.x App Router, this middleware file handles:
 * - Session refresh for authenticated users
 * - Route protection based on user roles
 * - Admin portal authentication (separate from Supabase auth)
 * - Role-based redirects
 *
 * ARCHITECTURE:
 * - Root `middleware.ts` → calls `lib/supabase/proxy.ts` (updateSession function)
 * - Handles both Supabase auth (subscribers) and admin sessions (admins/attorneys)
 *
 * PROTECTED ROUTES:
 * - `/dashboard/*` → Supabase authenticated users only
 * - `/secure-admin-gateway/dashboard/*` → Super Admin only (admin_session cookie)
 * - `/secure-admin-gateway/review/*` → Super Admin only (admin_session cookie)
 * - `/attorney-portal/review/*` → Attorney Admin only (admin_session cookie)
 *
 * ENV VARIABLES:
 * - NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anon key
 * - ADMIN_PORTAL_ROUTE - Route prefix for admin portal (default: secure-admin-gateway)
 */

import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
