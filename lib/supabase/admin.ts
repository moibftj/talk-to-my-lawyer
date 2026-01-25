import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Singleton service role client with proper typing
let serviceRoleClient: SupabaseClient<Database> | null = null;

/**
 * Gets a singleton Supabase client with Service Role privileges.
 * WARNING: This client bypasses RLS! Use only for admin/system tasks.
 */
export function getServiceRoleClient(): SupabaseClient<Database> {
  if (serviceRoleClient) return serviceRoleClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing Supabase service configuration (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  serviceRoleClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serviceRoleClient;
}

/**
 * Resets the singleton client (useful for testing)
 */
export function resetServiceRoleClient(): void {
  serviceRoleClient = null;
}

export type SupabaseAdminClient = SupabaseClient<Database>;
