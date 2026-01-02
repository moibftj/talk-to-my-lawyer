import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_SESSION_COOKIE = 'admin_session'
const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds

export interface AdminSession {
  userId: string
  email: string
  loginTime: number
  lastActivity: number
  portalKeyVerified: boolean
}

/**
 * Create an admin session after successful authentication
 */
export async function createAdminSession(userId: string, email: string): Promise<void> {
  const session: AdminSession = {
    userId,
    email,
    loginTime: Date.now(),
    lastActivity: Date.now(),
    portalKeyVerified: true
  }

  const cookieStore = await cookies()
  cookieStore.set(ADMIN_SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1800, // 30 minutes
    path: '/'
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
 * Verify admin credentials and portal key
 * Supports multiple admins - each admin has their own Supabase Auth account
 */
export async function verifyAdminCredentials(
  email: string,
  password: string,
  portalKey: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  // Verify portal key (security layer - prevents unauthorized access even with valid credentials)
  const expectedPortalKey = process.env.ADMIN_PORTAL_KEY?.trim()

  // Trim whitespace from input for more robust comparison
  const trimmedPortalKey = portalKey.trim()

  console.log('[AdminAuth] Portal key verification:', {
    hasExpectedKey: !!expectedPortalKey,
    keysMatch: expectedPortalKey === trimmedPortalKey
  })

  if (!expectedPortalKey || trimmedPortalKey !== expectedPortalKey) {
    console.warn('[AdminAuth] Portal key mismatch')
    return { success: false, error: 'Invalid admin portal key' }
  }

  // Authenticate with Supabase Auth (supports multiple users)
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (authError || !authData.user) {
    console.warn('[AdminAuth] Supabase auth failed:', authError?.message)
    return { success: false, error: 'Invalid email or password' }
  }

  // Verify user has admin role in profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', authData.user.id)
    .eq('role', 'admin')
    .single()

  if (profileError || !profile) {
    console.warn('[AdminAuth] User does not have admin role:', {
      userId: authData.user.id,
      email
    })
    return { success: false, error: 'Access denied. Admin privileges required.' }
  }

  return { success: true, userId: profile.id }
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
