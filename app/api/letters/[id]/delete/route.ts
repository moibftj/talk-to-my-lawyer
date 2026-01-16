import { NextRequest } from 'next/server'
import { apiRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { requireAuth } from '@/lib/auth/authenticate-user'
import { errorResponses, handleApiError, successResponse } from '@/lib/api/api-error-handler'
import { getRateLimitTuple } from '@/lib/config'

export const runtime = 'nodejs'

// DELETE - Delete a letter (only for subscriber's own letters, and only drafts/rejected)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, ...getRateLimitTuple('LETTER_DELETE'))
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params

    const { user, supabase } = await requireAuth()

    // Fetch the letter to verify ownership and status
    const { data: letter, error: fetchError } = await supabase
      .from('letters')
      .select('id, user_id, status, title')
      .eq('id', id)
      .single()

    if (fetchError || !letter) {
      return errorResponses.notFound('Letter')
    }

    // Verify ownership
    if (letter.user_id !== user.id) {
      return errorResponses.forbidden('You can only delete your own letters')
    }

    // Only allow deletion of certain statuses
    const deletableStatuses = ['draft', 'rejected', 'failed']
    if (!deletableStatuses.includes(letter.status)) {
      return errorResponses.validation(
        'Cannot delete letters that are pending review, approved, or completed. Only drafts, rejected, and failed letters can be deleted.'
      )
    }

    // Delete the letter
    const { error: deleteError } = await supabase
      .from('letters')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Extra safety check

    if (deleteError) {
      throw deleteError
    }

    // Log the deletion in audit trail if function exists
    try {
      await supabase.rpc('log_letter_audit', {
        p_letter_id: id,
        p_action: 'deleted',
        p_old_status: letter.status,
        p_new_status: 'deleted',
        p_notes: `Letter deleted: ${letter.title || 'Untitled'}`,
        p_metadata: { title: letter.title }
      })
    } catch (err) {
      console.warn('[DeleteLetter] Audit log failed:', err)
    }

    return successResponse({
      success: true,
      message: 'Letter deleted successfully'
    })
  } catch (error) {
    return handleApiError(error, 'Delete Letter')
  }
}
