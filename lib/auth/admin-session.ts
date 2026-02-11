import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Admin sub-role enum - matches database enum
export type AdminSubRole = 'super_admin' | 'attorney_admin'

export interface AdminSession {
  userId: string
  email: string
  subRole: AdminSubRole
  loginTime: number
  lastActivity: number
}

/**
 * Get admin session from Supabase auth
 * 
 * Uses standard Supabase auth session - no custom JWT, no portal ID, no session key.
 * Checks the profiles table to verify admin role and sub-role.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return null
    }

    // Verify admin role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, admin_sub_role, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return null
    }

    if (profile.role !== 'admin') {
      return null
    }

    const subRole: AdminSubRole = (profile.admin_sub_role as AdminSubRole) || 'super_admin'

    return {
      userId: profile.id,
      email: user.email || '',
      subRole,
      loginTime: new Date(user.last_sign_in_at || user.created_at).getTime(),
      lastActivity: Date.now()
    }
  } catch (error) {
    console.error('[AdminSession] Error getting session:', error)
    return null
  }
}

/**
 * Verify admin session (alias for getAdminSession for backward compatibility)
 */
export async function verifyAdminSession(): Promise<AdminSession | null> {
  return await getAdminSession()
}

/**
 * Destroy admin session (logout via Supabase)
 */
export async function destroyAdminSession(): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('[AdminSession] Error destroying session:', error)
  }
}

/**
 * Verify admin role from database
 */
export async function verifyAdminRole(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  return profile?.role === 'admin'
}

/**
 * Check if current user is authenticated admin
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getAdminSession()
  return session !== null
}

/**
 * Require admin authentication for API routes (any admin type)
 */
export async function requireAdminAuth(): Promise<NextResponse | undefined> {
  const authenticated = await isAdminAuthenticated()

  if (!authenticated) {
    return NextResponse.json(
      { error: 'Admin authentication required' },
      { status: 401 }
    )
  }

  return undefined
}

/**
 * Get admin sub-role from database
 */
export async function getAdminSubRole(userId: string): Promise<AdminSubRole | null> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('admin_sub_role')
    .eq('id', userId)
    .single()

  // Default to super_admin for backward compatibility
  return (profile?.admin_sub_role as AdminSubRole) || 'super_admin'
}

/**
 * Get current admin's sub-role from session
 */
export async function getCurrentAdminSubRole(): Promise<AdminSubRole | null> {
  const session = await getAdminSession()
  if (!session) {
    return null
  }
  return session.subRole
}

/**
 * Require Super Admin authentication for API routes
 * Use this for endpoints that should only be accessible by super admins:
 * - Analytics
 * - User management
 * - Coupon management
 * - Commission payouts
 * - Email queue management
 */
export async function requireSuperAdminAuth(): Promise<NextResponse | undefined> {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Admin authentication required' },
      { status: 401 }
    )
  }

  // Check if user is a super admin
  if (session.subRole !== 'super_admin') {
    console.warn('[AdminAuth] Super admin access required:', {
      userId: session.userId,
      subRole: session.subRole
    })
    return NextResponse.json(
      { error: 'Super admin access required' },
      { status: 403 }
    )
  }

  return undefined
}

/**
 * Require Attorney Admin or Super Admin authentication for API routes
 * Use this for endpoints that both admin types can access:
 * - Letter review
 * - Letter approval/rejection
 */
export async function requireAttorneyAdminAccess(): Promise<NextResponse | undefined> {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Admin authentication required' },
      { status: 401 }
    )
  }

  // Both attorney_admin and super_admin can access letter review
  return undefined
}

/**
 * Check if current user is a Super Admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await getAdminSession()
  if (!session) {
    return false
  }
  return session.subRole === 'super_admin'
}

/**
 * Check if current user is an Attorney Admin
 */
export async function isAttorneyAdmin(): Promise<boolean> {
  const session = await getAdminSession()
  if (!session) {
    return false
  }
  return session.subRole === 'attorney_admin'
}

/**
 * @deprecated - No longer needed with Supabase auth. Kept for backward compatibility.
 * The verifyAdminCredentials function is no longer used since login is handled
 * directly by Supabase auth on the client side.
 */
export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; userId?: string; subRole?: AdminSubRole; error?: string }> {
  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (authError || !authData.user) {
    return { success: false, error: 'Invalid email or password' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, admin_sub_role, full_name')
    .eq('id', authData.user.id)
    .single()

  if (profileError || !profile) {
    return { success: false, error: 'User profile not found' }
  }

  if (profile.role !== 'admin') {
    return {
      success: false,
      error: 'Access denied. Administrator privileges required.'
    }
  }

  const subRole: AdminSubRole = (profile.admin_sub_role as AdminSubRole) || 'super_admin'

  return { success: true, userId: profile.id, subRole }
}
