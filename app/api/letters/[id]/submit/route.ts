import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth/authenticate-user'
import { apiRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  'draft': ['pending_review'],
  'generating': ['pending_review', 'failed'],
  'failed': ['draft'], // Allow retry
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 100, '1 m')
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    
    // Authenticate user
    const authResult = await authenticateUser()
    if (!authResult.authenticated || !authResult.user) {
      return authResult.errorResponse!
    }
    const user = authResult.user

    const supabase = await createClient()

    // Fetch current letter to validate status transition
    const { data: letter, error: letterFetchError } = await supabase
      .from('letters')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (letterFetchError || !letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    const oldStatus = letter.status
    const newStatus = 'pending_review'

    // Validate status transition
    const allowedTransitions = VALID_TRANSITIONS[oldStatus] || []
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json({ 
        error: `Cannot transition from ${oldStatus} to ${newStatus}` 
      }, { status: 400 })
    }

    // Use atomic check for allowance
    const { data: allowance } = await supabase.rpc('check_letter_allowance', { u_id: user.id })
    
    const { count: letterCount } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('status', 'eq', 'failed')

    const isFreeTrial = (letterCount || 0) === 0 && !allowance?.is_super

    if (!isFreeTrial && !allowance?.is_super) {
      if (!allowance?.has_allowance || (allowance?.remaining || 0) <= 0) {
        return NextResponse.json({ 
          error: 'No letter allowances remaining. Please purchase more letters or upgrade your plan.',
          needsSubscription: true 
        }, { status: 403 })
      }

      // Deduct allowance for non-free-trial users
      const { data: canDeduct, error: deductError } = await supabase
        .rpc('deduct_letter_allowance', { u_id: user.id })

      if (deductError || !canDeduct) {
        return NextResponse.json({ 
          error: 'No letter allowances remaining. Please purchase more letters or upgrade your plan.',
          needsSubscription: true 
        }, { status: 403 })
      }
    }

    const { error: updateError } = await supabase
      .from('letters')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    // Log audit trail for status change
    await supabase.rpc('log_letter_audit', {
      p_letter_id: id,
      p_action: 'submitted',
      p_old_status: oldStatus,
      p_new_status: newStatus,
      p_notes: 'Letter submitted for review by user'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Letter submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit letter' },
      { status: 500 }
    )
  }
}
