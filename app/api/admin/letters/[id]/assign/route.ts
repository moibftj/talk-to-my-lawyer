import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdminAuth, getAdminSession } from '@/lib/auth/admin-session'
import { validateAdminRequest } from '@/lib/security/csrf'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { errorResponses, successResponse, handleApiError } from '@/lib/api/api-error-handler'
import { notifyAttorneyLetterAssigned } from '@/lib/services/notification-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireSuperAdminAuth()
    if (authError) return authError

    const supabase = getServiceRoleClient()

    const { data: attorneys, error } = await (supabase as any)
      .from('profiles')
      .select('id, email, full_name, admin_sub_role')
      .eq('role', 'admin')
      .order('full_name')

    if (error) throw error

    return successResponse({ attorneys: attorneys || [] })
  } catch (error) {
    return handleApiError(error, 'GetAttorneys')
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, ...getRateLimitTuple('ADMIN_WRITE'))
    if (rateLimitResponse) return rateLimitResponse

    const authError = await requireSuperAdminAuth()
    if (authError) return authError

    const csrfResult = await validateAdminRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json(
        { error: 'CSRF validation failed', details: csrfResult.error },
        { status: 403 }
      )
    }

    const { id: letterId } = await params
    const body = await request.json()
    const { attorneyId } = body

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    // Validate UUID format if attorneyId is provided and not null
    if (attorneyId !== null && (typeof attorneyId !== 'string' || !UUID_REGEX.test(attorneyId))) {
      return errorResponses.validation('Invalid attorney ID format')
    }

    const supabase = getServiceRoleClient()
    const adminSession = await getAdminSession()

    const { data: letter, error: letterError } = await (supabase as any)
      .from('letters')
      .select('id, status, assigned_to, title, letter_type')
      .eq('id', letterId)
      .single()

    if (letterError || !letter) {
      return errorResponses.notFound('Letter')
    }

    if (attorneyId === null) {
      const { error: updateError } = await (supabase as any)
        .from('letters')
        .update({
          assigned_to: null,
          assigned_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', letterId)

      if (updateError) {
        if (updateError.message?.includes('column') || updateError.message?.includes('assigned_to')) {
          return NextResponse.json({
            error: 'Assignment columns not found in database. Please run the migration SQL in Supabase SQL Editor.',
            migrationRequired: true,
          }, { status: 422 })
        }
        throw updateError
      }

      await (supabase as any).rpc('log_letter_audit', {
        p_letter_id: letterId,
        p_action: 'unassigned',
        p_old_status: letter.status,
        p_new_status: letter.status,
        p_notes: `Letter unassigned by ${adminSession?.email}`,
      })

      return successResponse({ success: true, message: 'Letter unassigned' })
    }

    const { data: attorney, error: attorneyError } = await (supabase as any)
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', attorneyId)
      .eq('role', 'admin')
      .single()

    if (attorneyError || !attorney) {
      return errorResponses.validation('Invalid attorney ID. The user must have an admin role.')
    }

    const { error: updateError } = await (supabase as any)
      .from('letters')
      .update({
        assigned_to: attorneyId,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', letterId)

    if (updateError) {
      if (updateError.message?.includes('column') || updateError.message?.includes('assigned_to')) {
        return NextResponse.json({
          error: 'Assignment columns not found in database. Please run the migration SQL in Supabase SQL Editor.',
          migrationRequired: true,
        }, { status: 422 })
      }
      throw updateError
    }

    await (supabase as any).rpc('log_letter_audit', {
      p_letter_id: letterId,
      p_action: 'assigned',
      p_old_status: letter.status,
      p_new_status: letter.status,
      p_notes: `Assigned to ${attorney.full_name} (${attorney.email}) by ${adminSession?.email}`,
    })

    console.log('[LetterAssignment] Letter assigned:', {
      letterId,
      attorneyId,
      attorneyEmail: attorney.email,
      assignedBy: adminSession?.email,
      timestamp: new Date().toISOString(),
    })

    notifyAttorneyLetterAssigned(
      attorney.email,
      attorney.full_name,
      letter.title || 'Untitled',
      letterId,
      letter.letter_type || 'legal'
    ).catch(console.error)

    return successResponse({
      success: true,
      message: `Letter assigned to ${attorney.full_name}`,
      assignment: {
        letterId,
        assignedTo: attorneyId,
        attorneyName: attorney.full_name,
        attorneyEmail: attorney.email,
        assignedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    return handleApiError(error, 'AssignLetter')
  }
}
