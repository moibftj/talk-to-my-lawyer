import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { queueTemplateEmail } from "@/lib/email/service";
import { getStripeClient } from "@/lib/stripe/client";
import { getServiceRoleClient } from "@/lib/supabase/admin";
import { COMMISSION_RATE } from "@/lib/constants/business";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    console.error("[StripeWebhook] No signature");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error(
        "[StripeWebhook] STRIPE_WEBHOOK_SECRET not set - cannot verify webhook",
      );
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 },
      );
    }

    const stripe = await getStripeClient();
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    console.log("[StripeWebhook] Event received:", event.type);

    const supabase = getServiceRoleClient();

    const { data: idempotencyCheck, error: idempotencyError } = await (
      supabase as any
    ).rpc("check_and_record_webhook", {
      p_stripe_event_id: event.id,
      p_event_type: event.type,
      p_metadata: event.created
        ? {
            created: event.created,
            api_version: event.api_version,
          }
        : null,
    });

    if (idempotencyError) {
      console.error(
        "[StripeWebhook] Idempotency check failed:",
        idempotencyError,
      );
    } else {
      const checkResult = idempotencyCheck?.[0];
      if (checkResult && checkResult.already_processed === true) {
        console.log(
          "[StripeWebhook] Event already processed, skipping:",
          event.id,
        );
        return NextResponse.json({ received: true, already_processed: true });
      }
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status !== "paid") {
          console.log("[StripeWebhook] Payment not completed, skipping");
          return NextResponse.json({ received: true });
        }

        const metadata = session.metadata;
        if (!metadata) {
          console.error("[StripeWebhook] No metadata in session");
          return NextResponse.json({ error: "No metadata" }, { status: 400 });
        }

        const letters = parseInt(metadata.letters || "0");
        const finalPrice = parseFloat(metadata.final_price || "0");
        const basePrice = parseFloat(metadata.base_price || "0");
        const discount = parseFloat(metadata.discount || "0");
        const couponCode = metadata.coupon_code || null;
        const employeeId = metadata.employee_id || null;

        const { data: atomicResult, error: atomicError } = await (
          supabase as any
        ).rpc("verify_and_complete_subscription", {
          p_user_id: metadata.user_id,
          p_stripe_session_id: session.id,
          p_stripe_customer_id: session.customer as string,
          p_plan_type: metadata.plan_type || "unknown",
          p_monthly_allowance: letters,
          p_total_letters: letters,
          p_final_price: finalPrice,
          p_base_price: basePrice,
          p_discount_amount: discount,
          p_coupon_code: couponCode,
          p_employee_id: employeeId,
          p_commission_rate: COMMISSION_RATE,
        });

        if (atomicError || !atomicResult || !atomicResult[0]?.success) {
          console.error(
            "[StripeWebhook] Atomic subscription completion failed:",
            atomicError,
          );
        } else {
          const result = atomicResult[0];
          const alreadyCompleted = result.already_completed || false;
          console.log(
            "[StripeWebhook] Subscription completed atomically:",
            result.subscription_id,
            alreadyCompleted ? "(already completed by verify-payment)" : "",
          );

          if (result.commission_id && employeeId && !alreadyCompleted) {
            const { data: employeeProfile } = await supabase
              .from("profiles")
              .select("email, full_name")
              .eq("id", employeeId)
              .single();

            if ((employeeProfile as any)?.email) {
              const commissionAmount = finalPrice * COMMISSION_RATE;
              queueTemplateEmail(
                "commission-earned",
                (employeeProfile as any).email,
                {
                  userName: (employeeProfile as any).full_name || "there",
                  commissionAmount: commissionAmount,
                  actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard/commissions`,
                },
              ).catch((error: unknown) => {
                console.error(
                  "[StripeWebhook] Failed to send commission email:",
                  error,
                );
              });
            }
          }
        }

        console.log(
          "[StripeWebhook] Payment completed for user:",
          metadata.user_id,
        );

        const { data: userProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", metadata.user_id)
          .single();

        if ((userProfile as any)?.email) {
          const planName = metadata.plan_type || "Subscription";
          queueTemplateEmail(
            "subscription-confirmation",
            (userProfile as any).email,
            {
              userName: (userProfile as any).full_name || "there",
              subscriptionPlan: planName,
              actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard`,
            },
          ).catch((error) => {
            console.error(
              "[StripeWebhook] Failed to send subscription confirmation email:",
              error,
            );
          });
        }

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata;

        if (metadata) {
          await (supabase as any)
            .from("subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", metadata.user_id)
            .eq("status", "trialing");

          console.log(
            "[StripeWebhook] Checkout expired for user:",
            metadata.user_id,
          );
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("[StripeWebhook] Payment succeeded:", paymentIntent.id);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("[StripeWebhook] Payment failed:", paymentIntent.id);

        if (paymentIntent.metadata?.user_id) {
          await (supabase as any)
            .from("subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", paymentIntent.metadata.user_id)
            .eq("status", "trialing");
        }
        break;
      }

      default: {
        console.log(`[StripeWebhook] Unhandled event type: ${event.type}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[StripeWebhook] Error:", err.message);

    if (err.type === "StripeSignatureVerificationError") {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
