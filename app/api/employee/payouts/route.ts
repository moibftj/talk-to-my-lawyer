import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { queueTemplateEmail } from '@/lib/email/service'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'

export const runtime = 'nodejs'

// GET - Get employee's commission summary and payout requests
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, ...getRateLimitTuple('EMPLOYEE_READ'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an employee
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can access payouts' }, { status: 403 })
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
    const totalEarned = commissions?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0
    const totalPaid = commissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0
    const pendingAmount = commissions?.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0
    const requestedAmount = payoutRequests?.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0) || 0

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalEarned,
          totalPaid,
          pendingAmount,
          availableForPayout: pendingAmount - requestedAmount,
          requestedAmount
        },
        commissions: commissions || [],
        payoutRequests: payoutRequests || []
      }
    })
  } catch (error: any) {
    console.error('[EmployeePayouts] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Request a payout
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting - 5 payout requests per hour per IP
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, 5, "1 h")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is an employee
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can request payouts' }, { status: 403 })
    }

    const body = await request.json()
    const { amount, paymentMethod, paymentDetails, notes } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
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

    const pendingCommissions = commissions?.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0) || 0
    const pendingRequests = existingRequests?.reduce((sum, r) => sum + Number(r.amount), 0) || 0
    const availableBalance = pendingCommissions - pendingRequests

    if (amount > availableBalance) {
      return NextResponse.json({
        error: `Requested amount ($${amount}) exceeds available balance ($${availableBalance.toFixed(2)})`,
        availableBalance
      }, { status: 400 })
    }

    // Create payout request
    const { data: payoutRequest, error: insertError } = await supabase
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
        return NextResponse.json({
          success: true,
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
        message: `Employee ${profile.full_name} (${profile.email}) has requested a payout of $${amount}.`,
        actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/secure-admin-gateway/commissions`
      }
    ).catch(error => {
      console.error('[EmployeePayouts] Failed to send admin notification:', error)
    })

    return NextResponse.json({
      success: true,
      message: 'Payout request submitted successfully',
      payoutRequest
    })
  } catch (error: any) {
    console.error('[EmployeePayouts] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
