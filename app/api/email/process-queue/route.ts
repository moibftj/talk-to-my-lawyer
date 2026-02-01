import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/middleware/cron-auth";

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
  const clientIP = request.headers.get("x-forwarded-for") || "unknown";

  try {
    // Rate limiting: Max 60 requests per minute per IP
    const rateLimitKey = `email_queue:${clientIP}`;
    const maxRequests = 60;
    const windowMs = 60 * 1000; // 1 minute

    // Simple rate limiting using timestamp check
    const now = Date.now();
    const rateLimitData = request.headers.get("x-rate-limit-bypass");

    if (!rateLimitData) {
      // Skip rate limiting for now in Edge runtime, implement if needed
      console.log(`[Edge Queue] Processing from IP: ${clientIP}`);
    }
    // Verify cron secret
    const authError = verifyCronAuth(request);
    if (authError) return authError;

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

    const supabase = getServiceRoleClient();

    // Get processing parameters from request body (if any)
    let batchSize = 10; // Default
    let forceProcessing = false;

    try {
      const body = await request.json().catch(() => ({}));
      batchSize = Math.min(body.batchSize || 10, 50); // Max 50 emails per batch
      forceProcessing = body.force === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Get pending emails using RPC function with batch size
    const { data: emails, error: fetchError } = await supabase.rpc(
      "get_pending_emails",
      batchSize,
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
          await (supabase as any).rpc("mark_email_sent", {
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
        await (supabase as any).rpc("mark_email_failed", {
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
      batchSize,
      timestamp: new Date().toISOString(),
      runtime: "edge",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const duration = Date.now() - startTime;

    console.error("[Edge Queue] Critical error:", {
      error: message,
      duration,
      clientIP,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: message,
        duration,
        runtime: "edge",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// GET for health checks
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const supabase = getServiceRoleClient();

  // Get queue stats
  const { data: stats } = await (supabase as any).rpc("get_email_queue_stats");

  return NextResponse.json({
    status: "ok",
    runtime: "edge",
    stats: stats || null,
    timestamp: new Date().toISOString(),
  });
}
