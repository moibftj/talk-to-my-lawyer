/**
 * Next.js Middleware (Edge Runtime)
 *
 * FILE NAMING CONVENTION:
 * In Next.js App Router, middleware can be named either:
 * - `middleware.ts` (standard convention)
 * - `proxy.ts` (alternative name, used in this project)
 *
 * IMPORTANT: If you rename this file to `middleware.ts`, update all references.
 * This file is the Edge Runtime middleware that runs on EVERY request.
 *
 * PURPOSE:
 * - Session refresh for authenticated users
 * - Route protection based on user roles
 * - Admin portal authentication (separate from Supabase auth)
 * - Role-based redirects
 *
 * ARCHITECTURE:
 * - Root `proxy.ts` → calls `lib/supabase/proxy.ts` (updateSession function)
 * - Handles both Supabase auth (subscribers) and admin sessions (admins/attorneys)
 *
 * ADMIN PORTALS:
 * - `/attorney-portal/*` → Attorney Admin only (admin_session cookie)
 * - `/secure-admin-gateway/*` → Super Admin only (admin_session cookie)
 * - `/dashboard/*` → Subscribers only (Supabase auth)
 * - `/dashboard/commissions`, `/dashboard/coupons` → Employees only
 *
 * ENV VARIABLES:
 * - NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anon key
 * - ADMIN_PORTAL_ROUTE - Route prefix for admin portal (default: secure-admin-gateway)
 * - ADMIN_PORTAL_KEY - Shared secret for 3rd factor authentication
 */

import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
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
