/**
 * Shared utilities for admin letter review routes
 * Reduces code duplication across approve, reject, and other admin actions
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  requireAdminAuth,
  requireSuperAdminAuth,
  requireAttorneyAdminAccess,
  getAdminSession,
  isSuperAdmin as checkIsSuperAdmin
} from '@/lib/auth/admin-session'
import { validateAdminRequest, generateAdminCSRF } from '@/lib/security/csrf'
import { sanitizeString } from '@/lib/security/input-sanitizer'
import { queueTemplateEmail } from '@/lib/email/service'
import type { EmailTemplate } from '@/lib/email/types'

/**
 * Common authentication and validation for admin letter review routes
 * Accessible by both Super Admin and Attorney Admin
 * Returns null if valid, or error response if invalid
 */
export async function validateAdminAction(request: NextRequest): Promise<NextResponse | null> {
  // Verify admin authentication (both super and attorney admins can review letters)
  const authError = await requireAttorneyAdminAccess()
  if (authError) return authError

  // CSRF Protection for admin actions
  const csrfResult = await validateAdminRequest(request)
  if (!csrfResult.valid) {
    return NextResponse.json(
      { error: 'CSRF validation failed', details: csrfResult.error },
      { status: 403 }
    )
  }

  return null
}

/**
 * Validate that an admin action can be performed on a letter with the given status.
 * Super admins can override any status (including rejecting approved letters).
 * Attorney admins cannot act on already approved/completed letters.
 */
export async function validateLetterStatusTransition(
  letterId: string,
  action: 'approve' | 'reject'
): Promise<NextResponse | null> {
  const supabase = await createClient()

  // Get current letter status
  const { data: letter } = await supabase
    .from('letters')
    .select('status')
    .eq('id', letterId)
    .single()

  if (!letter) {
    return NextResponse.json(
      { error: 'Letter not found' },
      { status: 404 }
    )
  }

  const superAdmin = await checkIsSuperAdmin()

  // Super admin can perform any action on any letter
  if (superAdmin) {
    return null
  }

  // Attorney admin restrictions
  const restrictedStatuses = ['approved', 'completed', 'failed']
  if (restrictedStatuses.includes(letter.status)) {
    return NextResponse.json(
      {
        error: `Cannot ${action} a letter that is ${letter.status}`,
        message: 'This letter has already been finalized. Only a Super Admin can modify it.'
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Authentication and validation for super admin only routes
 * Accessible ONLY by Super Admin
 * Returns null if valid, or error response if invalid
 */
export async function validateSystemAdminAction(request: NextRequest): Promise<NextResponse | null> {
  // Verify super admin authentication
  const authError = await requireSuperAdminAuth()
  if (authError) return authError

  // CSRF Protection for admin actions
  const csrfResult = await validateAdminRequest(request)
  if (!csrfResult.valid) {
    return NextResponse.json(
      { error: 'CSRF validation failed', details: csrfResult.error },
      { status: 403 }
    )
  }

  return null
}

/**
 * Generate CSRF token for GET requests
 */
export async function handleCSRFTokenRequest(): Promise<NextResponse> {
  const authError = await requireAttorneyAdminAccess()
  if (authError) return authError

  try {
    const csrfData = generateAdminCSRF()
    const response = NextResponse.json({
      csrfToken: csrfData.signedToken,
      expiresAt: csrfData.expiresAt
    })
    response.headers.set('Set-Cookie', csrfData.cookieHeader)
    return response
  } catch (csrfError) {
    console.error('[Admin] CSRF generation error:', csrfError)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}

/**
 * Update letter status with audit trail
 */
export async function updateLetterStatus(params: {
  letterId: string
  status?: string
  additionalFields?: Record<string, unknown>
  auditAction: string
  auditNotes: string
}) {
  const supabase = await createClient()
  const adminSession = await getAdminSession()
  const { letterId, status, additionalFields = {}, auditAction, auditNotes } = params

  // Get current letter status
  const { data: letter } = await supabase
    .from('letters')
    .select('status, user_id, title')
    .eq('id', letterId)
    .single()

  // Update letter with new status (only include status if provided)
  const updateData: Record<string, unknown> = {
    reviewed_by: adminSession?.userId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...additionalFields
  }

  if (status !== undefined) {
    updateData.status = status
  }

  const { error: updateError } = await supabase
    .from('letters')
    .update(updateData)
    .eq('id', letterId)

  if (updateError) throw updateError

  // Log audit trail (use provided status or current status if unchanged)
  await supabase.rpc('log_letter_audit', {
    p_letter_id: letterId,
    p_action: auditAction,
    p_old_status: letter?.status || 'unknown',
    p_new_status: status ?? letter?.status ?? 'unknown',
    p_notes: auditNotes
  })

  return { letter, updateData }
}

/**
 * Get all admin email addresses from the database
 */
export async function getAdminEmails(): Promise<string[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'admin')

  return data?.map((p: { email: string | null }) => p.email).filter(Boolean) as string[] || []
}

/**
 * Send notification email to letter owner
 */
export async function notifyLetterOwner(params: {
  userId: string
  letterId: string
  templateName: EmailTemplate
  templateData: Record<string, unknown>
}) {
  const supabase = await createClient()
  const { userId, letterId, templateName, templateData } = params

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single()

  if (profile?.email) {
    // Queue email for reliable delivery with automatic retries
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    queueTemplateEmail(templateName, profile.email, {
      userName: profile.full_name || 'there',
      ...templateData,
      letterLink: `${siteUrl}/dashboard/letters/${letterId}`,
      actionUrl: `${siteUrl}/dashboard/letters/${letterId}`,
    }).catch(error => {
      console.error(`[Admin] Failed to queue ${templateName} email:`, error)
    })
  }
}

/**
 * Sanitize and validate review notes and content
 */
export function sanitizeReviewData(data: {
  finalContent?: string
  reviewNotes?: string
  rejectionReason?: string
}): {
  valid: boolean
  sanitized: Record<string, string | null>
  error?: string
} {
  const result: Record<string, string | null> = {}

  if (data.finalContent !== undefined) {
    const sanitized = sanitizeString(data.finalContent, 10000)
    if (!sanitized) {
      return { valid: false, sanitized: {}, error: 'Invalid final content provided' }
    }
    result.finalContent = sanitized
  }

  if (data.reviewNotes !== undefined) {
    result.reviewNotes = data.reviewNotes ? sanitizeString(data.reviewNotes, 2000) : null
  }

  if (data.rejectionReason !== undefined) {
    const sanitized = sanitizeString(data.rejectionReason, 1000)
    if (!sanitized) {
      return { valid: false, sanitized: {}, error: 'Invalid rejection reason provided' }
    }
    result.rejectionReason = sanitized
  }

  return { valid: true, sanitized: result }
}
