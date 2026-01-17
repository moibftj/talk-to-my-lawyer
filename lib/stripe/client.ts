import Stripe from 'stripe'

/**
 * Sanitizes the Stripe API key by removing common invalid characters
 * that can occur when copying from environment files or dashboards
 */
function sanitizeStripeKey(key: string | undefined): string | undefined {
  if (!key) return undefined

  return key
    .trim() // Remove leading/trailing whitespace
    .replace(/^['"]|['"]$/g, '') // Remove surrounding quotes
    .replace(/\r?\n|\r/g, '') // Remove newlines
}

/**
 * Gets the sanitized Stripe secret key from environment variables
 */
export function getStripeSecretKey(): string | undefined {
  return sanitizeStripeKey(process.env.STRIPE_SECRET_KEY)
}

/**
 * Gets the sanitized Stripe publishable key from environment variables
 */
export function getStripePublishableKey(): string | undefined {
  return sanitizeStripeKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
}

/**
 * Creates a Stripe client with a sanitized API key
 * Returns null if the key is missing or invalid
 */
export function createStripeClient(): Stripe | null {
  const apiKey = getStripeSecretKey()

  if (!apiKey) {
    console.warn('[Stripe] STRIPE_SECRET_KEY is not configured')
    return null
  }

  // Validate key format (Stripe keys start with sk_test_ or sk_live_)
  if (!apiKey.match(/^sk_test_\w+|^sk_live_\w+/)) {
    console.error('[Stripe] Invalid Stripe API key format. Key should start with sk_test_ or sk_live_')
    return null
  }

  try {
    return new Stripe(apiKey, {
      apiVersion: '2025-12-15.clover',
    })
  } catch (error) {
    console.error('[Stripe] Failed to initialize Stripe client:', error)
    return null
  }
}

let stripeInstance: Stripe | null = null

/**
 * Gets the singleton Stripe client instance
 * Use this instead of createStripeClient for better performance
 */
export function getStripeClient(): Stripe | null {
  if (!stripeInstance) {
    stripeInstance = createStripeClient()
  }
  return stripeInstance
}
