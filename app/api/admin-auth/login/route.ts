import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminRateLimit, safeApplyRateLimit } from "@/lib/rate-limit-redis";
import { getRateLimitTuple } from "@/lib/config";

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
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Standard Supabase auth - no custom JWT, no portal ID, no session key
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      console.warn("[AdminAuth] Failed login attempt:", {
        email,
        timestamp: new Date().toISOString(),
        error: authError?.message,
      });
      return NextResponse.json(
        { error: authError?.message || "Authentication failed" },
        { status: 401 },
      );
    }

    // Verify admin role from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, admin_sub_role, full_name")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 },
      );
    }

    if (profile.role !== "admin") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Access denied. Administrator privileges required." },
        { status: 403 },
      );
    }

    const subRole = profile.admin_sub_role || "super_admin";
    const redirectUrl =
      subRole === "attorney_admin"
        ? "/attorney-portal/review"
        : "/secure-admin-gateway/dashboard";

    console.log("[AdminAuth] Admin authenticated:", {
      userId: profile.id,
      email,
      subRole,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Admin authentication successful",
      redirectUrl,
      subRole,
    });
  } catch (error) {
    console.error("[AdminAuth] Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
