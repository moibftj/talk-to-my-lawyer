import Stripe from "stripe";

const STRIPE_API_VERSION = "2025-08-27.basil" as any;

/**
 * Get Stripe secret key from environment variables
 */
export function getStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error(
      "[Stripe] STRIPE_SECRET_KEY is not configured. Set it in your environment variables.",
    );
  }
  return secretKey;
}

/**
 * Get Stripe publishable key from environment variables
 */
export function getStripePublishableKey(): string {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    throw new Error(
      "[Stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured. Set it in your environment variables.",
    );
  }
  return publishableKey;
}

/**
 * Get configured Stripe client instance
 */
export function getStripeClient(): Stripe {
  const secretKey = getStripeSecretKey();
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
}
