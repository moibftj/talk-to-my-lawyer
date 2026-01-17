import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { authRateLimit, safeApplyRateLimit } from "@/lib/rate-limit-redis";
import { sendTemplateEmail } from "@/lib/email";
import { getServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      authRateLimit,
      5,
      "15 m",
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Parse and validate input first (need accessToken early)
    const body = await request.json();
    const { email, role, fullName, userId, accessToken } = body;

    // Verify user is authenticated - either via session cookie or access token
    const supabase = await createServerClient();
    let user = null;
    let authError = null;

    // Try session-based auth first
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getUser();

    if (!sessionError && sessionData.user) {
      // Session auth succeeded
      user = sessionData.user;
    } else if (accessToken && userId) {
      // Fallback: use access token for immediate post-signup profile creation
      // This handles the race condition where session cookie isn't set yet
      const { createClient } = await import("@supabase/supabase-js");
      const tempClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
          },
        },
      );

      const { data: tokenData, error: tokenError } =
        await tempClient.auth.getUser(accessToken);

      if (!tokenError && tokenData.user && tokenData.user.id === userId) {
        user = tokenData.user;
        console.log(
          "[CreateProfile] Authenticated via access token (post-signup flow)",
        );
      } else {
        authError = tokenError || new Error("Token validation failed");
      }
    } else {
      authError =
        sessionError || new Error("No session or access token provided");
    }

    if (authError || !user) {
      console.error("[CreateProfile] Authentication error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure the userId from the request matches the authenticated user
    if (userId && userId !== user.id) {
      console.error("[CreateProfile] User ID mismatch:", {
        requestUserId: userId,
        authenticatedUserId: user.id,
      });
      return NextResponse.json(
        { error: "Unauthorized: Cannot create profile for another user" },
        { status: 403 },
      );
    }

    // Validate required fields
    if (!email || !fullName) {
      return NextResponse.json(
        { error: "Missing required fields: email, fullName" },
        { status: 400 },
      );
    }

    const requestedRole = role || "subscriber";

    // Prevent role escalation from client requests
    if (requestedRole !== "subscriber") {
      return NextResponse.json(
        { error: "Only subscriber profiles can be created via this endpoint" },
        { status: 403 },
      );
    }

    // Use service role client for profile creation (elevated permissions)
    const serviceClient = getServiceRoleClient();

    // Note: We cast profileInsert to satisfy Supabase's typed client
    // The database has default values for fields not specified here
    const profileInsert = {
      id: user.id,
      email: email.toLowerCase().trim(),
      role: requestedRole,
      full_name: fullName.trim(),
    };

    const { data: profileData, error: profileError } = await serviceClient
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(profileInsert as any, {
        onConflict: "id",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (profileError) {
      console.error("[CreateProfile] Profile creation error:", profileError);
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 },
      );
    }

    // Note: Employee coupon is created automatically by the database trigger
    // (trigger_create_employee_coupon) when profile with role='employee' is inserted.
    // We verify it was created successfully here.
    if (role === "employee") {
      // Wait a moment for trigger to complete, then verify coupon exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: couponData, error: couponCheckError } = (await (
        serviceClient as any
      )
        .from("employee_coupons")
        .select("code")
        .eq("employee_id", user.id)
        .single()) as { data: { code: string } | null; error: Error | null };

      if (couponCheckError || !couponData) {
        // Trigger may have failed - create coupon manually as fallback
        console.warn(
          "[CreateProfile] Coupon not found after trigger, creating manually...",
        );
        const couponCode = `EMP-${user.id.slice(0, 6).toUpperCase()}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
        const couponInsert = {
          employee_id: user.id,
          code: couponCode,
          discount_percent: 20,
          is_active: true,
        };
        const { error: couponInsertError } = await serviceClient
          .from("employee_coupons")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(couponInsert as any);

        if (couponInsertError) {
          console.error(
            "[CreateProfile] Fallback coupon creation failed:",
            couponInsertError,
          );
        } else {
          console.log("[CreateProfile] Fallback coupon created:", couponCode);
        }
      } else {
        console.log(
          "[CreateProfile] Employee coupon verified:",
          couponData.code,
        );
      }
    }

    console.log("[CreateProfile] Profile created successfully", {
      userId: user.id,
      email,
      role,
    });

    // Send welcome email directly (not queued) for immediate delivery
    sendTemplateEmail("welcome", email, {
      userName: fullName.split(" ")[0], // First name
      actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://talk-to-my-lawyer.com"}/dashboard`,
    })
      .then((result) => {
        if (result.success) {
          console.log(
            "[CreateProfile] Welcome email sent successfully:",
            result.messageId,
          );
        } else {
          console.error("[CreateProfile] Welcome email failed:", result.error);
        }
      })
      .catch((error) => {
        console.error("[CreateProfile] Failed to send welcome email:", error);
        // Don't fail the request if email sending fails
      });

    return NextResponse.json({
      success: true,
      profile: profileData,
      message: "Profile created successfully",
    });
  } catch (error: any) {
    console.error("[CreateProfile] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
