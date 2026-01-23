import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/**
 * Health check endpoint for monitoring
 * Runs every 30 minutes via Vercel cron
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret (optional for health checks)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    const secretParam = url.searchParams.get("secret");
    if (secretParam !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Check database connection
  try {
    const dbStart = Date.now();
    const supabase = getServiceRoleClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    
    if (error) throw error;
    
    checks.database = {
      status: "healthy",
      latency: Date.now() - dbStart,
    };
  } catch (error: unknown) {
    checks.database = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Check email queue status
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("email_queue")
      .select("status")
      .eq("status", "pending")
      .limit(100);

    if (error) throw error;

    checks.emailQueue = {
      status: "healthy",
      latency: data?.length || 0,
    };
  } catch (error: unknown) {
    checks.emailQueue = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Check environment configuration
  const requiredEnvVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "OPENAI_API_KEY",
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
  ];

  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

  checks.environment = {
    status: missingEnvVars.length === 0 ? "healthy" : "unhealthy",
    error: missingEnvVars.length > 0 ? `Missing: ${missingEnvVars.join(", ")}` : undefined,
  };

  // Overall status
  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");

  return NextResponse.json({
    status: allHealthy ? "healthy" : "degraded",
    checks,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
  });
}
