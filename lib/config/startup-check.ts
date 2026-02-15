/**
 * Startup Health Check
 * 
 * Performs critical checks before the application accepts traffic.
 * This runs on every serverless function cold start to ensure the
 * environment is correctly configured.
 * 
 * @module lib/config/startup-check
 */

import { createClient } from '@/lib/supabase/server'
import { env } from './env-schema'

export interface StartupCheckResult {
  healthy: boolean
  errors: string[]
  warnings: string[]
  checks: {
    supabase: boolean
    openai: boolean
    n8n: boolean
    rateLimiting: boolean
  }
}

/**
 * Perform startup health check
 * 
 * Validates that all critical services are accessible and
 * environment variables are correctly configured.
 * 
 * @returns {Promise<StartupCheckResult>} Health check results
 */
export async function performStartupCheck(): Promise<StartupCheckResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const checks = {
    supabase: false,
    openai: false,
    n8n: false,
    rateLimiting: false,
  }
  
  // ============================================================================
  // Check 1: Supabase Connectivity
  // ============================================================================
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)
    
    if (error) {
      errors.push(`Supabase connection failed: ${error.message}`)
      errors.push('Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are correct')
    } else {
      checks.supabase = true
    }
  } catch (error) {
    errors.push(
      `Supabase initialization failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    )
    errors.push('This usually indicates missing or invalid Supabase environment variables')
  }
  
  // ============================================================================
  // Check 2: OpenAI API Key Format
  // ============================================================================
  try {
    const openaiKey = env.OPENAI_API_KEY
    if (openaiKey && openaiKey.startsWith('sk-')) {
      checks.openai = true
    } else {
      errors.push('OPENAI_API_KEY is missing or has invalid format (must start with sk-)')
    }
  } catch (error) {
    errors.push('OPENAI_API_KEY validation failed')
  }
  
  // ============================================================================
  // Check 3: n8n Availability (Warning Only)
  // ============================================================================
  try {
    const n8nUrl = env.N8N_WEBHOOK_URL
    const n8nUser = env.N8N_WEBHOOK_AUTH_USER
    const n8nPassword = env.N8N_WEBHOOK_AUTH_PASSWORD
    
    if (n8nUrl && n8nUser && n8nPassword) {
      checks.n8n = true
    } else if (!n8nUrl) {
      warnings.push(
        'N8N_WEBHOOK_URL not configured - letter generation will use OpenAI fallback only'
      )
      warnings.push('n8n provides superior jurisdiction research and legal context')
    } else {
      warnings.push('n8n webhook URL is set but authentication credentials are missing')
    }
  } catch (error) {
    warnings.push('n8n configuration check failed')
  }
  
  // ============================================================================
  // Check 4: Rate Limiting Configuration
  // ============================================================================
  try {
    const hasRateLimiting = env.KV_REST_API_URL && env.KV_REST_API_TOKEN
    
    if (hasRateLimiting) {
      checks.rateLimiting = true
    } else if (env.NODE_ENV === 'production') {
      warnings.push(
        'Rate limiting not configured (KV_REST_API_URL/TOKEN missing) - security risk in production'
      )
    }
  } catch (error) {
    warnings.push('Rate limiting configuration check failed')
  }
  
  // ============================================================================
  // Determine Overall Health
  // ============================================================================
  const healthy = errors.length === 0 && checks.supabase && checks.openai
  
  return {
    healthy,
    errors,
    warnings,
    checks,
  }
}

/**
 * Assert startup health
 * 
 * Throws an error if the startup check fails. Use this in critical
 * paths where the application should not proceed with an unhealthy state.
 * 
 * @throws {Error} If startup check fails
 */
export async function assertStartupHealth(): Promise<void> {
  const result = await performStartupCheck()
  
  if (!result.healthy) {
    const errorMessage = [
      '🚨 Startup health check failed:',
      ...result.errors.map(e => `  - ${e}`),
      '',
      'Application cannot start with these errors.',
      'See docs/runbooks/ENV_VAR_INCIDENT_RESPONSE.md for troubleshooting.',
    ].join('\n')
    
    throw new Error(errorMessage)
  }
  
  // Log warnings even if healthy
  if (result.warnings.length > 0) {
    console.warn('[Startup] ⚠️  Warnings detected:')
    result.warnings.forEach(w => console.warn(`  - ${w}`))
  }
}
