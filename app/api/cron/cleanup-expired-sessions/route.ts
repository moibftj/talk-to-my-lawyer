import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/**
 * Cleanup expired sessions and stale data
 * Runs every 6 hours via Vercel cron
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    const secretParam = url.searchParams.get("secret");
    if (secretParam !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const supabase = getServiceRoleClient();
    const results: Record<string, number> = {};

    // Clean up expired email queue items (older than 7 days and failed)
    const { data: deletedEmails } = await supabase
      .from("email_queue")
      .delete()
      .eq("status", "failed")
      .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .select("id");

    results.expiredEmails = deletedEmails?.length || 0;

    // Clean up old email queue logs (older than 30 days)
    const { data: deletedLogs } = await supabase
      .from("email_queue_logs")
      .delete()
      .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .select("id");

    results.oldEmailLogs = deletedLogs?.length || 0;

    // Clean up expired data export requests (older than 30 days)
    const { data: deletedExports } = await supabase
      .from("data_export_requests")
      .delete()
      .eq("status", "completed")
      .lt("expires_at", new Date().toISOString())
      .select("id");

    results.expiredExports = deletedExports?.length || 0;

    return NextResponse.json({
      success: true,
      message: "Cleanup completed",
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron:Cleanup] Error:", message);

    return NextResponse.json(
      {
        error: message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
