import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/**
 * Vercel Edge Function for immediate email sending
 * This bypasses the queue for time-sensitive emails
 *
 * Uses Edge Runtime for:
 * - Faster cold starts (~50ms vs ~250ms)
 * - Global distribution
 * - Lower latency
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal service key
    const authHeader = request.headers.get("authorization");
    const serviceKey = process.env.INTERNAL_SERVICE_KEY;

    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, subject, html, text } = body;

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, and html or text" },
        { status: 400 },
      );
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 },
      );
    }

    const FROM_EMAIL =
      process.env.EMAIL_FROM || "noreply@talk-to-my-lawyer.com";
    const FROM_NAME = process.env.EMAIL_FROM_NAME || "Talk-To-My-Lawyer";

    // Send via Resend
    const startTime = Date.now();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Edge Email] Resend error:", errorData);
      return NextResponse.json(
        { error: errorData.message || "Failed to send email" },
        { status: response.status },
      );
    }

    const result = await response.json();

    // Log delivery to database (non-blocking)
    logDelivery(to, subject, responseTime).catch(console.error);

    return NextResponse.json({
      success: true,
      messageId: result.id,
      responseTime,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Edge Email] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function logDelivery(to: string, subject: string, responseTime: number) {
  const supabase = getServiceRoleClient();

  await supabase.from("email_delivery_log").insert({
    recipient_email: Array.isArray(to) ? to.join(",") : to,
    subject,
    provider: "resend",
    status: "sent",
    response_time_ms: responseTime,
  });
}
