import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuperAdminAuth } from '@/lib/auth/admin-session'

interface ServiceStatus {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  error?: string
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  services: ServiceStatus[]
  checks: {
    database: boolean
    email: boolean
    storage: boolean
    auth: boolean
  }
}

const startTime = Date.now()

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Simple query to check database connectivity
    const { error } = await supabase.from('profiles').select('id').limit(1)

    const responseTime = Date.now() - start

    if (error) {
      return {
        name: 'Database',
        status: 'unhealthy',
        responseTime,
        error: error.message
      }
    }

    return {
      name: 'Database',
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime
    }
  } catch (error) {
    return {
      name: 'Database',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: String(error)
    }
  }
}

async function checkEmail(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    // Check if email service is configured
    const hasEmailConfig = !!process.env.RESEND_API_KEY

    const responseTime = Date.now() - start

    if (!hasEmailConfig) {
      return {
        name: 'Email Service',
        status: 'degraded',
        responseTime,
        error: 'No email provider configured'
      }
    }

    return {
      name: 'Email Service',
      status: 'healthy',
      responseTime
    }
  } catch (error) {
    return {
      name: 'Email Service',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: String(error)
    }
  }
}

async function checkStorage(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if we can access storage buckets
    const { data, error } = await supabase.storage.listBuckets()

    const responseTime = Date.now() - start

    if (error) {
      return {
        name: 'Storage',
        status: 'unhealthy',
        responseTime,
        error: error.message
      }
    }

    return {
      name: 'Storage',
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime
    }
  } catch (error) {
    return {
      name: 'Storage',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: String(error)
    }
  }
}

async function checkAuth(): Promise<ServiceStatus> {
  const start = Date.now()
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if auth is accessible
    const { data, error } = await supabase.auth.admin.listUsers()

    const responseTime = Date.now() - start

    if (error) {
      return {
        name: 'Authentication',
        status: 'unhealthy',
        responseTime,
        error: error.message
      }
    }

    return {
      name: 'Authentication',
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime
    }
  } catch (error) {
    return {
      name: 'Authentication',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: String(error)
    }
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<HealthCheckResponse>> {
  // Require Super Admin authentication to view detailed health information
  const authError = await requireSuperAdminAuth()
  if (authError) return authError

  try {
    const [dbStatus, emailStatus, storageStatus, authStatus] = await Promise.all([
      checkDatabase(),
      checkEmail(),
      checkStorage(),
      checkAuth()
    ])

    const services = [dbStatus, emailStatus, storageStatus, authStatus]
    const uptime = Date.now() - startTime

    // Determine overall status
    const unhealthyCount = services.filter((s) => s.status === 'unhealthy').length
    const degradedCount = services.filter((s) => s.status === 'degraded').length

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy'
    } else if (degradedCount > 0) {
      overallStatus = 'degraded'
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime,
      services,
      checks: {
        database: dbStatus.status === 'healthy',
        email: emailStatus.status !== 'unhealthy',
        storage: storageStatus.status === 'healthy',
        auth: authStatus.status === 'healthy'
      }
    }

    const statusCode =
      overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 503 : 503

    return NextResponse.json(response, { status: statusCode })
  } catch (error) {
    console.error('[HealthCheck] Unexpected error:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        services: [],
        checks: {
          database: false,
          email: false,
          storage: false,
          auth: false
        }
      },
      { status: 503 }
    )
  }
}
