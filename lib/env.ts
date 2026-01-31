/**
 * Environment variable validation
 * This file should be imported early in the application to catch missing env vars at startup
 */

const requiredEnvVars = ["NEXT_PUBLIC_SUPABASE_URL"] as const;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required env var: ${envVar}`);
  }
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing required env var: NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)",
  );
}

// Export validated env vars with proper typing
export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
} as const;
