/**
 * Centralized environment configuration with validation
 *
 * This module provides type-safe access to environment variables with runtime validation.
 * All environment variable access should go through this module.
 */

import { z } from 'zod'

// Environment variable schema
const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  // Admin
  ADMIN_PORTAL_KEY: z.string().min(1),

  // Cron
  CRON_SECRET: z.string().min(1),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().optional().default('Talk-To-My-Lawyer'),

  // Redis (optional - falls back to in-memory)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // OpenTelemetry (optional)
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().optional().default('talk-to-my-lawyer'),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
})

// Type inference from schema
type Env = z.infer<typeof envSchema>

// Cached validated environment
let cachedEnv: Env | null = null

/**
 * Get validated environment configuration
 * Throws error if required variables are missing or invalid
 */
export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv
  }

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment variables. Check console for details.')
  }

  cachedEnv = parsed.data
  return cachedEnv
}

/**
 * Get environment variable with fallback
 * Use this for optional variables with defaults
 */
export function getEnvVar(key: keyof Env, fallback?: string): string {
  try {
    const env = getEnv()
    return (env[key] as string) || fallback || ''
  } catch {
    return fallback || ''
  }
}

/**
 * Check if environment is production
 */
export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production'
}

/**
 * Check if environment is development
 */
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development'
}

/**
 * Check if environment is test
 */
export function isTest(): boolean {
  return getEnv().NODE_ENV === 'test'
}

/**
 * Get app URL for constructing links
 */
export function getAppUrl(): string {
  const env = getEnv()
  return env.NEXT_PUBLIC_APP_URL ||
    (isProduction() ? 'https://www.talk-to-my-lawyer.com' : 'http://localhost:3000')
}

// Pre-validate environment on module load (fail fast)
if (typeof window === 'undefined') {
  try {
    getEnv()
  } catch (error) {
    // Only fail in production - allow development to continue with warnings
    if (process.env.NODE_ENV === 'production') {
      throw error
    }
  }
}

// Export specific config groups for convenience
export const supabaseConfig = {
  get url() { return getEnv().NEXT_PUBLIC_SUPABASE_URL },
  get anonKey() { return getEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY },
  get serviceRoleKey() { return getEnv().SUPABASE_SERVICE_ROLE_KEY },
}

export const openaiConfig = {
  get apiKey() { return getEnv().OPENAI_API_KEY },
}

export const stripeConfig = {
  get secretKey() { return getEnv().STRIPE_SECRET_KEY },
  get publishableKey() { return getEnv().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY },
  get webhookSecret() { return getEnv().STRIPE_WEBHOOK_SECRET },
}

export const adminConfig = {
  get portalKey() { return getEnv().ADMIN_PORTAL_KEY },
}

export const cronConfig = {
  get secret() { return getEnv().CRON_SECRET },
}

export const emailConfig = {
  get apiKey() { return getEnv().RESEND_API_KEY },
  get from() { return getEnv().EMAIL_FROM },
  get fromName() { return getEnv().EMAIL_FROM_NAME },
}

export const redisConfig = {
  get url() { return getEnv().UPSTASH_REDIS_REST_URL },
  get token() { return getEnv().UPSTASH_REDIS_REST_TOKEN },
  get isAvailable() { return !!(this.url && this.token) },
}

export const telemetryConfig = {
  get endpoint() { return getEnv().OTEL_EXPORTER_OTLP_ENDPOINT },
  get serviceName() { return getEnv().OTEL_SERVICE_NAME },
  get isEnabled() { return !!this.endpoint },
}
