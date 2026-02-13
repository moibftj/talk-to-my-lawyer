import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { DatabaseWithRelationships } from '@/lib/supabase/types'

export async function createClient(): Promise<any> {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Create a .env.local (cp .env.example .env.local), set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.'
    )
  }

  return createServerClient<DatabaseWithRelationships>(
    supabaseUrl,
    supabaseAnonKey,
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
          } catch (error) {
            // Server Component - ignored, proxy handles session refresh
            console.error("[Supabase Server] Error setting cookies:", error);
          }
        },
      },
    }
  ) as any
}

export type SupabaseServerClient = any
