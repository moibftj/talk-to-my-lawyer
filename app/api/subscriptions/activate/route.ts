import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/lib/constants";
import {
  subscriptionRateLimit,
  safeApplyRateLimit,
} from "@/lib/rate-limit-redis";
import { getRateLimitTuple } from "@/lib/config";
import { handleApiError } from "@/lib/api/api-error-handler";

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      subscriptionRateLimit,
      ...getRateLimitTuple("CHECKOUT_CREATE"),
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { subscriptionId, planType } = body;

    if (!subscriptionId || !planType) {
      return NextResponse.json(
        { error: "Missing subscriptionId or planType" },
        { status: 400 },
      );
    }

    // Verify subscription belongs to user
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .eq("user_id", user.id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }

    // SECURITY: Only allow activating subscriptions that went through payment
    // Must be in 'trialing' status (set during checkout) — not already active
    if (subscription.status === "active") {
      return NextResponse.json({
        message: "Subscription is already active",
        subscriptionId,
      });
    }

    if (subscription.status !== "trialing") {
      return NextResponse.json(
        { error: "Subscription cannot be activated — payment not verified" },
        { status: 403 },
      );
    }

    // Verify a Stripe session/customer exists (payment went through)
    const stripeSessionId = (subscription as any).stripe_session_id;
    const stripeCustomerId = (subscription as any).stripe_customer_id;
    if (!stripeSessionId && !stripeCustomerId) {
      return NextResponse.json(
        { error: "No payment record found for this subscription" },
        { status: 403 },
      );
    }

    const selectedPlan = PLAN_CONFIG[planType];
    if (!selectedPlan) {
      return NextResponse.json({ error: "Invalid planType" }, { status: 400 });
    }

    // Update subscription status and allowances
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        credits_remaining: selectedPlan.letters,
        remaining_letters: selectedPlan.letters,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (updateError) {
      console.error("[ActivateSubscription] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to activate subscription" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Subscription activated successfully",
      subscriptionId,
    });
  } catch (error) {
    return handleApiError(error, "ActivateSubscription");
  }
}
