import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdminAuth } from '@/lib/auth/admin-session'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { handleApiError, successResponse } from '@/lib/api/api-error-handler'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, ...getRateLimitTuple('ADMIN_READ'))
    if (rateLimitResponse) return rateLimitResponse

    const authError = await requireSuperAdminAuth()
    if (authError) return authError

    const supabase = getServiceRoleClient()

    const { data: admins, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, admin_sub_role, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[AdminUsers] Error fetching admin users:', error)
      return NextResponse.json(
        { error: 'Failed to fetch admin users' },
        { status: 500 }
      )
    }

    return successResponse({ admins: admins || [] })
  } catch (error) {
    return handleApiError(error, 'AdminUsers')
  }
}
