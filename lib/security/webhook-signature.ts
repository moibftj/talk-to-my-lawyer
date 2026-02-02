/**
 * Webhook Signature Verification Utilities
 * Provides HMAC signature verification for incoming webhooks
 *
 * This ensures webhooks are actually from the expected service
 * and haven't been tampered with in transit.
 */

import { createHmac, timingSafeEqual } from 'crypto'

export interface WebhookSignatureVerificationResult {
  valid: boolean
  error?: string
}

/**
 * Verify an HMAC signature from a webhook
 *
 * This is the industry-standard approach for webhook security:
 * - Service sends payload + HMAC signature
 * - We re-compute HMAC using shared secret
 * - timingSafeEqual prevents timing attacks
 *
 * @param signature - The signature from request header (e.g., "sha256=abc123...")
 * @param payload - The raw request body as string
 * @param secret - The shared secret used to compute HMAC
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns Verification result
 */
export function verifyWebhookSignature(
  signature: string | null,
  payload: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' | 'sha1' = 'sha256'
): WebhookSignatureVerificationResult {
  // Check signature exists
  if (!signature) {
    return { valid: false, error: 'Missing signature header' }
  }

  try {
    // Remove algorithm prefix if present (e.g., "sha256=")
    const signatureBytes = Buffer.from(
      signature.includes('=') ? signature.split('=')[1] : signature,
      'hex'
    )

    // Compute HMAC of payload
    const hmac = createHmac(algorithm, secret)
    hmac.update(payload, 'utf8')
    const digest = hmac.digest('hex')
    const digestBytes = Buffer.from(digest, 'hex')

    // Verify signatures have same length
    if (signatureBytes.length !== digestBytes.length) {
      return { valid: false, error: 'Invalid signature length' }
    }

    // Constant-time comparison prevents timing attacks
    const isValid = timingSafeEqual(signatureBytes, digestBytes)

    if (!isValid) {
      return { valid: false, error: 'Signature verification failed' }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: `Signature verification error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Verify webhook with environment-based secret lookup
 *
 * Helper that reads secret from environment and verifies signature.
 * Returns null for verification failure (to allow graceful fallback).
 *
 * @param signature - The signature from request header
 * @param payload - The raw request body as string
 * @param secretEnvVar - Name of environment variable containing the secret
 * @param requireInProd - Fail if secret is missing in production (default: true)
 * @returns Verification result, or null if secret not configured (in dev)
 */
export function verifyWebhookSignatureFromEnv(
  signature: string | null,
  payload: string,
  secretEnvVar: string,
  requireInProd: boolean = true
): WebhookSignatureVerificationResult | null {
  const secret = process.env[secretEnvVar]
  const isProduction = process.env.NODE_ENV === 'production'

  // Handle missing secret
  if (!secret) {
    if (isProduction && requireInProd) {
      return {
        valid: false,
        error: `Webhook secret not configured: ${secretEnvVar} must be set in production`
      }
    }

    // Allow unsigned requests in development
    console.warn(
      `[WebhookSignature] ${secretEnvVar} not configured - skipping signature verification (development mode)`
    )
    return null
  }

  return verifyWebhookSignature(signature, payload, secret)
}

/**
 * Zapier webhook signature verification
 *
 * Zapier doesn't natively sign webhooks, but you can add a "Secrets"
 * field in your Zap and send it as a custom header.
 *
 * Recommended approach:
 * 1. Add "Secret" field in Zapier action
 * 2. Set it to value from ZAPIER_WEBHOOK_SECRET
 * 3. Zap sends it in X-Zapier-Signature header
 *
 * @param request - Next.js request object
 * @returns Verification result
 */
export async function verifyZapierWebhookSignature(
  request: Request
): Promise<WebhookSignatureVerificationResult | null> {
  const signature = request.headers.get('x-zapier-signature') ||
                   request.headers.get('x-webhook-signature') ||
                   request.headers.get('x-hook-signature')

  // Get raw body text
  const clonedRequest = request.clone()
  const payload = await clonedRequest.text()

  return verifyWebhookSignatureFromEnv(signature, payload, 'ZAPIER_WEBHOOK_SECRET', true)
}

/**
 * Stripe webhook signature verification (for reference)
 *
 * Stripe uses a more complex signature scheme with timestamp.
 * Use Stripe's official SDK for this:
 * https://github.com/stripe/stripe-node#webhook-signing
 *
 */
