import { NextRequest } from 'next/server'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { requireAuth } from '@/lib/auth/authenticate-user'

export const runtime = 'nodejs'

// POST - Save draft letter content (auto-save)
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth()

    const body = await request.json()
    const { letterId, title, content, letterType, recipientInfo, senderInfo, metadata } = body

    // If letterId is provided, update existing draft
    if (letterId) {
      // Verify ownership
      const { data: existingLetter, error: fetchError } = await supabase
        .from('letters')
        .select('id, user_id, status')
        .eq('id', letterId)
        .single()

      if (fetchError || !existingLetter) {
        return errorResponses.notFound('Draft')
      }

      if (existingLetter.user_id !== user.id) {
        return errorResponses.forbidden('Unauthorized')
      }

      // Only allow updating drafts
      if (existingLetter.status !== 'draft') {
        return errorResponses.validation('Can only auto-save draft letters')
      }

      // Update the draft
      const { data: updated, error: updateError } = await supabase
        .from('letters')
        .update({
          title: title || null,
          letter_type: letterType || null,
          ai_draft_content: content || null,
          recipient_name: recipientInfo?.name || null,
          recipient_email: recipientInfo?.email || null,
          recipient_company: recipientInfo?.company || null,
          recipient_address: recipientInfo?.address || null,
          sender_name: senderInfo?.name || null,
          sender_company: senderInfo?.company || null,
          draft_metadata: metadata || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', letterId)
        .select('id, updated_at')
        .single()

      if (updateError) {
        throw updateError
      }

      return successResponse({
        success: true,
        message: 'Draft saved',
        letterId: updated.id,
        savedAt: updated.updated_at
      })
    }

    // Create new draft
    const { data: newDraft, error: createError } = await supabase
      .from('letters')
      .insert({
        user_id: user.id,
        title: title || 'Untitled Draft',
        letter_type: letterType || null,
        status: 'draft',
        ai_draft_content: content || null,
        recipient_name: recipientInfo?.name || null,
        recipient_email: recipientInfo?.email || null,
        recipient_company: recipientInfo?.company || null,
        recipient_address: recipientInfo?.address || null,
        sender_name: senderInfo?.name || null,
        sender_company: senderInfo?.company || null,
        draft_metadata: metadata || null
      })
      .select('id, created_at')
      .single()

    if (createError) {
      throw createError
    }

    return successResponse({
      success: true,
      message: 'Draft created',
      letterId: newDraft.id,
      savedAt: newDraft.created_at,
      isNew: true
    })
  } catch (error) {
    return handleApiError(error, 'Draft Save')
  }
}

// GET - Get list of drafts
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuth()

    const { data: drafts, error } = await supabase
      .from('letters')
      .select('id, title, letter_type, updated_at, created_at')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(10)

    if (error) {
      throw error
    }

    return successResponse({
      success: true,
      drafts: drafts || []
    })
  } catch (error) {
    return handleApiError(error, 'Draft List')
  }
}
