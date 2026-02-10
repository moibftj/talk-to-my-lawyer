import { NextRequest, NextResponse } from "next/server";
import { sendTemplateEmail } from "@/lib/email";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import { authRateLimit, safeApplyRateLimit } from "@/lib/rate-limit-redis";
import { getRateLimitTuple } from "@/lib/config";
import { handleApiError } from "@/lib/api/api-error-handler";

/**
 * API endpoint to resend confirmation emails via Resend
 *
 * This is useful when:
 * 1. User didn't receive the original confirmation email
 * 2. Supabase's default SMTP is not working
 * 3. You want to use custom email templates
 */

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      authRateLimit,
      ...getRateLimitTuple("AUTH_PASSWORD_RESET"),
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Create Supabase admin client
    const supabase = getServiceRoleClient();

    // Look up user directly by email from profiles table (no iteration needed)
    const { data: profile, error: profileError } = await (supabase as any)
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", email.toLowerCase())
      .single();

    if (profileError || !profile) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message:
          "If an account exists with this email, a confirmation link will be sent.",
      });
    }

    // Get the auth user to check confirmation status
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(profile.id);

    if (userError || !user) {
      return NextResponse.json({
        success: true,
        message:
          "If an account exists with this email, a confirmation link will be sent.",
      });
    }

    // Check if already confirmed
    if (user.email_confirmed_at) {
      return NextResponse.json({
        success: true,
        message: "This email is already confirmed. You can log in.",
        alreadyConfirmed: true,
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://www.talk-to-my-lawyer.com";

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: user.email!,
        options: {
          redirectTo: `${baseUrl}/dashboard`,
        },
      } as any);

    if (linkError) {
      console.error("[ResendConfirmation] Error generating link:", linkError);
      return NextResponse.json(
        { error: "Failed to generate confirmation link" },
        { status: 500 },
      );
    }

    // Send confirmation email via Resend
    const confirmationUrl =
      linkData.properties?.action_link ||
      `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?token=${linkData.properties?.hashed_token}`;

    const result = await sendTemplateEmail("email-confirmation", user.email!, {
      userName: user.user_metadata?.full_name?.split(" ")[0] || "there",
      actionUrl: confirmationUrl,
    });

    if (result.success) {
      console.log("[ResendConfirmation] Confirmation email sent:", {
        to: user.email,
        messageId: result.messageId,
      });

      return NextResponse.json({
        success: true,
        message:
          "Confirmation email sent successfully. Please check your inbox.",
      });
    } else {
      console.error("[ResendConfirmation] Failed to send email:", result.error);
      return NextResponse.json(
        { error: "Failed to send confirmation email" },
        { status: 500 },
      );
    }
  } catch (error) {
    return handleApiError(error, "ResendConfirmation");
  }
}
