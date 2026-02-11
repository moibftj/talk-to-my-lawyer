import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Admin Session Route
 * 
 * With standard Supabase auth, this route simply checks if the user
 * is authenticated and has admin role. No custom JWT token handling.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.redirect(new URL('/secure-admin-gateway/login', request.url))
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, admin_sub_role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/secure-admin-gateway/login', request.url))
    }

    const subRole = profile.admin_sub_role || 'super_admin'
    const redirect = subRole === 'attorney_admin'
      ? '/attorney-portal/review'
      : '/secure-admin-gateway/dashboard'

    return NextResponse.redirect(new URL(redirect, request.url))
  } catch (error) {
    console.error('[AdminAuth] Session check error:', error)
    return NextResponse.redirect(new URL('/secure-admin-gateway/login', request.url))
  }
}
