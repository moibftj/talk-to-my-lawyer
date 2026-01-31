import { createBrowserClient } from '@supabase/ssr'
import type { DatabaseWithRelationships } from '@/lib/supabase/types'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  // During build time, return a mock client if environment variables are missing
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === 'undefined') {
      // Server-side during build - return a mock client
      return {
        auth: {
          signUp: async () => ({ data: null, error: new Error('Not configured') }),
          signIn: async () => ({ data: null, error: new Error('Not configured') }),
          signOut: async () => ({ error: new Error('Not configured') }),
          getUser: async () => ({ data: { user: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: null }, error: null })
        },
        from: () => ({
          select: () => ({ data: null, error: new Error('Not configured') }),
          insert: () => ({ data: null, error: new Error('Not configured') }),
          update: () => ({ data: null, error: new Error('Not configured') }),
          delete: () => ({ data: null, error: new Error('Not configured') })
        })
      } as any
    }

    throw new Error(
      'Missing Supabase environment variables. Create a .env.local (cp .env.example .env.local), set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY), then restart the dev server.'
    )
  }

  return createBrowserClient<DatabaseWithRelationships>(supabaseUrl, supabaseAnonKey)
}

export type SupabaseClient = ReturnType<typeof createClient>
