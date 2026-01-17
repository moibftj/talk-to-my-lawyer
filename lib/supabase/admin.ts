import { createClient } from '@supabase/supabase-js'

// Define the client type based on the library return type
type SupabaseClient = ReturnType<typeof createClient>

let serviceRoleClient: SupabaseClient | null = null

/**
 * Gets a singleton Supabase client with Service Role privileges.
 * WARNING: This client bypasses RLS! Use only for admin/system tasks.
 */
export function getServiceRoleClient() {
  if (serviceRoleClient) return serviceRoleClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase service configuration (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
  }

  serviceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return serviceRoleClient
}
