import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Use untyped client to avoid type mismatches with database tables not in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let serviceRoleClient: SupabaseClient<any> | null = null;

/**
 * Gets a singleton Supabase client with Service Role privileges.
 * WARNING: This client bypasses RLS! Use only for admin/system tasks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getServiceRoleClient(): SupabaseClient<any> {
  if (serviceRoleClient) return serviceRoleClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing Supabase service configuration (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  serviceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    },
  );

  return serviceRoleClient;
}
