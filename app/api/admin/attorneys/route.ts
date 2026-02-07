import { NextResponse } from 'next/server'
import { requireSuperAdminAuth } from '@/lib/auth/admin-session'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { handleApiError, successResponse } from '@/lib/api/api-error-handler'

export async function GET() {
  try {
    const authError = await requireSuperAdminAuth()
    if (authError) return authError

    const supabase = getServiceRoleClient()
    const { data: attorneys, error } = await (supabase as any)
      .from('profiles')
      .select('id, email, full_name, admin_sub_role')
      .eq('role', 'admin')
      .order('full_name')

    if (error) throw error

    return successResponse({ attorneys: attorneys || [] })
  } catch (error) {
    return handleApiError(error, 'ListAttorneys')
  }
}
