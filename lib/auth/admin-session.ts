import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_SESSION_COOKIE = 'admin_session'
const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds

// Admin sub-role enum - matches database enum
export type AdminSubRole = 'system_admin' | 'attorney_admin'

export interface AdminSession {
  userId: string
  email: string
  subRole: AdminSubRole
  loginTime: number
  lastActivity: number
}

/**
 * Create an admin session after successful authentication
 */
export async function createAdminSession(
  userId: string,
  email: string,
  subRole: AdminSubRole = 'system_admin'
): Promise<void> {
  const session: AdminSession = {
    userId,
    email,
    subRole,
    loginTime: Date.now(),
    lastActivity: Date.now(),
  }

  const cookieStore = await cookies()
  cookieStore.set(ADMIN_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1800, // 30 minutes
    path: '/'
  })

  // Log admin login for audit trail
  console.log('[AdminAuth] Admin session created:', {
    userId,
    email,
    subRole,
    timestamp: new Date().toISOString()
  })
}

/**
 * Verify admin session from cookies
 */
export async function verifyAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)

  if (!sessionCookie) {
    return null
  }

  try {
    const session: AdminSession = JSON.parse(sessionCookie.value)

    // Check if session has expired (30 minutes)
    const now = Date.now()
    if (now - session.lastActivity > ADMIN_SESSION_TIMEOUT) {
      await destroyAdminSession()
      return null
    }

    // Update last activity time
    session.lastActivity = now
    cookieStore.set(ADMIN_SESSION_COOKIE, JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1800,
      path: '/'
    })

    return session
  } catch (error) {
    console.error('[AdminSession] Error parsing session:', error)
    await destroyAdminSession()
    return null
  }
}

/**
 * Verify admin session from request (for middleware)
 */
export function verifyAdminSessionFromRequest(request: NextRequest): AdminSession | null {
  const sessionCookie = request.cookies.get(ADMIN_SESSION_COOKIE)

  if (!sessionCookie) {
    return null
  }

  try {
    const session: AdminSession = JSON.parse(sessionCookie.value)

    // Check if session has expired
    const now = Date.now()
    if (now - session.lastActivity > ADMIN_SESSION_TIMEOUT) {
      return null
    }

    return session
  } catch (error) {
    console.error('[AdminSession] Error parsing session from request:', error)
    return null
  }
}

/**
 * Destroy admin session (logout)
 */
export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_SESSION_COOKIE)
}

/**
 * Verify admin credentials (role-based authentication)
 * No shared secret required - each admin has their own account
 *
 * Security improvements:
 * - Individual accountability (each admin uses their own account)
 * - No shared secret to leak or rotate
 * - Deactivation is as simple as changing the user's role
 * - Full audit trail of which admin performed each action
 */
export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; userId?: string; subRole?: AdminSubRole; error?: string }> {
  const supabase = await createClient()

  // Authenticate with Supabase Auth (each admin has their own account)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (authError || !authData.user) {
    console.warn('[AdminAuth] Authentication failed:', {
      email,
      error: authError?.message
    })
    return { success: false, error: 'Invalid email or password' }
  }

  // Verify user has admin role in profiles table
  // This is the SINGLE source of truth for admin access
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, admin_sub_role, full_name')
    .eq('id', authData.user.id)
    .single()

  if (profileError || !profile) {
    console.warn('[AdminAuth] Profile not found:', {
      userId: authData.user.id,
      email
    })
    return { success: false, error: 'User profile not found' }
  }

  if (profile.role !== 'admin') {
    console.warn('[AdminAuth] User does not have admin role:', {
      userId: authData.user.id,
      email,
      role: profile.role
    })
    return {
      success: false,
      error: 'Access denied. Administrator privileges required.'
    }
  }

  // Default to system_admin if admin_sub_role is not set (for backward compatibility)
  const subRole: AdminSubRole = (profile.admin_sub_role as AdminSubRole) || 'system_admin'

  // Log successful authentication for audit trail
  console.log('[AdminAuth] Admin authenticated successfully:', {
    userId: profile.id,
    email,
    name: profile.full_name,
    subRole,
    timestamp: new Date().toISOString()
  })

  return { success: true, userId: profile.id, subRole }
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
 * Get admin session info
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  return await verifyAdminSession()
}

/**
 * Check if current user is authenticated admin
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await verifyAdminSession()
  if (!session) {
    return false
  }

  // Double-check role in database
  return await verifyAdminRole(session.userId)
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

  // Default to system_admin for backward compatibility
  return (profile?.admin_sub_role as AdminSubRole) || 'system_admin'
}

/**
 * Get current admin's sub-role from session
 */
export async function getCurrentAdminSubRole(): Promise<AdminSubRole | null> {
  const session = await verifyAdminSession()
  if (!session) {
    return null
  }
  return session.subRole
}

/**
 * Require System Admin authentication for API routes
 * Use this for endpoints that should only be accessible by system admins:
 * - Analytics
 * - User management
 * - Coupon management
 * - Commission payouts
 * - Email queue management
 */
export async function requireSuperAdminAuth(): Promise<NextResponse | undefined> {
  const session = await verifyAdminSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Admin authentication required' },
      { status: 401 }
    )
  }

  // Check if user is a system admin
  if (session.subRole !== 'system_admin') {
    console.warn('[AdminAuth] System admin access required:', {
      userId: session.userId,
      subRole: session.subRole
    })
    return NextResponse.json(
      { error: 'System admin access required' },
      { status: 403 }
    )
  }

  return undefined
}

/**
 * Require Attorney Admin or System Admin authentication for API routes
 * Use this for endpoints that both admin types can access:
 * - Letter review
 * - Letter approval/rejection
 */
export async function requireAttorneyAdminAccess(): Promise<NextResponse | undefined> {
  const session = await verifyAdminSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Admin authentication required' },
      { status: 401 }
    )
  }

  // Both attorney_admin and system_admin can access letter review
  // The check is: session.subRole must be either 'attorney_admin' or 'system_admin'
  // Since we only have these two types, all authenticated admins can access
  return undefined
}

/**
 * Check if current user is a System Admin
 */
export async function isSystemAdmin(): Promise<boolean> {
  const session = await verifyAdminSession()
  if (!session) {
    return false
  }
  return session.subRole === 'system_admin'
}

/**
 * Check if current user is an Attorney Admin
 */
export async function isAttorneyAdmin(): Promise<boolean> {
  const session = await verifyAdminSession()
  if (!session) {
    return false
  }
  return session.subRole === 'attorney_admin'
}

