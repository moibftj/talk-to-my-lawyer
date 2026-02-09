/**
 * Consolidated admin action handlers
 * Reduces duplication across approve, reject, and other admin letter actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import {
  validateAdminAction,
  validateLetterStatusTransition,
  handleCSRFTokenRequest,
  updateLetterStatus,
  notifyLetterOwner,
  sanitizeReviewData,
} from '@/lib/admin/letter-actions'
import { successResponse, errorResponses, ValidationError } from '@/lib/api/api-error-handler'
import type { LetterStatus } from '@/lib/types/letter.types'
import type { EmailTemplate } from '@/lib/email/types'

/**
 * Configuration for letter status actions
 */
export interface LetterActionConfig {
  status: LetterStatus
  requiredFields: string[]
  auditAction: string
  successMessage: string
  templateName: EmailTemplate
  additionalFields?: Record<string, unknown>
}

/**
 * Pre-defined action configurations
 */
export const letterActions: Record<string, LetterActionConfig> = {
  approve: {
    status: 'approved',
    requiredFields: ['finalContent'],
    auditAction: 'approved',
    successMessage: 'Letter approved successfully',
    templateName: 'letter-approved',
    additionalFields: {
      approved_at: () => new Date().toISOString(),
    },
  },
  reject: {
    status: 'rejected',
    requiredFields: ['rejectionReason'],
    auditAction: 'rejected',
    successMessage: 'Letter rejected',
    templateName: 'letter-rejected',
  },
}

/**
 * GET handler for CSRF token - used by all admin action routes
 */
export async function getAdminCSRFToken(): Promise<NextResponse> {
  try {
    return await handleCSRFTokenRequest()
  } catch (error) {
    console.error('[Admin] CSRF token endpoint error:', error)
    return errorResponses.serverError('Failed to generate CSRF token')
  }
}

/**
 * Extract and validate letter ID from route params
 */
export function getLetterId(params: { id: string }): string {
  const { id: letterId } = params
  return letterId
}

/**
 * Parse and validate request body for letter actions
 */
export function parseActionBody(
  body: Record<string, unknown>,
  requiredFields: string[]
): { data: Record<string, string>; error?: NextResponse } {
  const data: Record<string, string> = {}

  for (const field of requiredFields) {
    const value = body[field]
    if (!value || typeof value !== 'string') {
      return {
        data,
        error: errorResponses.validation(
          `${field.charAt(0).toUpperCase() + field.slice(1)} is required`
        ),
      }
    }
    data[field] = value
  }

  // Optional fields
  if (body.reviewNotes && typeof body.reviewNotes === 'string') {
    data.reviewNotes = body.reviewNotes
  }

  return { data }
}

/**
 * Process letter action with common workflow
 */
export async function processLetterAction(
  request: NextRequest,
  letterId: string,
  actionName: string,
  bodyData: Record<string, string>
): Promise<NextResponse> {
  const actionConfig = letterActions[actionName]
  if (!actionConfig) {
    return errorResponses.serverError('Invalid action configuration')
  }

  // 1. Sanitize and validate input
  const sanitizationResult = sanitizeReviewData(bodyData)
  if (!sanitizationResult.valid) {
    return errorResponses.validation(sanitizationResult.error || 'Invalid input data')
  }

  // 2. Build additional fields with any dynamic values
  const additionalFields: Record<string, unknown> = {
    ...actionConfig.additionalFields,
  }

  // Execute dynamic field functions
  if (actionConfig.additionalFields) {
    for (const [key, value] of Object.entries(actionConfig.additionalFields)) {
      if (typeof value === 'function') {
        additionalFields[key] = value()
      }
    }
  }

  // Add sanitized data to additional fields
  Object.assign(additionalFields, sanitizationResult.sanitized)

  // 3. Build audit notes
  const auditNotes = buildAuditNotes(actionName, sanitizationResult.sanitized)

  // 4. Update letter status with audit trail
  const { letter } = await updateLetterStatus({
    letterId,
    status: actionConfig.status,
    additionalFields,
    auditAction: actionConfig.auditAction,
    auditNotes,
  })

  if (letter?.user_id) {
    await notifyLetterOwner({
      userId: letter.user_id,
      letterId,
      templateName: actionConfig.templateName,
      templateData: {
        letterTitle: letter.title || 'Your letter',
        ...(bodyData.rejectionReason && { rejectionReason: bodyData.rejectionReason }),
      },
    }).catch((error) => {
      console.error(`[Admin] Failed to send notification:`, error)
    })
  }

  if (actionName === 'approve') {
    const { isN8nPdfConfigured, generatePdfViaN8n } = await import('@/lib/services/n8n-webhook-service')

    if (isN8nPdfConfigured()) {
      generatePdfViaN8n({
        letterId,
        userId: letter.user_id,
      }).then((result) => {
        console.log(`[Admin] PDF generation triggered for letter ${letterId}:`, result.success ? 'success' : 'failed')
      }).catch((error) => {
        console.error(`[Admin] PDF generation failed for letter ${letterId}:`, error)
      })
    } else {
      console.log(`[Admin] n8n PDF webhook not configured, skipping PDF generation for letter ${letterId}`)
    }
  }

  return successResponse({ success: true, message: actionConfig.successMessage })
}

/**
 * Build audit notes based on action type
 */
function buildAuditNotes(
  actionName: string,
  sanitized: Record<string, string | null>
): string {
  switch (actionName) {
    case 'approve':
      return sanitized.reviewNotes || 'Letter approved by admin'
    case 'reject':
      return `Rejection reason: ${sanitized.rejectionReason}`
    default:
      return `${actionName} action performed by admin`
  }
}

/**
 * Complete admin action handler with rate limiting, validation, and processing
 * Use this for POST endpoints in admin letter action routes
 */
export async function handleAdminLetterAction(
  request: NextRequest,
  params: { id: string },
  actionName: string
): Promise<NextResponse> {
  try {
    // 1. Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, '15 m')
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // 2. Validate admin authentication and CSRF
    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    // 3. Get letter ID
    const letterId = getLetterId(params)

    // 4. Validate status transition (super admin can override, attorney cannot)
    const statusValidationError = await validateLetterStatusTransition(letterId, actionName as 'approve' | 'reject')
    if (statusValidationError) return statusValidationError

    // 5. Parse request body
    const body = await request.json()

    // 6. Validate required fields for this action
    const actionConfig = letterActions[actionName]
    const { data: bodyData, error: parseError } = parseActionBody(
      body,
      actionConfig.requiredFields
    )
    if (parseError) return parseError

    // 7. Process the action
    return await processLetterAction(request, letterId, actionName, bodyData)
  } catch (error) {
    console.error(`[Admin] ${actionName} error:`, error)
    return errorResponses.serverError(`Failed to ${actionName} letter`)
  }
}
