import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { safeApplyRateLimit, apiRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'

/**
 * POST /api/gdpr/export-data
 *
 * Creates a request to export all user data (GDPR Article 20 - Right to Data Portability)
 *
 * This endpoint creates an export request. The actual data generation can be:
 * 1. Immediate (for small datasets)
 * 2. Background job (for large datasets)
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

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      if (latestRequest.status === 'pending' || latestRequest.status === 'processing') {
        return NextResponse.json({
          error: 'You already have a pending export request',
          existingRequest: latestRequest,
        }, { status: 429 })
      }
    }

    // Create export request
    const { data: exportRequest, error: insertError } = await supabase
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
      const { data: userData, error: exportError } = await supabase.rpc('export_user_data', {
        p_user_id: user.id,
      })

      if (exportError) {
        throw exportError
      }

      // Update request status to completed
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

      await supabase
        .from('data_export_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', exportRequest.id)

      // Log the data access
      await supabase.rpc('log_data_access', {
        p_user_id: user.id,
        p_accessed_by: user.id,
        p_access_type: 'export',
        p_resource_type: 'user_data',
        p_resource_id: user.id,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      })

      return NextResponse.json({
        success: true,
        requestId: exportRequest.id,
        status: 'completed',
        data: userData,
        expiresAt: expiresAt.toISOString(),
        message: 'Your data has been exported successfully. This data will be available for 7 days.',
      })
    } catch (exportError: any) {
      // Update request status to failed
      await supabase
        .from('data_export_requests')
        .update({
          status: 'failed',
          error_message: exportError.message,
        })
        .eq('id', exportRequest.id)

      throw exportError
    }
  } catch (error: any) {
    console.error('[ExportData] Error:', error)
    return NextResponse.json(
      { error: 'Failed to export data', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gdpr/export-data
 *
 * Get list of export requests for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    return NextResponse.json({
      success: true,
      requests: requests || [],
    })
  } catch (error: any) {
    console.error('[GetExportRequests] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get export requests', message: error.message },
      { status: 500 }
    )
  }
}
