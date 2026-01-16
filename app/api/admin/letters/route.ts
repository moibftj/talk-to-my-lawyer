import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { requireAttorneyAdminAccess } from '@/lib/auth/admin-session'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { handleApiError, successResponse } from '@/lib/api/api-error-handler'
import { getRateLimitTuple } from '@/lib/config'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, ...getRateLimitTuple('ADMIN_READ'))
    if (rateLimitResponse) return rateLimitResponse

    const authError = await requireAttorneyAdminAccess()
    if (authError) return authError

    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    let query = supabase
      .from('letters')
      .select(`
        id,
        title,
        letter_type,
        status,
        created_at,
        approved_at,
        profiles:user_id (
          full_name,
          email
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: letters, error, count } = await query

    if (error) {
      throw error
    }

    return successResponse({
      success: true,
      letters: letters || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (offset + limit) < (count || 0)
      }
    })
  } catch (error) {
    return handleApiError(error, 'Admin Letters')
  }
}
