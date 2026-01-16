import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
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

    // Get current letter status
    const { data: letter } = await supabase
      .from('letters')
      .select('status, user_id')
      .eq('id', id)
      .single()

    if (!letter) {
      return errorResponses.notFound('Letter')
    }

    // Can only complete approved letters
    if (letter.status !== 'approved') {
      return errorResponses.validation('Letter must be approved before it can be completed')
    }

    const { error: updateError } = await supabase
      .from('letters')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Log the completion
    await supabase.rpc('log_letter_audit', {
      p_letter_id: id,
      p_action: 'completed',
      p_old_status: 'approved',
      p_new_status: 'completed',
      p_notes: 'Letter marked as completed'
    })

    return successResponse({ success: true })
  } catch (error) {
    return handleApiError(error, 'Complete Letter')
  }
}
