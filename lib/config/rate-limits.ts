/**
 * Centralized rate limit configurations
 *
 * All rate limits for API routes are defined here for easy adjustment and consistency.
 */

export type RateLimitConfig = {
  limit: number
  window: string // e.g., "1 m", "1 h", "1 d"
  description: string
}

/**
 * Rate limit configurations by route type
 */
export const RATE_LIMITS = {
  // Authentication endpoints
  AUTH_LOGIN: { limit: 5, window: '15 m', description: 'Login attempts' },
  AUTH_SIGNUP: { limit: 3, window: '1 h', description: 'Signup attempts' },
  AUTH_PASSWORD_RESET: { limit: 3, window: '1 h', description: 'Password reset requests' },
  AUTH_UPDATE_PASSWORD: { limit: 5, window: '15 m', description: 'Password updates' },

  // Letter generation (expensive operations)
  LETTER_GENERATE: { limit: 5, window: '1 m', description: 'Letter generation requests' },
  LETTER_IMPROVE: { limit: 10, window: '1 m', description: 'Letter improvement requests' },
  LETTER_SUBMIT: { limit: 10, window: '1 m', description: 'Letter submissions' },

  // Letter operations
  LETTER_CREATE_DRAFT: { limit: 20, window: '1 m', description: 'Draft creation' },
  LETTER_UPDATE: { limit: 30, window: '1 m', description: 'Letter updates' },
  LETTER_DELETE: { limit: 10, window: '1 m', description: 'Letter deletions' },
  LETTER_PDF: { limit: 10, window: '1 m', description: 'PDF generation' },
  LETTER_EMAIL: { limit: 5, window: '1 m', description: 'Email sending' },

  // Checkout and payments
  CHECKOUT_CREATE: { limit: 10, window: '1 m', description: 'Checkout session creation' },
  PAYMENT_VERIFY: { limit: 20, window: '1 m', description: 'Payment verification' },
  BILLING_HISTORY: { limit: 30, window: '1 m', description: 'Billing history requests' },

  // Admin operations
  ADMIN_READ: { limit: 100, window: '1 m', description: 'Admin read operations' },
  ADMIN_WRITE: { limit: 50, window: '1 m', description: 'Admin write operations' },
  ADMIN_BULK: { limit: 10, window: '1 m', description: 'Admin bulk operations' },

  // Employee operations
  EMPLOYEE_READ: { limit: 50, window: '1 m', description: 'Employee read operations' },
  EMPLOYEE_WRITE: { limit: 20, window: '1 m', description: 'Employee write operations' },

  // GDPR operations
  GDPR_EXPORT: { limit: 2, window: '1 h', description: 'Data export requests' },
  GDPR_DELETE: { limit: 2, window: '1 h', description: 'Account deletion requests' },
  GDPR_ACCEPT_POLICY: { limit: 10, window: '1 m', description: 'Privacy policy acceptance' },

  // General API
  API_GENERAL: { limit: 100, window: '1 m', description: 'General API requests' },
  API_READ: { limit: 200, window: '1 m', description: 'Read-only API requests' },

  // Health checks (higher limits)
  HEALTH_CHECK: { limit: 1000, window: '1 m', description: 'Health check requests' },

  // Webhooks (no rate limiting, but track for monitoring)
  WEBHOOK_STRIPE: { limit: 1000, window: '1 m', description: 'Stripe webhooks' },
  WEBHOOK_EMAIL: { limit: 1000, window: '1 m', description: 'Email webhooks' },
} as const

export type RateLimitKey = keyof typeof RATE_LIMITS

/**
 * Get rate limit configuration for a specific key
 */
export function getRateLimit(key: RateLimitKey): RateLimitConfig {
  return RATE_LIMITS[key]
}

/**
 * Helper to create rate limit tuple for safeApplyRateLimit
 */
export function getRateLimitTuple(key: RateLimitKey): [number, string] {
  const config = RATE_LIMITS[key]
  return [config.limit, config.window]
}
