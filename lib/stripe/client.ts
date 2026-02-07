import Stripe from 'stripe'

const STRIPE_API_VERSION = '2025-08-27.basil' as any

export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    throw new Error('[Stripe] STRIPE_SECRET_KEY environment variable is not set')
  }
  return key
}

export function getStripePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  if (!key) {
    throw new Error('[Stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable is not set')
  }
  return key
}

export function getStripeClient(): Stripe {
  const secretKey = getStripeSecretKey()
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  })
}
