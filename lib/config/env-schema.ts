/**
 * Environment Variable Schema & Validation
 * 
 * This module provides type-safe, validated access to environment variables.
 * It uses Zod for runtime validation and fails fast on missing/invalid variables.
 * 
 * @module lib/config/env-schema
 */

import { z } from 'zod'

/**
 * Environment Variable Schema
 * 
 * Defines all environment variables with validation rules.
 * Variables are categorized by criticality:
 * - CRITICAL: Application cannot start without these
 * - PRODUCTION: Required in production, optional in development
 * - OPTIONAL: Application can run with degraded functionality
 */
const envSchema = z.object({
  // ============================================================================
  // CRITICAL VARIABLES (Application will not start without these)
  // ============================================================================
  
  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('Must be a valid URL')
    .refine(url => url.includes('supabase.co'), {
      message: 'Must be a Supabase URL',
    }),
  
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(100, 'Anon key appears invalid (too short)')
    .startsWith('eyJ', 'Anon key must start with eyJ (JWT format)'),
  
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(100, 'Service role key appears invalid (too short)')
    .startsWith('eyJ', 'Service role key must start with eyJ (JWT format)'),
  
  // OpenAI Configuration
  OPENAI_API_KEY: z
    .string()
    .startsWith('sk-', 'OpenAI API key must start with sk-')
    .min(20, 'OpenAI API key appears invalid (too short)'),
  
  // ============================================================================
  // PRODUCTION-REQUIRED VARIABLES
  // ============================================================================
  
  // Stripe Configuration
  STRIPE_SECRET_KEY: z
    .string()
    .optional()
    .refine(
      val => !val || val.startsWith('sk_'),
      'Stripe secret key must start with sk_'
    ),
  
  STRIPE_PUBLISHABLE_KEY: z
    .string()
    .optional()
    .refine(
      val => !val || val.startsWith('pk_'),
      'Stripe publishable key must start with pk_'
    ),
  
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional()
    .refine(
      val => !val || val.startsWith('whsec_'),
      'Stripe webhook secret must start with whsec_'
    ),
  
  // Email Configuration
  RESEND_API_KEY: z
    .string()
    .optional()
    .refine(
      val => !val || val.startsWith('re_'),
      'Resend API key must start with re_'
    ),
  
  EMAIL_FROM: z
    .string()
    .email('Must be a valid email address')
    .optional(),
  
  // Security Secrets
  CSRF_SECRET: z
    .string()
    .min(32, 'CSRF secret must be at least 32 characters')
    .optional(),
  
  ADMIN_SESSION_SECRET: z
    .string()
    .min(32, 'Admin session secret must be at least 32 characters')
    .optional(),
  
  CRON_SECRET: z
    .string()
    .min(16, 'Cron secret must be at least 16 characters')
    .optional(),
  
  // Rate Limiting
  KV_REST_API_URL: z
    .string()
    .url('Must be a valid URL')
    .optional(),
  
  KV_REST_API_TOKEN: z
    .string()
    .optional(),
  
  // ============================================================================
  // OPTIONAL VARIABLES (Graceful degradation)
  // ============================================================================
  
  // n8n Integration
  N8N_WEBHOOK_URL: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .refine(
      val => !val || val.startsWith('https://'),
      'n8n webhook URL must use HTTPS'
    ),
  
  N8N_WEBHOOK_AUTH_USER: z.string().optional(),
  N8N_WEBHOOK_AUTH_PASSWORD: z.string().optional(),
  
  // Legal Research APIs
  TAVILY_API_KEY: z.string().optional(),
  BING_SEARCH_API_KEY: z.string().optional(),
  
  // Monitoring
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  
  // Feature Flags
  ENABLE_TEST_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform(val => val === 'true'),
  
  NEXT_PUBLIC_TEST_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform(val => val === 'true'),
  
  // Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
})

/**
 * Inferred TypeScript type from the schema
 */
export type Env = z.infer<typeof envSchema>

/**
 * Production-specific validation
 * 
 * In production, certain optional variables become required.
 */
function validateProductionEnv(env: Env): {
  success: boolean
  errors: string[]
  warnings: string[]
} {
  const isProduction = env.NODE_ENV === 'production'
  
  if (!isProduction) {
    return { success: true, errors: [], warnings: [] }
  }
  
  const errors: string[] = []
  const warnings: string[] = []
  
  // Stripe is required in production
  if (!env.STRIPE_SECRET_KEY) {
    errors.push('STRIPE_SECRET_KEY is required in production')
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    errors.push('STRIPE_WEBHOOK_SECRET is required in production')
  }
  
  // Email is required in production
  if (!env.RESEND_API_KEY) {
    errors.push('RESEND_API_KEY is required in production')
  }
  if (!env.EMAIL_FROM) {
    errors.push('EMAIL_FROM is required in production')
  }
  
  // Security secrets are required in production
  if (!env.CSRF_SECRET) {
    errors.push('CSRF_SECRET is required in production')
  }
  if (!env.CRON_SECRET) {
    errors.push('CRON_SECRET is required in production')
  }
  
  // Rate limiting is strongly recommended in production
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
    warnings.push(
      'Rate limiting is not configured (KV_REST_API_URL/TOKEN missing). This is a security risk in production.'
    )
  }
  
  // Test mode must be disabled in production
  if (env.ENABLE_TEST_MODE) {
    errors.push('ENABLE_TEST_MODE must be false in production')
  }
  if (env.NEXT_PUBLIC_TEST_MODE) {
    errors.push('NEXT_PUBLIC_TEST_MODE must be false in production')
  }
  
  // n8n is recommended for better letter generation
  if (!env.N8N_WEBHOOK_URL) {
    warnings.push(
      'N8N_WEBHOOK_URL not configured. Letter generation will use OpenAI fallback only (less jurisdiction-aware).'
    )
  }
  
  return { success: errors.length === 0, errors, warnings }
}

/**
 * Validate environment variables at application startup
 * 
 * This function is called during application initialization to ensure
 * all required environment variables are present and valid.
 * 
 * @throws {Error} If validation fails in production
 * @returns {Env} Validated and typed environment variables
 */
export function validateEnv(): Env {
  const context = process.env.CI ? 'CI build' : process.env.NODE_ENV || 'development'
  console.log(`[ENV] Validating environment variables (${context})...`)
  
  try {
    // Parse and validate schema
    const parsed = envSchema.parse(process.env)
    
    // Additional production validation
    const prodValidation = validateProductionEnv(parsed)
    
    // Log warnings
    if (prodValidation.warnings.length > 0) {
      console.warn('[ENV] ⚠️  Warnings:')
      prodValidation.warnings.forEach(warning => {
        console.warn(`  - ${warning}`)
      })
    }
    
    // Handle errors
    if (!prodValidation.success) {
      console.error('[ENV] ❌ Production validation failed:')
      prodValidation.errors.forEach(err => {
        console.error(`  - ${err}`)
      })
      throw new Error('Production environment validation failed')
    }
    
    console.log('[ENV] ✅ Environment validation passed')
    
    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[ENV] ❌ Environment validation failed:')
      error.errors.forEach(err => {
        const path = err.path.join('.')
        console.error(`  - ${path}: ${err.message}`)
      })
      
      // In production or CI, fail hard
      if (process.env.NODE_ENV === 'production' || process.env.CI) {
        console.error('\n[ENV] 🚨 CRITICAL: Application cannot start with invalid environment variables.')
        console.error('[ENV] 📖 See docs/ENVIRONMENT_VARIABLE_RESILIENCE_PLAN.md for troubleshooting.')
        throw new Error(
          'Critical environment variables are missing or invalid. Application cannot start.'
        )
      }
      
      // In development, warn but continue
      console.warn('[ENV] ⚠️  Continuing in development mode with invalid environment')
      console.warn('[ENV] 💡 Fix these issues before deploying to production')
    }
    
    throw error
  }
}

/**
 * Type-safe environment variable access
 * 
 * Import this instead of using process.env directly to get
 * type-checked and validated environment variables.
 * 
 * @example
 * import { env } from '@/lib/config/env-schema'
 * 
 * const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
 * const openaiKey = env.OPENAI_API_KEY
 */
let _env: Env | null = null

export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv()
  }
  return _env
}

// Export a singleton instance
export const env = getEnv()
