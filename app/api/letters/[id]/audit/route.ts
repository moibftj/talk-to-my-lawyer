import { NextRequest } from "next/server"
import { requireAuth } from '@/lib/auth/authenticate-user'
import { errorResponses, handleApiError, successResponse } from '@/lib/api/api-error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await requireAuth()

    // Verify user is admin or employee
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'employee'].includes(profile.role)) {
      return errorResponses.forbidden("Admin or employee access required")
    }

    const { id } = await params;

    // For employees: verify they have a relationship to this letter
    // (i.e., the letter was created by a user who used their referral coupon)
    if (profile.role === 'employee') {
      // Get the letter to find its owner
      const { data: letter } = await supabase
        .from('letters')
        .select('user_id')
        .eq('id', id)
        .single();

      if (!letter) {
        return errorResponses.notFound("Letter")
      }

      // Check if this employee has any relationship to the letter owner
      // (via subscription that used their coupon)
      const { data: relationship } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', letter.user_id)
        .eq('employee_id', user.id)
        .limit(1)
        .single()

      if (!relationship) {
        return errorResponses.forbidden("You do not have permission to view this letter's audit trail")
      }
    }

    // Get audit trail for the letter
    const { data: auditTrail, error } = await supabase
      .from('letter_audit_trail')
      .select(`
        *,
        performer:performed_by (
          id,
          email,
          full_name
        )
      `)
      .eq('letter_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return successResponse({ auditTrail })

  } catch (error) {
    return handleApiError(error, 'Audit Trail')
  }
}
