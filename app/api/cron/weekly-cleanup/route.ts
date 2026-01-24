import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/**
 * Weekly cleanup of old data
 * Runs at 2 AM UTC every Sunday via Vercel cron
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

    // Clean up old audit logs (older than 90 days)
    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: deletedAuditLogs } = await supabase
      .from("letter_audit_trail")
      .delete()
      .lt("created_at", ninetyDaysAgo)
      .select("id");

    results.oldAuditLogs = deletedAuditLogs?.length || 0;

    // Clean up old security audit logs (older than 90 days)
    const { data: deletedSecurityLogs } = await supabase
      .from("security_audit_log")
      .delete()
      .lt("created_at", ninetyDaysAgo)
      .select("id");

    results.oldSecurityLogs = deletedSecurityLogs?.length || 0;

    // Clean up old data access logs (older than 90 days)
    const { data: deletedAccessLogs } = await supabase
      .from("data_access_logs")
      .delete()
      .lt("accessed_at", ninetyDaysAgo)
      .select("id");

    results.oldAccessLogs = deletedAccessLogs?.length || 0;

    // Clean up old fraud detection logs (older than 180 days)
    const sixMonthsAgo = new Date(
      Date.now() - 180 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: deletedFraudLogs } = await supabase
      .from("fraud_detection_log")
      .delete()
      .lt("created_at", sixMonthsAgo)
      .select("id");

    results.oldFraudLogs = deletedFraudLogs?.length || 0;

    // Clean up old email delivery logs (older than 60 days)
    const sixtyDaysAgo = new Date(
      Date.now() - 60 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: deletedDeliveryLogs } = await supabase
      .from("email_delivery_log")
      .delete()
      .lt("created_at", sixtyDaysAgo)
      .select("id");

    results.oldDeliveryLogs = deletedDeliveryLogs?.length || 0;

    // Clean up completed webhook events (older than 30 days)
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: deletedWebhookEvents } = await supabase
      .from("webhook_events")
      .delete()
      .not("processed_at", "is", null)
      .lt("created_at", thirtyDaysAgo)
      .select("id");

    results.oldWebhookEvents = deletedWebhookEvents?.length || 0;

    // Calculate total cleaned
    const totalCleaned = Object.values(results).reduce((a, b) => a + b, 0);

    console.log("[Cron:WeeklyCleanup]", {
      totalCleaned,
      ...results,
    });

    return NextResponse.json({
      success: true,
      message: "Weekly cleanup completed",
      totalCleaned,
      results,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron:WeeklyCleanup] Error:", message);

    return NextResponse.json(
      {
        error: message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
