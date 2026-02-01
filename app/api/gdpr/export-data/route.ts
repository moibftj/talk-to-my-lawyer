/**
 * GDPR Data Export API
 *
 * POST: Creates a request to export all user data (GDPR Article 20 - Right to Data Portability)
 * GET: Get list of export requests for the current user
 */
import { NextRequest } from 'next/server'
import { safeApplyRateLimit, apiRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { db } from '@/lib/db/client-factory'

/**
 * POST /api/gdpr/export-data
 *
 * Creates a request to export all user data (GDPR Article 20 - Right to Data Portability)
 *
 * The exported data includes:
 * - Profile information
 * - All letters
 * - Subscription history
 * - Commission records (if employee)
 * - Coupon records (if employee)
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, ...getRateLimitTuple('GDPR_EXPORT'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await db.server()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Check for recent export requests (prevent abuse)
    const { data: recentRequests } = await supabase
      .from('data_export_requests')
      .select('*')
      .eq('user_id', user.id)
      .gte('requested_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('requested_at', { ascending: false })

    if (recentRequests && recentRequests.length > 0) {
      const latestRequest = recentRequests[0]
      if ((latestRequest as any).status === 'pending' || (latestRequest as any).status === 'processing') {
        return errorResponses.rateLimited('You already have a pending export request')
      }
    }

    // Create export request
    const { data: exportRequest, error: insertError } = await (supabase as any)
      .from('data_export_requests')
      .insert({
        user_id: user.id,
        status: 'pending',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[ExportData] Failed to create request:', insertError)
      throw insertError
    }

    // For immediate processing, export the data now
    try {
      const { data: userData, error: exportError } = await (supabase as any).rpc('export_user_data', {
        p_user_id: user.id,
      })

      if (exportError) {
        throw exportError
      }

      // Update request status to completed
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

      await (supabase as any)
        .from('data_export_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', (exportRequest as any).id)

      // Log the data access
      await (supabase as any).rpc('log_data_access', {
        p_user_id: user.id,
        p_accessed_by: user.id,
        p_access_type: 'export',
        p_resource_type: 'user_data',
        p_resource_id: user.id,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      })

      return successResponse({
        requestId: (exportRequest as any).id,
        status: 'completed',
        data: userData,
        expiresAt: expiresAt.toISOString(),
        message: 'Your data has been exported successfully. This data will be available for 7 days.',
      })
    } catch (exportError: any) {
      // Update request status to failed
      await (supabase as any)
        .from('data_export_requests')
        .update({
          status: 'failed',
          error_message: exportError.message,
        })
        .eq('id', (exportRequest as any).id)

      throw exportError
    }
  } catch (error) {
    return handleApiError(error, 'ExportData')
  }
}

/**
 * GET /api/gdpr/export-data
 *
 * Get list of export requests for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await db.server()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    // Get all export requests for this user
    const { data: requests, error } = await supabase
      .from('data_export_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('[GetExportRequests] Error:', error)
      throw error
    }

    return successResponse({
      requests: requests || [],
    })
  } catch (error) {
    return handleApiError(error, 'GetExportRequests')
  }
}
