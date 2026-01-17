import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTemplateEmail } from '@/lib/email'
import { getServiceRoleClient } from '@/lib/supabase/admin'

/**
 * API endpoint to resend confirmation emails via Resend
 * 
 * This is useful when:
 * 1. User didn't receive the original confirmation email
 * 2. Supabase's default SMTP is not working
 * 3. You want to use custom email templates
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Create Supabase admin client
    const supabase = getServiceRoleClient()

    // Get user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('[ResendConfirmation] Error listing users:', listError)
      return NextResponse.json(
        { error: 'Failed to find user' },
        { status: 500 }
      )
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a confirmation link will be sent.',
      })
    }

    // Check if already confirmed
    if (user.email_confirmed_at) {
      return NextResponse.json({
        success: true,
        message: 'This email is already confirmed. You can log in.',
        alreadyConfirmed: true,
      })
    }

    // Generate a new confirmation link using Supabase
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: user.email!,
      password: 'temp-password-placeholder',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://talk-to-my-lawyer.com'}/dashboard`,
      }
    } as any)

    if (linkError) {
      console.error('[ResendConfirmation] Error generating link:', linkError)
      return NextResponse.json(
        { error: 'Failed to generate confirmation link' },
        { status: 500 }
      )
    }

    // Send confirmation email via Resend
    const confirmationUrl = linkData.properties?.action_link || 
      `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?token=${linkData.properties?.hashed_token}`

    const result = await sendTemplateEmail(
      'email-confirmation',
      user.email!,
      {
        userName: user.user_metadata?.full_name?.split(' ')[0] || 'there',
        actionUrl: confirmationUrl,
      }
    )

    if (result.success) {
      console.log('[ResendConfirmation] Confirmation email sent:', {
        to: user.email,
        messageId: result.messageId,
      })
      
      return NextResponse.json({
        success: true,
        message: 'Confirmation email sent successfully. Please check your inbox.',
      })
    } else {
      console.error('[ResendConfirmation] Failed to send email:', result.error)
      return NextResponse.json(
        { error: 'Failed to send confirmation email' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('[ResendConfirmation] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
