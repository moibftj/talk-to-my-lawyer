import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/admin-session'
import { validateAdminAction } from '@/lib/admin/letter-actions'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { errorResponses, handleApiError, successResponse } from '@/lib/api/api-error-handler'
import { getRateLimitTuple } from '@/lib/config'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, ...getRateLimitTuple('ADMIN_WRITE'))
    if (rateLimitResponse) return rateLimitResponse

    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    const { id } = await params
    const supabase = await createClient()
    const adminSession = await getAdminSession()

    const { data: letter } = await supabase
      .from('letters')
      .select('status')
      .eq('id', id)
      .single()

    if (!letter) {
      return errorResponses.notFound('Letter')
    }

    const { error: updateError } = await supabase
      .from('letters')
      .update({
        status: 'under_review',
        reviewed_by: adminSession?.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    await supabase.rpc('log_letter_audit', {
      p_letter_id: id,
      p_action: 'review_started',
      p_old_status: letter.status,
      p_new_status: 'under_review',
      p_notes: 'Admin started reviewing the letter'
    })

    return successResponse({ success: true })
  } catch (error) {
    return handleApiError(error, 'Start Review')
  }
}
