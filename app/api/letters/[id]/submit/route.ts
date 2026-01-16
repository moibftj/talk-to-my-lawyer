import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/authenticate-user'
import { apiRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { errorResponses, handleApiError, successResponse } from '@/lib/api/api-error-handler'
import { getRateLimitTuple } from '@/lib/config'

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  'draft': ['pending_review'],
  'generating': ['pending_review', 'failed'],
  'failed': ['draft'], // Allow retry
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, ...getRateLimitTuple('LETTER_SUBMIT'))
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params

    const { user, supabase } = await requireAuth()

    // Fetch current letter to validate status transition
    const { data: letter, error: letterFetchError } = await supabase
      .from('letters')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (letterFetchError || !letter) {
      return errorResponses.notFound('Letter')
    }

    const oldStatus = letter.status
    const newStatus = 'pending_review'

    // Validate status transition
    const allowedTransitions = VALID_TRANSITIONS[oldStatus] || []
    if (!allowedTransitions.includes(newStatus)) {
      return errorResponses.validation(`Cannot transition from ${oldStatus} to ${newStatus}`)
    }

    // Use atomic check for allowance
    const { data: allowance } = await supabase.rpc('check_letter_allowance', { u_id: user.id })
    
    const { count: letterCount } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('status', 'eq', 'failed')

    const isFreeTrial = (letterCount || 0) === 0

    if (!isFreeTrial) {
      if (!allowance?.has_access || (allowance?.letters_remaining || 0) <= 0) {
        return errorResponses.forbidden('No letter allowances remaining. Please purchase more letters or upgrade your plan.')
      }

      // Deduct allowance for non-free-trial users
      const { data: canDeduct, error: deductError } = await supabase
        .rpc('deduct_letter_allowance', { u_id: user.id })

      if (deductError || !canDeduct) {
        return errorResponses.forbidden('No letter allowances remaining. Please purchase more letters or upgrade your plan.')
      }
    }

    const { error: updateError } = await supabase
      .from('letters')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    // Log audit trail for status change
    await supabase.rpc('log_letter_audit', {
      p_letter_id: id,
      p_action: 'submitted',
      p_old_status: oldStatus,
      p_new_status: newStatus,
      p_notes: 'Letter submitted for review by user'
    })

    return successResponse({ success: true })
  } catch (error) {
    return handleApiError(error, 'Letter Submit')
  }
}
