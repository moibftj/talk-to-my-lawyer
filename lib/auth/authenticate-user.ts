/**
 * Reusable authentication utility to reduce code duplication across API routes
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { AuthenticationError, AuthorizationError } from '@/lib/api/api-error-handler'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AuthenticationResult {
  authenticated: boolean
  user: User | null
  errorResponse: NextResponse | null
}

/**
 * Authenticate user and return result
 * Replaces duplicated pattern: const { data: { user }, error: authError } = await supabase.auth.getUser()
 * 
 * @returns AuthenticationResult with user info or error response
 */
export async function authenticateUser(): Promise<AuthenticationResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return {
      authenticated: false,
      user: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  
  return {
    authenticated: true,
    user,
    errorResponse: null
  }
}

/**
 * Authenticate user or return error response
 * 
 * This is a convenience wrapper that either returns the authenticated user
 * or returns an error response that can be sent directly from the API route.
 * 
 * @example
 * const userOrError = await authenticateUserOrReturnError()
 * if (userOrError instanceof NextResponse) return userOrError
 * const user = userOrError
 * 
 * @returns Authenticated user or error NextResponse
 */
export async function authenticateUserOrReturnError(): Promise<User | NextResponse> {
  const result = await authenticateUser()

  if (!result.authenticated || !result.user) {
    return result.errorResponse!
  }

  return result.user
}

/**
 * Extended authentication result with Supabase client and user profile
 */
export interface AuthContextResult {
  user: User
  supabase: SupabaseClient
  profile?: {
    role: string
    [key: string]: unknown
  }
}

/**
 * Authenticate user and return auth context (user + supabase client)
 * This is the most commonly needed pattern in API routes
 *
 * @throws {AuthenticationError} if user is not authenticated
 */
export async function requireAuth(): Promise<AuthContextResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError()
  }

  return { user, supabase }
}

/**
 * Authenticate user and verify role
 *
 * @throws {AuthenticationError} if user is not authenticated
 * @throws {AuthorizationError} if user doesn't have required role
 */
export async function requireRole(role: string): Promise<AuthContextResult> {
  const { user, supabase } = await requireAuth()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new AuthorizationError('Unable to verify user role')
  }

  if (profile.role !== role) {
    throw new AuthorizationError(`This action requires ${role} role`)
  }

  return { user, supabase, profile }
}

/**
 * Authenticate user and verify they are a subscriber
 *
 * @throws {AuthenticationError} if user is not authenticated
 * @throws {AuthorizationError} if user is not a subscriber
 */
export async function requireSubscriber(): Promise<AuthContextResult> {
  return requireRole('subscriber')
}

/**
 * Authenticate user and verify they are an admin (or super_admin)
 *
 * @throws {AuthenticationError} if user is not authenticated
 * @throws {AuthorizationError} if user is not an admin
 */
export async function requireAdmin(): Promise<AuthContextResult> {
  const { user, supabase } = await requireAuth()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new AuthorizationError('Unable to verify admin status')
  }

  const adminRoles = ['admin', 'super_admin']
  if (!adminRoles.includes(profile.role)) {
    throw new AuthorizationError('This action requires admin privileges')
  }

  return { user, supabase, profile }
}

/**
 * Authenticate user and verify they are an employee
 *
 * @throws {AuthenticationError} if user is not authenticated
 * @throws {AuthorizationError} if user is not an employee
 */
export async function requireEmployee(): Promise<AuthContextResult> {
  return requireRole('employee')
}
