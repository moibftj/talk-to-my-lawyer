import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminCredentials,
  type AdminSubRole,
} from "@/lib/auth/admin-session";
import { adminRateLimit, safeApplyRateLimit } from "@/lib/rate-limit-redis";
import { getRateLimitTuple } from "@/lib/config";
import { createSessionToken, getJWTSecret } from "@/lib/security/jwt";

const SESSION_EXPIRY_MINUTES = 30;

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      adminRateLimit,
      ...getRateLimitTuple("AUTH_LOGIN"),
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { email, password, intendedRole } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const result = await verifyAdminCredentials(email, password);

    if (!result.success) {
      console.warn("[AdminAuth] Failed login attempt:", {
        email,
        timestamp: new Date().toISOString(),
        error: result.error,
      });

      return NextResponse.json(
        { error: result.error || "Authentication failed" },
        { status: 401 },
      );
    }

    const subRole: AdminSubRole = result.subRole || "super_admin";

    // Validate intended role matches actual role
    if (intendedRole && intendedRole !== subRole) {
      console.warn("[AdminAuth] Role mismatch:", {
        email,
        intendedRole,
        actualRole: subRole,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          error: `You do not have ${intendedRole === "super_admin" ? "Super Admin" : "Attorney Admin"} access. Your role is ${subRole === "super_admin" ? "Super Admin" : "Attorney Admin"}.`,
        },
        { status: 403 },
      );
    }

    const secret = getJWTSecret();
    const token = createSessionToken(
      result.userId!,
      email,
      subRole,
      SESSION_EXPIRY_MINUTES,
      secret,
    );

    const redirectUrl =
      subRole === "attorney_admin"
        ? "/attorney-portal/review"
        : "/secure-admin-gateway/dashboard";

    console.log("[AdminAuth] Admin authenticated, issuing token:", {
      userId: result.userId,
      email,
      subRole,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Admin authentication successful",
      redirectUrl,
      subRole,
      token,
    });
  } catch (error) {
    console.error("[AdminAuth] Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
