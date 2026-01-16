import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

interface PendingEmail {
  id: string;
  to: string;
  subject: string;
  html: string | null;
  text: string | null;
  attempts: number;
  max_retries: number;
  created_at: string;
}

/**
 * Unified Edge Email Processor
 *
 * This is the primary email processing engine. Benefits:
 * - ~50ms cold start (vs ~250ms+ Node.js)
 * - Runs at edge locations globally
 * - Better concurrency for parallel email sending
 * - Optimal for cron jobs with tight schedules
 *
 * Called by:
 * - Vercel Cron (vercel.json) 
 * - Admin panel (/api/admin/email-queue POST action=process)
 * - External cron services
 * - Database webhooks (on email_queue insert)
 *
 * Uses atomic database functions to prevent race conditions.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const searchParams = request.nextUrl.searchParams;
    const providedSecret =
      authHeader?.replace("Bearer ", "") || 
      searchParams.get("secret") ||
      request.headers.get("x-cron-secret"); // Support multiple auth methods
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 },
      );
    }

    if (!resendKey) {
      return NextResponse.json(
        { error: "Email provider not configured" },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get pending emails using RPC function
    const { data: emails, error: fetchError } = await supabase.rpc(
      "get_pending_emails",
      { p_limit: 10 },
    );

    if (fetchError) {
      console.error("[Edge Queue] Fetch error:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending emails",
        processed: 0,
        duration: Date.now() - startTime,
      });
    }

    const FROM_EMAIL =
      process.env.EMAIL_FROM || "noreply@talk-to-my-lawyer.com";
    const FROM_NAME = process.env.EMAIL_FROM_NAME || "Talk-To-My-Lawyer";

    let successCount = 0;
    let failCount = 0;
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    // Process emails in parallel (edge runtime handles this well)
    const promises = (emails as PendingEmail[]).map(async (email) => {
      const sendStart = Date.now();

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [email.to],
            subject: email.subject,
            html: email.html || undefined,
            text: email.text || undefined,
          }),
        });

        const responseTime = Date.now() - sendStart;

        if (response.ok) {
          // Mark as sent
          await supabase.rpc("mark_email_sent", {
            p_email_id: email.id,
            p_provider: "resend",
            p_response_time_ms: responseTime,
          });
          successCount++;
          results.push({ id: email.id, success: true });
        } else {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `Resend error: ${response.status}`,
          );
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        // Mark as failed (will retry based on attempts)
        await supabase.rpc("mark_email_failed", {
          p_email_id: email.id,
          p_error_message: message,
          p_provider: "resend",
        });
        failCount++;
        results.push({ id: email.id, success: false, error: message });
      }
    });

    await Promise.all(promises);

    return NextResponse.json({
      success: true,
      processed: emails.length,
      sent: successCount,
      failed: failCount,
      results,
      duration: Date.now() - startTime,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Edge Queue] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET for health checks
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const providedSecret = searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      {
        status: "error",
        message: "Database not configured",
      },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get queue stats
  const { data: stats } = await supabase.rpc("get_email_queue_stats");

  return NextResponse.json({
    status: "ok",
    runtime: "edge",
    stats: stats || null,
    timestamp: new Date().toISOString(),
  });
}
