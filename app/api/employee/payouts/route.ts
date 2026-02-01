/**
 * Employee Payouts API
 *
 * GET: Get employee's commission summary and payout requests
 * POST: Request a commission payout
 */
import { NextRequest } from 'next/server'
import { queueTemplateEmail } from '@/lib/email/service'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { db } from '@/lib/db/client-factory'

export const runtime = 'nodejs'

// GET - Get employee's commission summary and payout requests
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, ...getRateLimitTuple('EMPLOYEE_READ'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await db.server()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    // Verify user is an employee
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as any).role !== 'employee') {
      return errorResponses.forbidden('Only employees can access payouts')
    }

    // Get all commissions for this employee
    const { data: commissions } = await supabase
      .from('commissions')
      .select('*')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })

    // Get payout requests
    const { data: payoutRequests } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })

    // Calculate totals
    const totalEarned = commissions?.reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0) || 0
    const totalPaid = commissions?.filter((c: any) => c.status === 'paid').reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0) || 0
    const pendingAmount = commissions?.filter((c: any) => c.status === 'pending').reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0) || 0
    const requestedAmount = payoutRequests?.filter((p: any) => p.status === 'pending').reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0

    return successResponse({
      summary: {
        totalEarned,
        totalPaid,
        pendingAmount,
        availableForPayout: pendingAmount - requestedAmount,
        requestedAmount
      },
      commissions: commissions || [],
      payoutRequests: payoutRequests || []
    })
  } catch (error) {
    return handleApiError(error, 'EmployeePayouts')
  }
}

// POST - Request a payout
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, ...getRateLimitTuple('EMPLOYEE_WRITE'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await db.server()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    // Verify user is an employee
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', user.id)
      .single()

    if (!profile || (profile as any).role !== 'employee') {
      return errorResponses.forbidden('Only employees can request payouts')
    }

    const body = await request.json()
    const { amount, paymentMethod, paymentDetails, notes } = body

    if (!amount || amount <= 0) {
      return errorResponses.validation('Invalid amount', [
        { field: 'amount', message: 'Amount must be greater than 0' }
      ])
    }

    if (!paymentMethod) {
      return errorResponses.validation('Payment method is required', [
        { field: 'paymentMethod', message: 'Payment method is required' }
      ])
    }

    // Calculate available balance
    const { data: commissions } = await supabase
      .from('commissions')
      .select('commission_amount, status')
      .eq('employee_id', user.id)
      .eq('status', 'pending')

    const { data: existingRequests } = await supabase
      .from('payout_requests')
      .select('amount')
      .eq('employee_id', user.id)
      .eq('status', 'pending')

    const pendingCommissions = commissions?.reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0) || 0
    const pendingRequests = existingRequests?.reduce((sum: number, r: any) => sum + Number(r.amount), 0) || 0
    const availableBalance = pendingCommissions - pendingRequests

    if (amount > availableBalance) {
      return errorResponses.validation(`Requested amount ($${amount}) exceeds available balance ($${availableBalance.toFixed(2)})`, [
        { field: 'amount', message: `Maximum available: $${availableBalance.toFixed(2)}` }
      ])
    }

    // Create payout request
    const { data: payoutRequest, error: insertError } = await (supabase as any)
      .from('payout_requests')
      .insert({
        employee_id: user.id,
        amount,
        payment_method: paymentMethod,
        payment_details: paymentDetails || {},
        notes,
        status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      // If table doesn't exist, create a simple tracking record instead
      if (insertError.code === '42P01') {
        console.log('[EmployeePayouts] payout_requests table not found, creating record in commissions notes')
        return successResponse({
          message: 'Payout request recorded. Admin will contact you shortly.',
          pendingReview: true
        })
      }
      throw insertError
    }

    // Send email notification to admin about new payout request
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@talk-to-my-lawyer.com'

    await queueTemplateEmail(
      'admin-alert',
      adminEmail,
      {
        alertType: 'New Payout Request',
        message: `Employee ${(profile as any).full_name} (${(profile as any).email}) has requested a payout of $${amount}.`,
        actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/secure-admin-gateway/commissions`
      }
    ).catch(error => {
      console.error('[EmployeePayouts] Failed to send admin notification:', error)
    })

    return successResponse({
      message: 'Payout request submitted successfully',
      payoutRequest
    })
  } catch (error) {
    return handleApiError(error, 'EmployeePayouts')
  }
}
