/**
 * Comprehensive Health Check System
 * Monitors all critical system components
 */

import { createClient } from '@/lib/supabase/server'
import { checkOpenAIHealth } from '@/lib/ai/openai-retry'

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: {
    database: ServiceHealth
    openai: ServiceHealth
    supabaseAuth: ServiceHealth
    emailService: ServiceHealth
    rateLimiting: ServiceHealth
  }
  metrics: {
    responseTime: number
    uptime: number
    memoryUsage: NodeJS.MemoryUsage
    activeConnections?: number
  }
  timestamp: string
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime?: number
  error?: string
  details?: Record<string, any>
}

export class HealthChecker {
  private startTime: number

  constructor() {
    this.startTime = Date.now()
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const checkStartTime = Date.now()

    // Run all health checks in parallel
    const [
      databaseHealth,
      openaiHealth,
      authHealth,
      emailHealth,
      rateLimitHealth
    ] = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkOpenAIHealth(),
      this.checkSupabaseAuthHealth(),
      this.checkEmailServiceHealth(),
      this.checkRateLimitingHealth()
    ])

    const services = {
      database: this.getResultOrError(databaseHealth),
      openai: this.getResultOrError(openaiHealth),
      supabaseAuth: this.getResultOrError(authHealth),
      emailService: this.getResultOrError(emailHealth),
      rateLimiting: this.getResultOrError(rateLimitHealth)
    }

    // Determine overall status
    const serviceStatuses = Object.values(services).map(s => s.status)
    const overallStatus = this.determineOverallStatus(serviceStatuses)

    return {
      status: overallStatus,
      services,
      metrics: {
        responseTime: Date.now() - checkStartTime,
        uptime: Date.now() - this.startTime,
        memoryUsage: process.memoryUsage(),
        activeConnections: await this.getActiveConnections()
      },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now()

    try {
      const supabase = await createClient()

      // Simple database health query
      const { error, data } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)

      const responseTime = Date.now() - startTime

      if (error) {
        return {
          status: 'unhealthy',
          responseTime,
          error: error.message,
          details: { error: error }
        }
      }

      return {
        status: 'healthy',
        responseTime,
        details: { connected: true, hasData: Array.isArray(data) }
      }

    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: { error: error.toString() }
      }
    }
  }

  /**
   * Check OpenAI service health
   * Note: Only check if API key exists - don't make actual API calls in health check
   */
  private async checkOpenAIHealth(): Promise<ServiceHealth> {
    const startTime = Date.now()

    try {
      // Check if API key or Gateway key is configured
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY
      const hasGatewayKey = !!process.env.AI_GATEWAY_API_KEY

      const responseTime = Date.now() - startTime

      if (!hasOpenAIKey && !hasGatewayKey) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'OpenAI API key or AI Gateway key not configured'
        }
      }

      return {
        status: 'healthy',
        responseTime,
        details: {
          hasOpenAIKey,
          hasGatewayKey
        }
      }

    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: { error: error.toString() }
      }
    }
  }

  /**
   * Check Supabase Auth service
   */
  private async checkSupabaseAuthHealth(): Promise<ServiceHealth> {
    const startTime = Date.now()

    try {
      const supabase = await createClient()

      // Try to get current user (will fail if not authenticated, but should not error)
      const { data, error } = await supabase.auth.getUser()

      const responseTime = Date.now() - startTime

      const isMissingSession = !!error && (
        error.name === 'AuthSessionMissingError' ||
        error.message.includes('Auth session missing') ||
        error.message.includes('no session')
      )
      const isInvalidAuth = !!error && error.message.includes('Invalid')

      // Auth service is healthy if we get a response, even without a session.
      if (error && !(isMissingSession || isInvalidAuth)) {
        return {
          status: 'unhealthy',
          responseTime,
          error: error.message,
          details: { error: error }
        }
      }

      return {
        status: 'healthy',
        responseTime,
        details: {
          serviceAvailable: true,
          authenticated: !!data.user,
          missingSession: isMissingSession
        }
      }

    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: { error: error.toString() }
      }
    }
  }

  /**
   * Check email service health
   */
  private async checkEmailServiceHealth(): Promise<ServiceHealth> {
    const startTime = Date.now()

    try {
      // Check email configuration
      const emailProvider = process.env.EMAIL_PROVIDER
      const hasConfig = {
        resend: !!process.env.RESEND_API_KEY
      }

      const isConfigured = emailProvider && hasConfig[emailProvider as keyof typeof hasConfig]

      const responseTime = Date.now() - startTime

      if (!isConfigured) {
        return {
          status: 'degraded',
          responseTime,
          error: 'Email service not configured',
          details: { provider: emailProvider, config: hasConfig }
        }
      }

      // For console provider, it's always healthy
      if (emailProvider === 'console') {
        return {
          status: 'healthy',
          responseTime,
          details: { provider: 'console', mode: 'development' }
        }
      }

      return {
        status: 'healthy',
        responseTime,
        details: { provider: emailProvider, configured: true }
      }

    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: { error: error.toString() }
      }
    }
  }

  /**
   * Check rate limiting service health
   */
  private async checkRateLimitingHealth(): Promise<ServiceHealth> {
    const startTime = Date.now()

    try {
      // Check Redis configuration for rate limiting
      const redisUrl = process.env.KV_REST_API_URL
      const redisToken = process.env.KV_REST_API_TOKEN

      const responseTime = Date.now() - startTime

      if (!redisUrl || !redisToken) {
        return {
          status: 'degraded',
          responseTime,
          error: 'Rate limiting not configured (missing Redis)',
          details: {
            hasRedisUrl: !!redisUrl,
            hasRedisToken: !!redisToken,
            fallbackMode: 'in-memory'
          }
        }
      }

      // Check if Redis URL is properly formatted
      if (!redisUrl.startsWith('https://')) {
        return {
          status: 'unhealthy',
          responseTime,
          error: 'Invalid Redis URL format',
          details: { url: redisUrl }
        }
      }

      return {
        status: 'healthy',
        responseTime,
        details: {
          hasRedis: true,
          url: redisUrl.replace(/\/\/.*@/, '//***@***') // Hide token
        }
      }

    } catch (error: any) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
        details: { error: error.toString() }
      }
    }
  }

  /**
   * Get active database connections (if available)
   */
  private async getActiveConnections(): Promise<number | undefined> {
    try {
      const supabase = await createClient()

      // This would need to be implemented based on your database
      // For PostgreSQL, you might query pg_stat_activity
      // For now, return undefined as it's not critical

      return undefined
    } catch {
      return undefined
    }
  }

  /**
   * Determine overall system status from individual service statuses
   */
  private determineOverallStatus(statuses: ServiceHealth['status'][]): HealthCheckResult['status'] {
    if (statuses.every(s => s === 'healthy')) {
      return 'healthy'
    }

    if (statuses.some(s => s === 'unhealthy')) {
      return 'unhealthy'
    }

    return 'degraded'
  }

  /**
   * Extract result from Promise.allSettled or create error result
   */
  private getResultOrError(result: PromiseSettledResult<ServiceHealth>): ServiceHealth {
    if (result.status === 'fulfilled') {
      return result.value
    }

    return {
      status: 'unhealthy',
      error: result.reason?.message || 'Unknown error',
      details: { reason: result.reason }
    }
  }

  /**
   * Check if system is ready to serve requests
   */
  async isReady(): Promise<boolean> {
    const health = await this.checkHealth()
    return health.status === 'healthy' || health.status === 'degraded'
  }

  /**
   * Check if system is alive (basic connectivity check)
   */
  async isLive(): Promise<boolean> {
    try {
      // Basic check - can we access the database?
      const supabase = await createClient()
      await supabase.from('profiles').select('id').limit(1)
      return true
    } catch {
      return false
    }
  }
}

// Singleton instance
export const healthChecker = new HealthChecker()

/**
 * Express/Next.js middleware for health endpoints
 */
export function createHealthMiddleware() {
  return async (request: Request, context?: any) => {
    const url = new URL(request.url)
    const path = url.pathname

    // Health check endpoints
    if (path === '/health') {
      const health = await healthChecker.checkHealth()
      return new Response(JSON.stringify(health), {
        status: health.status === 'unhealthy' ? 503 : 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (path === '/health/ready') {
      const isReady = await healthChecker.isReady()
      return new Response(
        JSON.stringify({ ready: isReady }),
        {
          status: isReady ? 200 : 503,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (path === '/health/live') {
      const isLive = await healthChecker.isLive()
      return new Response(
        JSON.stringify({ alive: isLive }),
        {
          status: isLive ? 200 : 503,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return null // Continue processing
  }
}
