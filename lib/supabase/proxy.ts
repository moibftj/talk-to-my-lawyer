import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        '[Proxy] Missing Supabase env. Create .env.local (cp .env.example .env.local), set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.'
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

    // Get user role and admin sub-role for route protection
    let userRole: string | null = null
    let adminSubRole: string | null = null
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, admin_sub_role')
        .eq('id', user.id)
        .single()
      
      userRole = profile?.role || null
      adminSubRole = profile?.admin_sub_role || null
    }

    const pathname = request.nextUrl.pathname

    // ============================================================
    // ATTORNEY ADMIN PORTAL PROTECTION
    // Uses standard Supabase auth + role check (no custom JWT)
    // ============================================================
    if (pathname.startsWith('/attorney-portal')) {
      // Allow login page without auth (redirects to unified admin login)
      if (pathname === '/attorney-portal/login') {
        // If already authenticated as attorney_admin, redirect to review
        if (user && userRole === 'admin' && adminSubRole === 'attorney_admin') {
          const url = request.nextUrl.clone()
          url.pathname = '/attorney-portal/review'
          return NextResponse.redirect(url)
        }
        return supabaseResponse
      }

      // Must be authenticated
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/secure-admin-gateway/login'
        return NextResponse.redirect(url)
      }

      // Must be an admin
      if (userRole !== 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
      }

      // Only attorney admins can access attorney portal
      if (adminSubRole !== 'attorney_admin') {
        // Super admins trying to access attorney portal are redirected to super admin portal
        const url = request.nextUrl.clone()
        url.pathname = '/secure-admin-gateway/dashboard'
        return NextResponse.redirect(url)
      }

      return supabaseResponse
    }

    // ============================================================
    // SUPER ADMIN PORTAL PROTECTION
    // Uses standard Supabase auth + role check (no custom JWT)
    // ============================================================
    const adminPortalRoute = process.env.ADMIN_PORTAL_ROUTE || 'secure-admin-gateway'
    if (pathname.startsWith(`/${adminPortalRoute}`)) {
      // Allow login and forgot-password pages without auth
      if (
        pathname === `/${adminPortalRoute}/login` ||
        pathname === `/${adminPortalRoute}/forgot-password`
      ) {
        // If already authenticated as super_admin, redirect to dashboard
        if (user && userRole === 'admin' && adminSubRole === 'super_admin') {
          const url = request.nextUrl.clone()
          url.pathname = `/${adminPortalRoute}/dashboard`
          return NextResponse.redirect(url)
        }
        // If already authenticated as attorney_admin, redirect to attorney portal
        if (user && userRole === 'admin' && adminSubRole === 'attorney_admin') {
          const url = request.nextUrl.clone()
          url.pathname = '/attorney-portal/review'
          return NextResponse.redirect(url)
        }
        return supabaseResponse
      }

      // Must be authenticated
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = `/${adminPortalRoute}/login`
        return NextResponse.redirect(url)
      }

      // Must be an admin
      if (userRole !== 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/login'
        return NextResponse.redirect(url)
      }

      // Only super admins can access super admin portal
      if (adminSubRole !== 'super_admin') {
        // Attorney admins trying to access super admin portal are redirected to attorney portal
        const url = request.nextUrl.clone()
        url.pathname = '/attorney-portal/review'
        return NextResponse.redirect(url)
      }

      return supabaseResponse
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

    // Role-based routing for dashboard
    if (user && userRole) {
      // Admins who somehow land on /dashboard should go to their portal
      if (userRole === 'admin' && pathname.startsWith('/dashboard')) {
        const url = request.nextUrl.clone()
        if (adminSubRole === 'attorney_admin') {
          url.pathname = '/attorney-portal/review'
        } else {
          url.pathname = '/secure-admin-gateway/dashboard'
        }
        return NextResponse.redirect(url)
      }

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
    console.error('[v0] Proxy error:', error)
    
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
