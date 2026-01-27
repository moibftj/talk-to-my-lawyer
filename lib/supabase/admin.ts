import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { DatabaseWithRelationships } from "@/lib/supabase/types";

// Singleton service role client with proper typing
let serviceRoleClient: SupabaseClient<any> | null = null;

/**
 * Gets a singleton Supabase client with Service Role privileges.
 * WARNING: This client bypasses RLS! Use only for admin/system tasks.
 */
export function getServiceRoleClient(): SupabaseClient<any> {
  if (serviceRoleClient) return serviceRoleClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing Supabase service configuration (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  serviceRoleClient = createClient<DatabaseWithRelationships>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as SupabaseClient<any>;

  return serviceRoleClient;
}

/**
 * Resets the singleton client (useful for testing)
 */
export function resetServiceRoleClient(): void {
  serviceRoleClient = null;
}

export type SupabaseAdminClient = SupabaseClient<any>;
