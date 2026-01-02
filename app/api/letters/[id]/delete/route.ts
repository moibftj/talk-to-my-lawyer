import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

export const runtime = 'nodejs'

// DELETE - Delete a letter (only for subscriber's own letters, and only drafts/rejected)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 100, '1 m')
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the letter to verify ownership and status
    const { data: letter, error: fetchError } = await supabase
      .from('letters')
      .select('id, user_id, status, title')
      .eq('id', id)
      .single()

    if (fetchError || !letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    // Verify ownership
    if (letter.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only delete your own letters' }, { status: 403 })
    }

    // Only allow deletion of certain statuses
    const deletableStatuses = ['draft', 'rejected', 'failed']
    if (!deletableStatuses.includes(letter.status)) {
      return NextResponse.json(
        { 
          error: 'Cannot delete letters that are pending review, approved, or completed. Only drafts, rejected, and failed letters can be deleted.',
          status: letter.status
        }, 
        { status: 400 }
      )
    }

    // Delete the letter
    const { error: deleteError } = await supabase
      .from('letters')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Extra safety check

    if (deleteError) {
      console.error('[DeleteLetter] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete letter' }, { status: 500 })
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

    return NextResponse.json({
      success: true,
      message: 'Letter deleted successfully'
    })
  } catch (error: any) {
    console.error('[DeleteLetter] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
