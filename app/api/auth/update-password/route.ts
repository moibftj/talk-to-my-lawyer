import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, ...getRateLimitTuple('AUTH_UPDATE_PASSWORD'))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const { newPassword } = await request.json()

    if (!newPassword) {
      return NextResponse.json({ error: 'New password is required' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
    }

    const supabase = await createClient()

    // For Supabase password reset, we don't need to manually handle tokens
    // The session will have the user context when they click the reset link
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[Update Password] No authenticated user:', userError)
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    }

    // Update the user's password
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      console.error('[Update Password] Error:', error)
      return NextResponse.json({ error: 'Failed to update password' }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Password updated successfully',
      success: true
    })

  } catch (error: any) {
    console.error('[Update Password] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    )
  }
}