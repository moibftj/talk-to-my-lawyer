/**
 * Reusable authentication utility to reduce code duplication across API routes
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

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
