import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { authenticateUser } from "@/lib/auth/authenticate-user";
import {
  subscriptionRateLimit,
  safeApplyRateLimit,
} from "@/lib/rate-limit-redis";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import { getRateLimitTuple } from "@/lib/config";
import {
  successResponse,
  errorResponses,
  handleApiError,
} from "@/lib/api/api-error-handler";
import { COMMISSION_RATE } from "@/lib/constants/business";

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      subscriptionRateLimit,
      ...getRateLimitTuple("PAYMENT_VERIFY"),
    );
    if (rateLimitResponse) return rateLimitResponse;

    const authResult = await authenticateUser();
    if (!authResult.authenticated || !authResult.user) {
      return authResult.errorResponse!;
    }
    const user = authResult.user;

    const { sessionId } = await request.json();

    if (!sessionId) {
      return errorResponses.badRequest("Session ID required");
    }

    const stripe = await getStripeClient();
    const supabase = getServiceRoleClient();

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return errorResponses.badRequest("Payment not completed");
    }

    if (
      session.client_reference_id &&
      session.client_reference_id !== user.id
    ) {
      return errorResponses.forbidden("Session does not belong to this user");
    }

    const metadata = session.metadata || {};
    const userId = user.id;
    const planType = metadata.plan_type;

    if (!metadata.user_id || metadata.user_id !== user.id) {
      return errorResponses.forbidden("Session metadata invalid for this user");
    }

    if (!planType) {
      return errorResponses.badRequest("Missing session metadata");
    }

    const letters = parseInt(metadata.letters ?? "0");
    const basePrice = parseFloat(metadata.base_price ?? "0");
    const discount = parseFloat(metadata.discount ?? "0");
    const finalPrice = parseFloat(metadata.final_price ?? "0");
    const couponCode = metadata.coupon_code || null;
    const employeeId = metadata.employee_id || null;

    // Use improved atomic RPC that handles all race conditions internally
    const { data: atomicResult, error: atomicError } = await (
      supabase as any
    ).rpc("verify_and_complete_subscription", {
      p_user_id: userId,
      p_stripe_session_id: sessionId,
      p_stripe_customer_id: (session.customer as string) || null,
      p_plan_type: planType,
      p_monthly_allowance: letters,
      p_total_letters: letters,
      p_final_price: finalPrice,
      p_base_price: basePrice,
      p_discount_amount: discount,
      p_coupon_code: couponCode,
      p_employee_id: employeeId,
      p_commission_rate: COMMISSION_RATE,
    });

    if (atomicError) {
      console.error(
        "[Verify Payment] Atomic subscription verification failed:",
        atomicError,
      );
      throw new Error(`Failed to verify subscription: ${atomicError.message}`);
    }

    if (!atomicResult || !atomicResult[0]?.success) {
      const errorMsg = atomicResult?.[0]?.error_message || "Unknown error";
      console.error(
        "[Verify Payment] Atomic subscription verification returned error:",
        errorMsg,
      );
      throw new Error(`Failed to verify subscription: ${errorMsg}`);
    }

    const result = atomicResult[0];
    const alreadyCompleted = result.already_completed || false;

    return successResponse({
      subscriptionId: result.subscription_id,
      letters: letters,
      message: alreadyCompleted
        ? "Subscription already activated by webhook"
        : "Subscription activated successfully",
    });
  } catch (error) {
    return handleApiError(error, "Verify Payment");
  }
}
