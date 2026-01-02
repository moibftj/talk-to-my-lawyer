import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { sendTemplateEmail } from '@/lib/email/service'
import { validateAdminAction } from '@/lib/admin/letter-actions'

export const runtime = 'nodejs'

interface BatchOperation {
  letterIds: string[]
  action: 'approve' | 'reject' | 'start_review' | 'complete'
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, '1 m')
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    const body: BatchOperation = await request.json()
    const { letterIds, action, notes } = body

    if (!letterIds || !Array.isArray(letterIds) || letterIds.length === 0) {
      return NextResponse.json(
        { error: 'letterIds array is required' },
        { status: 400 }
      )
    }

    if (!action || !['approve', 'reject', 'start_review', 'complete'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: approve, reject, start_review, or complete' },
        { status: 400 }
      )
    }

    // Limit batch size to prevent abuse
    if (letterIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 letters per batch operation' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const results: { id: string; success: boolean; error?: string }[] = []

    // Status mapping for each action
    const statusMap: Record<string, string> = {
      'approve': 'approved',
      'reject': 'rejected',
      'start_review': 'under_review',
      'complete': 'completed'
    }

    const newStatus = statusMap[action]

    // Process each letter
    for (const letterId of letterIds) {
      try {
        // Get current letter with user info
        const { data: letter, error: fetchError } = await supabase
          .from('letters')
          .select(`
            *,
            profiles:user_id (
              id,
              email,
              full_name
            )
          `)
          .eq('id', letterId)
          .single()

        if (fetchError || !letter) {
          results.push({ id: letterId, success: false, error: 'Letter not found' })
          continue
        }

        // Update letter status
        const updateData: Record<string, any> = {
          status: newStatus,
          updated_at: new Date().toISOString()
        }

        if (action === 'approve') {
          updateData.approved_at = new Date().toISOString()
          updateData.final_content = letter.admin_edited_content || letter.ai_draft_content
        }

        if (action === 'reject' && notes) {
          updateData.rejection_reason = notes
        }

        const { error: updateError } = await supabase
          .from('letters')
          .update(updateData)
          .eq('id', letterId)

        if (updateError) {
          results.push({ id: letterId, success: false, error: updateError.message })
          continue
        }

        // Log audit trail
        await supabase.rpc('log_letter_audit', {
          p_letter_id: letterId,
          p_action: `batch_${action}`,
          p_old_status: letter.status,
          p_new_status: newStatus,
          p_notes: notes || `Batch action: ${action}`,
          p_metadata: { batch: true }
        })

        // Send email notification for approve/reject
        const profile = letter.profiles as any
        if (profile?.email && (action === 'approve' || action === 'reject')) {
          const template = action === 'approve' ? 'letter-approved' : 'letter-rejected'
          try {
            await sendTemplateEmail(template, profile.email, {
              userName: profile.full_name || 'there',
              letterTitle: letter.title || 'Legal Letter',
              letterLink: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/letters/${letterId}`,
              alertMessage: notes
            })
          } catch (emailError) {
            console.error(`[BatchLetters] Email failed for ${letterId}:`, emailError)
          }
        }

        results.push({ id: letterId, success: true })
      } catch (error: any) {
        results.push({ id: letterId, success: false, error: error.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Batch ${action} completed: ${successCount} succeeded, ${failCount} failed`,
      results,
      summary: {
        total: letterIds.length,
        succeeded: successCount,
        failed: failCount
      }
    })
  } catch (error: any) {
    console.error('[BatchLetters] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process batch operation', message: error.message },
      { status: 500 }
    )
  }
}
