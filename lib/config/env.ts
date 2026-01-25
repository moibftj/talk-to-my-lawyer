/**
 * Centralized environment variable configuration
 *
 * This file provides a single source of truth for all environment variables,
 * with validation and type safety. Import this file instead of accessing
 * process.env directly throughout the codebase.
 */

/**
 * Supabase configuration
 */
export const supabase = {
  url: required('NEXT_PUBLIC_SUPABASE_URL'),
  anonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  serviceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),
} as const

/**
 * OpenAI configuration
 */
export const openai = {
  apiKey: required('OPENAI_API_KEY'),
} as const

/**
 * Stripe configuration
 */
export const stripe = {
  secretKey: required('STRIPE_SECRET_KEY'),
  publishableKey: required('STRIPE_PUBLISHABLE_KEY'),
  webhookSecret: required('STRIPE_WEBHOOK_SECRET'),
} as const

/**
 * Email configuration
 */
export const email = {
  resendApiKey: required('RESEND_API_KEY'),
  from: optional('EMAIL_FROM', 'noreply@talk-to-my-lawyer.com'),
  fromName: optional('EMAIL_FROM_NAME', 'Talk-To-My-Lawyer'),
} as const

/**
 * Email configuration with apiKey alias for backward compatibility
 */
export const emailConfig = {
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM || 'noreply@talk-to-my-lawyer.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Talk-To-My-Lawyer',
} as const

/**
 * Admin configuration
 */
export const admin = {
  portalKey: required('ADMIN_PORTAL_KEY'),
} as const

/**
 * CRON configuration
 */
export const cron = {
  secret: required('CRON_SECRET'),
} as const

/**
 * App configuration
 */
export const app = {
  url: optional('NEXT_PUBLIC_APP_URL', 'https://www.talk-to-my-lawyer.com'),
  nodeEnv: optional('NODE_ENV', 'development'),
} as const

/**
 * Rate limiting configuration
 */
export const rateLimit = {
  redisUrl: optional('UPSTASH_REDIS_REST_URL'),
  redisToken: optional('UPSTASH_REDIS_REST_TOKEN'),
} as const

/**
 * OpenAI configuration with convenience properties
 */
export const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  isConfigured: Boolean(process.env.OPENAI_API_KEY),
} as const

/**
 * Environment helpers - exported for use in other modules
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

export function isTest(): boolean {
  return process.env.NODE_ENV === 'test'
}

/**
 * Get the application URL
 */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://www.talk-to-my-lawyer.com'
}

/**
 * Required environment variable accessor
 * Throws an error if the variable is not set
 */
function required(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

/**
 * Optional environment variable accessor
 * Returns the default value if the variable is not set
 */
function optional<T extends string = string>(
  key: string,
  defaultValue?: T
): T | undefined {
  const value = process.env[key]
  return (value || defaultValue) as T | undefined
}

/**
 * Validate all required environment variables
 * Call this during app initialization to fail fast if config is invalid
 */
export function validateEnv(): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'OPENAI_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'ADMIN_PORTAL_KEY',
    'CRON_SECRET',
  ]

  for (const key of requiredVars) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Environment metadata
 */
export const envMetadata = {
  isProduction: isProduction(),
  isDevelopment: isDevelopment(),
  isTest: isTest(),
  version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
} as const
