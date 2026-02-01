/**
 * Database Client Factory
 *
 * Centralized access to Supabase clients with proper singleton patterns.
 * - Server client: Created per-request (depends on cookies)
 * - Service role client: Singleton (bypasses RLS, use carefully!)
 *
 * @example
 * ```ts
 * import { db } from '@/lib/db/client-factory'
 *
 * // In API route (server client with auth)
 * const supabase = await db.getServerClient()
 *
 * // For admin operations (service role, bypasses RLS)
 * const supabase = db.getServiceRoleClient()
 * ```
 */

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { DatabaseWithRelationships } from '@/lib/supabase/types'

// ============================================================================
// Types
// ============================================================================

export type SupabaseServerClient = ReturnType<typeof createServerClient<DatabaseWithRelationships>>
export type SupabaseServiceRoleClient = ReturnType<typeof createSupabaseClient<DatabaseWithRelationships>>

// ============================================================================
// Service Role Client (Singleton)
// ============================================================================

/**
 * Service role client singleton.
 * WARNING: Bypasses Row Level Security! Use only for:
 * - Admin operations that need to access all data
 * - Background jobs that run without user context
 * - Operations that explicitly need elevated privileges
 */
let serviceRoleClient: SupabaseServiceRoleClient | null = null

function getServiceRoleUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }
  return url
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }
  return key
}

/**
 * Get the singleton service role client.
 * This client bypasses RLS and should be used with extreme caution.
 */
export function getServiceRoleClient(): SupabaseServiceRoleClient {
  if (serviceRoleClient) {
    return serviceRoleClient
  }

  const url = getServiceRoleUrl()
  const key = getServiceRoleKey()

  serviceRoleClient = createSupabaseClient<DatabaseWithRelationships>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as SupabaseServiceRoleClient

  return serviceRoleClient
}

/**
 * Reset the service role client singleton.
 * Primarily useful for testing.
 */
export function resetServiceRoleClient(): void {
  serviceRoleClient = null
}

// ============================================================================
// Server Client (Per-Request)
// ============================================================================

/**
 * Create a Supabase server client for the current request.
 * This client respects Row Level Security based on the user's session.
 *
 * NOTE: Must be called during request handling to access cookies.
 */
export async function getServerClient(): Promise<SupabaseServerClient> {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.'
    )
  }

  return createServerClient<DatabaseWithRelationships>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - ignored, proxy handles session refresh
          }
        },
      },
    }
  ) as SupabaseServerClient
}

// ============================================================================
// Database Factory (Unified API)
// ============================================================================

/**
 * Unified database client factory.
 *
 * @example
 * ```ts
 * import { db } from '@/lib/db/client-factory'
 *
 * // Server client (respects RLS)
 * const supabase = await db.server()
 *
 * // Service role client (bypasses RLS - use carefully!)
 * const supabase = db.serviceRole()
 * ```
 */
export const db = {
  /**
   * Get a server client for the current request.
   * Respects Row Level Security based on user session.
   */
  server: getServerClient,

  /**
   * Get the singleton service role client.
   * WARNING: Bypasses RLS! Use only for admin/system operations.
   */
  serviceRole: getServiceRoleClient,

  /**
   * Reset all client singletons.
   * Primarily useful for testing.
   */
  reset: () => {
    resetServiceRoleClient()
  },
} as const

// ============================================================================
// Legacy Exports (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use `db.server()` or `await getServerClient()` instead.
 */
export async function createClient(): Promise<SupabaseServerClient> {
  return getServerClient()
}

/**
 * @deprecated Use `db.serviceRole()` or `getServiceRoleClient()` instead.
 */
export { getServiceRoleClient as createAdminClient }
