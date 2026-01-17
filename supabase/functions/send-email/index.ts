// Supabase Edge Function for sending emails via Resend API
// https://supabase.com/docs/guides/functions/examples/send-emails

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ||
  "Talk-To-My-Lawyer <noreply@talk-to-my-lawyer.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  template?: string;
  templateData?: Record<string, unknown>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// HTML escape utility for templates
function escapeHtml(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return "";
  const str = String(text);
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

// Base email template wrapper
function wrapHtml(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .highlight { background: #f0f9ff; padding: 15px; border-left: 4px solid #0284c7; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Talk-To-My-Lawyer</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p><strong>Talk-To-My-Lawyer</strong> | Professional Legal Letter Services</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

// Email templates
const templates: Record<
  string,
  (
    data: Record<string, unknown>,
  ) => { subject: string; html: string; text: string }
> = {
  "welcome": (data) => ({
    subject: "Welcome to Talk-To-My-Lawyer!",
    html: wrapHtml(`
      <h2>Welcome, ${escapeHtml(data.userName as string)}!</h2>
      <p>Thank you for joining Talk-To-My-Lawyer. We're excited to help you with your legal correspondence needs.</p>
      <p>With our service, you can:</p>
      <ul>
        <li>Generate professional legal letters with AI assistance</li>
        <li>Have your letters reviewed by qualified attorneys</li>
        <li>Download and send your approved letters</li>
      </ul>
      <a href="${
      escapeHtml(data.actionUrl as string)
    }" class="button">Go to Dashboard</a>
    `),
    text:
      `Welcome, ${data.userName}!\n\nThank you for joining Talk-To-My-Lawyer.\n\nVisit your dashboard: ${data.actionUrl}`,
  }),

  "letter-approved": (data) => ({
    subject: "Your Letter Has Been Approved!",
    html: wrapHtml(`
      <h2>Great News!</h2>
      <p>Your legal letter "${
      escapeHtml(data.letterTitle as string)
    }" has been approved and is ready for download.</p>
      <div class="highlight">
        <strong>Letter Type:</strong> ${
      escapeHtml(data.letterType as string)
    }<br>
        <strong>Reviewed by:</strong> Attorney
      </div>
      <a href="${
      escapeHtml(data.actionUrl as string)
    }" class="button">View Your Letter</a>
    `),
    text:
      `Your letter "${data.letterTitle}" has been approved!\n\nView your letter: ${data.actionUrl}`,
  }),

  "letter-rejected": (data) => ({
    subject: "Letter Requires Revisions",
    html: wrapHtml(`
      <h2>Revision Required</h2>
      <p>Your legal letter "${
      escapeHtml(data.letterTitle as string)
    }" requires some revisions before approval.</p>
      <div class="highlight">
        <strong>Feedback:</strong><br>
        ${escapeHtml(data.reason as string)}
      </div>
      <a href="${
      escapeHtml(data.actionUrl as string)
    }" class="button">Edit Your Letter</a>
    `),
    text:
      `Your letter "${data.letterTitle}" requires revisions.\n\nFeedback: ${data.reason}\n\nEdit your letter: ${data.actionUrl}`,
  }),

  "payment-success": (data) => ({
    subject: "Payment Confirmed - Talk-To-My-Lawyer",
    html: wrapHtml(`
      <h2>Payment Successful!</h2>
      <p>Thank you for your purchase. Your subscription is now active.</p>
      <div class="highlight">
        <strong>Plan:</strong> ${escapeHtml(data.planName as string)}<br>
        <strong>Amount:</strong> $${escapeHtml(data.amount as string)}<br>
        <strong>Letters:</strong> ${escapeHtml(data.letters as string)} credits
      </div>
      <a href="${
      escapeHtml(data.actionUrl as string)
    }" class="button">Start Creating Letters</a>
    `),
    text:
      `Payment successful!\n\nPlan: ${data.planName}\nAmount: $${data.amount}\n\nStart creating: ${data.actionUrl}`,
  }),

  "commission-earned": (data) => ({
    subject: "You Earned a Commission!",
    html: wrapHtml(`
      <h2>Commission Earned! 🎉</h2>
      <p>Great news! Someone used your referral code and you've earned a commission.</p>
      <div class="highlight">
        <strong>Commission Amount:</strong> $${
      escapeHtml(data.amount as string)
    }<br>
        <strong>Referral Code:</strong> ${escapeHtml(data.couponCode as string)}
      </div>
      <a href="${
      escapeHtml(data.actionUrl as string)
    }" class="button">View Commissions</a>
    `),
    text:
      `You earned a commission of $${data.amount}!\n\nView your commissions: ${data.actionUrl}`,
  }),
};

async function sendEmail(request: EmailRequest): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    console.error("[SendEmail] RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  let emailBody: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
  };

  // Use template if specified
  if (request.template && templates[request.template]) {
    const templateFn = templates[request.template];
    const rendered = templateFn(request.templateData || {});
    emailBody = {
      to: request.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    };
  } else {
    emailBody = {
      to: request.to,
      subject: request.subject,
      html: request.html,
      text: request.text,
    };
  }

  console.log("[SendEmail] Sending email:", {
    to: emailBody.to,
    subject: emailBody.subject,
    from: request.from || EMAIL_FROM,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: request.from || EMAIL_FROM,
        to: emailBody.to,
        subject: emailBody.subject,
        html: emailBody.html,
        text: emailBody.text,
        reply_to: request.replyTo,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[SendEmail] Resend API error:", data);
      return { success: false, error: data.message || "Failed to send email" };
    }

    console.log("[SendEmail] Email sent successfully:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("[SendEmail] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Initialize Supabase client with service role for verification
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the JWT token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      token,
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const emailRequest: EmailRequest = await req.json();

    // Validate required fields
    if (!emailRequest.to) {
      return new Response(
        JSON.stringify({ error: "Missing required field: to" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (
      !emailRequest.template && (!emailRequest.subject || !emailRequest.html)
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: subject and html (or use template)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Send the email
    const result = await sendEmail(emailRequest);

    // Log to database for audit trail
    await supabase.from("email_queue").insert({
      user_id: user.id,
      to_email: Array.isArray(emailRequest.to)
        ? emailRequest.to[0]
        : emailRequest.to,
      subject: emailRequest.subject || `Template: ${emailRequest.template}`,
      template_name: emailRequest.template || "custom",
      status: result.success ? "sent" : "failed",
      sent_at: result.success ? new Date().toISOString() : null,
      error_message: result.error || null,
      metadata: { messageId: result.messageId },
    }).then(({ error }) => {
      if (error) console.error("[SendEmail] Failed to log email:", error);
    });

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[SendEmail] Handler error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
