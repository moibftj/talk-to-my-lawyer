/**
 * Profile Creation API
 *
 * Creates user profiles after signup.
 * Handles both session-based and access token authentication (for post-signup flow).
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { authRateLimit, safeApplyRateLimit } from "@/lib/rate-limit-redis";
import {
  successResponse,
  errorResponses,
  handleApiError,
  ValidationError,
} from "@/lib/api/api-error-handler";
import { sendTemplateEmail } from "@/lib/email";
import { db } from "@/lib/db/client-factory";

// ============================================================================
// Types
// ============================================================================

interface CreateProfileBody {
  email: string;
  fullName: string;
  role?: string;
  userId?: string;
  accessToken?: string;
}

interface AuthResult {
  user: User;
  method: "session" | "access_token";
}

// ============================================================================
// Auth Helper
// ============================================================================

/**
 * Authenticate user via session cookie or access token fallback.
 * Access token auth handles the race condition where session cookie isn't set
 * immediately after signup.
 */
async function authenticateRequest(
  body: CreateProfileBody,
): Promise<AuthResult | null> {
  const { userId, accessToken } = body;
  const supabase = await db.server();

  // Try session-based auth first
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getUser();

  if (!sessionError && sessionData.user) {
    return { user: sessionData.user, method: "session" };
  }

  // Fallback: access token for immediate post-signup profile creation
  if (accessToken && userId) {
    const tempClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: tokenData, error: tokenError } =
      await tempClient.auth.getUser(accessToken);

    if (!tokenError && tokenData.user && tokenData.user.id === userId) {
      console.log("[CreateProfile] Authenticated via access token");
      return { user: tokenData.user, method: "access_token" };
    }
  }

  console.error(
    "[CreateProfile] Authentication failed:",
    sessionError?.message,
  );
  return null;
}

// ============================================================================
// Validation
// ============================================================================

function validateInput(body: CreateProfileBody): void {
  const errors: Array<{ field: string; message: string }> = [];

  if (!body.email?.trim()) {
    errors.push({ field: "email", message: "Email is required" });
  }
  if (!body.fullName?.trim()) {
    errors.push({ field: "fullName", message: "Full name is required" });
  }

  if (errors.length > 0) {
    throw new ValidationError("Missing required fields", errors);
  }
}

// ============================================================================
// Business Logic
// ============================================================================

async function createProfile(userId: string, email: string, fullName: string) {
  const serviceClient = db.serviceRole();

  const { data, error } = await (serviceClient as any)
    .from("profiles")
    .upsert(
      {
        id: userId,
        email: email.toLowerCase().trim(),
        role: "subscriber",
        full_name: fullName.trim(),
      },
      { onConflict: "id", ignoreDuplicates: false },
    )
    .select()
    .single();

  if (error) {
    console.error("[CreateProfile] Profile creation error:", error);
    throw new Error("Failed to create profile");
  }

  return data;
}

function sendWelcomeEmail(email: string, fullName: string): void {
  const firstName = fullName.split(" ")[0];
  const dashboardUrl = `${
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://talk-to-my-lawyer.com"
  }/dashboard`;

  // Fire-and-forget: don't block response on email delivery
  sendTemplateEmail("welcome", email, {
    userName: firstName,
    actionUrl: dashboardUrl,
  })
    .then((result) => {
      if (result.success) {
        console.log("[CreateProfile] Welcome email sent:", result.messageId);
      } else {
        console.error("[CreateProfile] Welcome email failed:", result.error);
      }
    })
    .catch((error) => {
      console.error("[CreateProfile] Welcome email error:", error);
    });
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      authRateLimit,
      5,
      "15 m",
    );
    if (rateLimitResponse) return rateLimitResponse;

    // 2. Parse request
    const body: CreateProfileBody = await request.json();

    // 3. Authenticate
    const auth = await authenticateRequest(body);
    if (!auth) {
      return errorResponses.unauthorized();
    }

    // 4. Verify user ID matches (if provided)
    if (body.userId && body.userId !== auth.user.id) {
      console.error("[CreateProfile] User ID mismatch:", {
        requested: body.userId,
        authenticated: auth.user.id,
      });
      return errorResponses.forbidden("Cannot create profile for another user");
    }

    // 5. Validate input
    validateInput(body);

    // 6. Prevent role escalation - only subscribers via this endpoint
    if (body.role && body.role !== "subscriber") {
      return errorResponses.forbidden(
        "Only subscriber profiles can be created via this endpoint",
      );
    }

    // 7. Create profile
    const profile = await createProfile(
      auth.user.id,
      body.email,
      body.fullName,
    );

    console.log("[CreateProfile] Success:", {
      userId: auth.user.id,
      email: body.email,
    });

    // 8. Send welcome email (non-blocking)
    sendWelcomeEmail(body.email, body.fullName);

    return successResponse({
      success: true,
      profile,
      message: "Profile created successfully",
    });
  } catch (error) {
    return handleApiError(error, "CreateProfile");
  }
}
