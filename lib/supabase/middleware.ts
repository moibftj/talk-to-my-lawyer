import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { verifyAdminSessionFromRequest, type AdminSession } from '@/lib/auth/admin-session'

// Parse admin session cookie and get sub-role
function getAdminSessionWithSubRole(request: NextRequest): AdminSession | null {
  const sessionCookie = request.cookies.get('admin_session')
  if (!sessionCookie) {
    return null
  }

  try {
    const session: AdminSession = JSON.parse(sessionCookie.value)
    const now = Date.now()
    if (now - session.lastActivity > 30 * 60 * 1000) {
      return null
    }
    return session
  } catch {
    return null
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        '[Middleware] Missing Supabase env. Create .env.local (cp .env.example .env.local), set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.'
      )
      // Allow access to auth pages and home without Supabase
      if (request.nextUrl.pathname.startsWith('/auth') || request.nextUrl.pathname === '/') {
        return supabaseResponse
      }
      
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Get user role for route protection
    let userRole = null
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      userRole = profile?.role
    }

    const pathname = request.nextUrl.pathname

    // Attorney Admin Portal Protection
    // Attorney admins have their own dedicated portal
    if (pathname.startsWith('/attorney-portal')) {
      // Allow login page without auth
      if (pathname === '/attorney-portal/login') {
        return NextResponse.next({ request })
      }

      // Verify admin session and check sub-role
      const adminSession = getAdminSessionWithSubRole(request)
      if (!adminSession) {
        const url = request.nextUrl.clone()
        url.pathname = '/attorney-portal/login'
        return NextResponse.redirect(url)
      }

      // Only attorney admins can access attorney portal
      if (adminSession.subRole !== 'attorney_admin') {
        // System admins trying to access attorney portal are redirected to system admin portal
        const url = request.nextUrl.clone()
        url.pathname = '/secure-admin-gateway/dashboard'
        return NextResponse.redirect(url)
      }

      return NextResponse.next({ request })
    }

    // System Admin Portal Protection (BEFORE regular auth checks)
    // System admin uses separate authentication, skip Supabase auth for admin routes
    const adminPortalRoute = process.env.ADMIN_PORTAL_ROUTE || 'secure-admin-gateway'
    if (pathname.startsWith(`/${adminPortalRoute}`)) {
      // Allow login page without auth
      if (pathname === `/${adminPortalRoute}/login`) {
        return NextResponse.next({ request })
      }

      // Verify admin session for all other admin portal routes
      const adminSession = getAdminSessionWithSubRole(request)
      if (!adminSession) {
        const url = request.nextUrl.clone()
        url.pathname = `/${adminPortalRoute}/login`
        return NextResponse.redirect(url)
      }

      // Only system admins can access system admin portal
      // Note: Review center is accessible to both, handled separately below
      if (adminSession.subRole !== 'super_admin') {
        // Attorney admins trying to access system admin portal are redirected to attorney portal
        const url = request.nextUrl.clone()
        url.pathname = '/attorney-portal/review'
        return NextResponse.redirect(url)
      }

      return NextResponse.next({ request })
    }

    // Block access to old admin routes completely
    if (pathname.startsWith('/dashboard/admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Public routes
    if (pathname === '/' || pathname.startsWith('/auth')) {
      return supabaseResponse
    }

    // Require auth for dashboard
    if (!user && pathname.startsWith('/dashboard')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    // Role-based routing
    if (user && userRole) {
      if (userRole === 'employee' && (pathname.startsWith('/dashboard/letters') || pathname.startsWith('/dashboard/subscription'))) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/commissions'
        return NextResponse.redirect(url)
      }

      if ((pathname.startsWith('/dashboard/commissions') || pathname.startsWith('/dashboard/coupons')) && userRole === 'subscriber') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/letters'
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  } catch (error) {
    console.error('[v0] Middleware error:', error)
    
    // Allow access to auth pages even on error
    if (request.nextUrl.pathname.startsWith('/auth') || request.nextUrl.pathname === '/') {
      return supabaseResponse
    }
    
    // Redirect to home with error for other routes
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
}
