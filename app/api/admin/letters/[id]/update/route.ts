import { EmailTemplate } from "@/lib/email/types"
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAction, updateLetterStatus, notifyLetterOwner } from '@/lib/admin/letter-actions'
import { sanitizeReviewData } from '@/lib/admin/letter-actions'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'

/**
 * Admin letter update endpoint
 * Handles: content edit, approve, reject, mark completed
 * POST /api/admin/letters/[id]/update
 *
 * Replaces direct client-side database mutations with secure API calls
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, ...getRateLimitTuple('ADMIN_WRITE'))
    if (rateLimitResponse) return rateLimitResponse

    // Validate admin authentication and CSRF
    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    const { id: letterId } = await params
    const body = await request.json()
    const { action, finalContent, reviewNotes, rejectionReason } = body

    // Validate action
    const validActions = ['edit_content', 'approve', 'reject', 'mark_completed']
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be one of: ' + validActions.join(', ') },
        { status: 400 }
      )
    }

    // Build additional fields and audit notes based on action
    let additionalFields: Record<string, unknown> = {}
    let newStatus: string | undefined = undefined
    let auditAction = ''
    let auditNotes = ''
    let shouldNotify = false
    let emailTemplate: EmailTemplate | null = null

    switch (action) {
      case 'edit_content': {
        const sanitizeResult = sanitizeReviewData({ finalContent })
        if (!sanitizeResult.valid) {
          return NextResponse.json(
            { error: sanitizeResult.error },
            { status: 400 }
          )
        }
        additionalFields = { final_content: sanitizeResult.sanitized.finalContent }
        // newStatus remains undefined to keep current status
        auditAction = 'content_edited'
        auditNotes = 'Letter content edited by admin'
        break
      }

      case 'approve': {
        const sanitizeResult = sanitizeReviewData({
          finalContent,
          reviewNotes
        })
        if (!sanitizeResult.valid) {
          return NextResponse.json(
            { error: sanitizeResult.error },
            { status: 400 }
          )
        }
        if (!sanitizeResult.sanitized.finalContent?.trim()) {
          return NextResponse.json(
            { error: 'Final content is required for approval' },
            { status: 400 }
          )
        }
        additionalFields = {
          final_content: sanitizeResult.sanitized.finalContent,
          review_notes: sanitizeResult.sanitized.reviewNotes
        }
        newStatus = 'approved'
        auditAction = 'approved'
        auditNotes = sanitizeResult.sanitized.reviewNotes || 'Letter approved by admin'
        shouldNotify = true
        emailTemplate = 'letter-approved'
        break
      }

      case 'reject': {
        const sanitizeResult = sanitizeReviewData({
          reviewNotes,
          rejectionReason
        })
        if (!sanitizeResult.valid) {
          return NextResponse.json(
            { error: sanitizeResult.error },
            { status: 400 }
          )
        }
        if (!sanitizeResult.sanitized.rejectionReason?.trim()) {
          return NextResponse.json(
            { error: 'Rejection reason is required' },
            { status: 400 }
          )
        }
        additionalFields = {
          review_notes: sanitizeResult.sanitized.reviewNotes,
          rejection_reason: sanitizeResult.sanitized.rejectionReason
        }
        newStatus = 'rejected'
        auditAction = 'rejected'
        auditNotes = `Rejection reason: ${sanitizeResult.sanitized.rejectionReason}`
        shouldNotify = true
        emailTemplate = 'letter-rejected'
        break
      }

      case 'mark_completed': {
        additionalFields = { completed_at: new Date().toISOString() }
        newStatus = 'completed'
        auditAction = 'completed'
        auditNotes = 'Letter marked as completed by admin'
        break
      }
    }

    // Update letter status with audit trail
    const { letter } = await updateLetterStatus({
      letterId,
      status: newStatus,
      additionalFields,
      auditAction,
      auditNotes
    })

    // Send notification if needed (non-blocking)
    if (shouldNotify && letter?.user_id) {
      await notifyLetterOwner({
        userId: letter.user_id,
        letterId,
        templateName: emailTemplate as EmailTemplate,
        templateData: {
          letterTitle: letter.title || 'Your letter',
          ...(rejectionReason && { rejectionReason })
        }
      }).catch(error => {
        console.error('[Admin] Failed to send notification:', error)
      })
    }

    return NextResponse.json({
      success: true,
      message: `Letter ${action.replace('_', ' ')} successfully`
    })

  } catch (error) {
    console.error('[Admin Letter Update] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update letter' },
      { status: 500 }
    )
  }
}
