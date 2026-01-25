import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/middleware/cron-auth";

export const runtime = "edge";

/**
 * Daily analytics aggregation
 * Runs at 1 AM UTC daily via Vercel cron
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = getServiceRoleClient();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const analytics: Record<string, number> = {};

    // Count new users
    const { count: newUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", yesterday.toISOString())
      .lt("created_at", today.toISOString());

    analytics.newUsers = newUsers || 0;

    // Count new letters
    const { count: newLetters } = await supabase
      .from("letters")
      .select("*", { count: "exact", head: true })
      .gte("created_at", yesterday.toISOString())
      .lt("created_at", today.toISOString());

    analytics.newLetters = newLetters || 0;

    // Count approved letters
    const { count: approvedLetters } = await supabase
      .from("letters")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("approved_at", yesterday.toISOString())
      .lt("approved_at", today.toISOString());

    analytics.approvedLetters = approvedLetters || 0;

    // Count new subscriptions
    const { count: newSubscriptions } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", yesterday.toISOString())
      .lt("created_at", today.toISOString());

    analytics.newSubscriptions = newSubscriptions || 0;

    // Count emails sent
    const { count: emailsSent } = await supabase
      .from("email_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", yesterday.toISOString())
      .lt("sent_at", today.toISOString());

    analytics.emailsSent = emailsSent || 0;

    // Log analytics (could be stored in a separate analytics table)
    console.log("[Cron:DailyAnalytics]", {
      date: yesterday.toISOString().split("T")[0],
      ...analytics,
    });

    return NextResponse.json({
      success: true,
      date: yesterday.toISOString().split("T")[0],
      analytics,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cron:DailyAnalytics] Error:", message);

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
