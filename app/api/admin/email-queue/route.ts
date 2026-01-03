import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdminAuth } from '@/lib/auth/admin-session'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { processEmailQueue } from '@/lib/email/queue'
import { validateSystemAdminAction } from '@/lib/admin/letter-actions'

export const runtime = 'nodejs'

// GET - Fetch email queue status and items
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 30, '1 m')
    if (rateLimitResponse) return rateLimitResponse

    const authError = await requireSuperAdminAuth()
    if (authError) return authError

    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('email_queue')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: emails, error, count } = await query

    if (error) {
      console.error('[EmailQueue] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch email queue' }, { status: 500 })
    }

    // Get stats
    const { data: stats } = await supabase
      .from('email_queue')
      .select('status')

    const statusCounts = {
      pending: stats?.filter(e => e.status === 'pending').length || 0,
      sent: stats?.filter(e => e.status === 'sent').length || 0,
      failed: stats?.filter(e => e.status === 'failed').length || 0,
      total: stats?.length || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        emails: emails || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        },
        stats: statusCounts
      }
    })
  } catch (error: any) {
    console.error('[EmailQueue] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Trigger email queue processing or retry failed emails
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 5, '1 m')
    if (rateLimitResponse) return rateLimitResponse

    const validationError = await validateSystemAdminAction(request)
    if (validationError) return validationError

    const body = await request.json()
    const { action, emailId } = body

    const supabase = await createClient()

    if (action === 'process') {
      // Process pending emails
      const result = await processEmailQueue()
      return NextResponse.json({
        success: true,
        message: 'Email queue processing triggered',
        result
      })
    }

    if (action === 'retry' && emailId) {
      // Reset a specific failed email for retry
      const { data, error } = await supabase
        .from('email_queue')
        .update({
          status: 'pending',
          attempts: 0,
          next_retry_at: new Date().toISOString(),
          error: null
        })
        .eq('id', emailId)
        .eq('status', 'failed')
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: 'Failed to retry email' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Email queued for retry',
        email: data
      })
    }

    if (action === 'retry_all_failed') {
      // Reset all failed emails for retry
      const { data, error } = await supabase
        .from('email_queue')
        .update({
          status: 'pending',
          attempts: 0,
          next_retry_at: new Date().toISOString(),
          error: null
        })
        .eq('status', 'failed')
        .select()

      if (error) {
        return NextResponse.json({ error: 'Failed to retry emails' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `${data?.length || 0} failed emails queued for retry`
      })
    }

    if (action === 'delete' && emailId) {
      // Delete a specific email from queue
      const { error } = await supabase
        .from('email_queue')
        .delete()
        .eq('id', emailId)

      if (error) {
        return NextResponse.json({ error: 'Failed to delete email' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Email deleted from queue'
      })
    }

    if (action === 'clear_old') {
      // Clear emails older than 30 days that are sent
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data, error } = await supabase
        .from('email_queue')
        .delete()
        .eq('status', 'sent')
        .lt('created_at', thirtyDaysAgo.toISOString())
        .select()

      if (error) {
        return NextResponse.json({ error: 'Failed to clear old emails' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `${data?.length || 0} old emails cleared`
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('[EmailQueue] Action error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
