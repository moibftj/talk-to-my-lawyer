import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { healthChecker } from '@/lib/monitoring/health-check'
import { performStartupCheck } from '@/lib/config/startup-check'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ServiceStatus = {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency?: number
  error?: string
}

type HealthCheck = {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  services: {
    database: ServiceStatus
    auth: ServiceStatus
    stripe: ServiceStatus
    openai: ServiceStatus
    redis: ServiceStatus
  }
  environment: string
}

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)

    if (error) {
      return { status: 'unhealthy', latency: Date.now() - start, error: error.message }
    }
    return { status: 'healthy', latency: Date.now() - start }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { status: 'unhealthy', latency: Date.now() - start, error: message }
  }
}

async function checkAuth(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.getSession()

    if (error && !error.message.includes('no session')) {
      return { status: 'degraded', latency: Date.now() - start, error: error.message }
    }
    return { status: 'healthy', latency: Date.now() - start }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { status: 'unhealthy', latency: Date.now() - start, error: message }
  }
}

function checkStripe(): ServiceStatus {
  const hasKey = !!process.env.STRIPE_SECRET_KEY
  const testMode = process.env.ENABLE_TEST_MODE === 'true'

  if (testMode) {
    return { status: 'healthy' }
  }

  if (!hasKey) {
    return { status: 'unhealthy', error: 'Stripe secret key not configured' }
  }

  return { status: 'healthy' }
}

function checkOpenAI(): ServiceStatus {
  const hasKey = !!process.env.OPENAI_API_KEY

  if (!hasKey) {
    return { status: 'unhealthy', error: 'OpenAI API key not configured' }
  }

  return { status: 'healthy' }
}

function checkRedis(): ServiceStatus {
  const hasUrl = !!process.env.KV_REST_API_URL || !!process.env.REDIS_URL

  if (!hasUrl) {
    return { status: 'degraded', error: 'Redis not configured - rate limiting disabled' }
  }

  return { status: 'healthy' }
}

function getOverallStatus(services: HealthCheck['services']): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(services).map(s => s.status)

  if (statuses.includes('unhealthy')) {
    const criticalServices = ['database', 'auth', 'openai']
    const unhealthyCritical = criticalServices.some(
      svc => services[svc as keyof typeof services].status === 'unhealthy'
    )
    return unhealthyCritical ? 'unhealthy' : 'degraded'
  }

  if (statuses.includes('degraded')) {
    return 'degraded'
  }

  return 'healthy'
}

export async function GET() {
  try {
    // Perform startup check to verify environment
    const startupCheck = await performStartupCheck()
    
    // Use comprehensive health checker
    const health = await healthChecker.checkHealth()

    // Add startup check results and legacy compatibility fields
    const legacyHealth = {
      status: health.status,
      timestamp: health.timestamp,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      services: {
        database: health.services.database,
        auth: health.services.supabaseAuth,
        stripe: {
          status: 'healthy' as const,
          details: { testMode: process.env.ENABLE_TEST_MODE === 'true' }
        },
        openai: health.services.openai,
        redis: health.services.rateLimiting
      },
      environment: process.env.NODE_ENV || 'development',
      metrics: health.metrics,
      startup: {
        healthy: startupCheck.healthy,
        errors: startupCheck.errors,
        warnings: startupCheck.warnings,
        checks: startupCheck.checks
      }
    }

    // Return 503 if either health check or startup check fails
    const statusCode = 
      !startupCheck.healthy || health.status === 'unhealthy' ? 503 : 200

    return NextResponse.json(legacyHealth, { status: statusCode })
  } catch (error: any) {
    console.error('[Health] Health check failed:', error)

    // Fallback to basic health check
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error.message
    }, { status: 503 })
  }
}
