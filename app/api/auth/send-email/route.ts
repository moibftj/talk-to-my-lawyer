import { NextRequest, NextResponse } from 'next/server'
import { sendTemplateEmail, sendEmail } from '@/lib/email'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

/**
 * Supabase Auth Hook for sending emails via Resend
 * 
 * This endpoint can be configured as a Supabase Auth Hook to handle
 * email sending through Resend instead of Supabase's default SMTP.
 * 
 * Supported email types:
 * - signup: Email confirmation for new users
 * - recovery: Password reset emails
 * - email_change: Email change confirmation
 * - magic_link: Magic link login emails
 */

// Verify the webhook signature from Supabase
async function verifyWebhookSignature(request: NextRequest): Promise<boolean> {
  // In production, verify the signature using SUPABASE_AUTH_HOOK_SECRET
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!hookSecret) {
    // If no secret is configured, allow requests (for development)
    console.warn('[SendEmail] No SUPABASE_AUTH_HOOK_SECRET configured - skipping signature verification')
    return true
  }
  
  const signature = request.headers.get('x-supabase-signature')
  if (!signature) {
    console.error('[SendEmail] Missing x-supabase-signature header')
    return false
  }
  
  try {
    const clonedReq = request.clone()
    const bodyText = await clonedReq.text()
    
    // Create HMAC using sha256
    const hmac = crypto.createHmac('sha256', hookSecret)
    const digest = 'sha256=' + hmac.update(bodyText).digest('hex')
    
    // Constant time comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature)
    const digestBuffer = Buffer.from(digest)
    
    if (signatureBuffer.length !== digestBuffer.length) {
      return false
    }
    
    return crypto.timingSafeEqual(signatureBuffer, digestBuffer)
  } catch (error) {
    console.error('[SendEmail] Signature verification failed:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    if (!await verifyWebhookSignature(request)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Log the incoming request for debugging
    console.log('[SendEmail] Received webhook:', {
      type: body.type,
      email: body.user?.email,
    })

    const { type, user, email_data } = body

    if (!user?.email) {
      console.error('[SendEmail] No email address provided')
      return NextResponse.json(
        { error: 'No email address provided' },
        { status: 400 }
      )
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://talk-to-my-lawyer.com'
    let result

    switch (type) {
      case 'signup':
      case 'email_confirmation': {
        // Send email confirmation
        const confirmationUrl = email_data?.confirmation_url || 
          `${siteUrl}/auth/confirm?token=${email_data?.token}&type=signup`
        
        result = await sendTemplateEmail(
          'email-confirmation',
          user.email,
          {
            userName: user.user_metadata?.full_name?.split(' ')[0] || 'there',
            actionUrl: confirmationUrl,
          }
        )
        break
      }

      case 'recovery':
      case 'password_recovery': {
        // Send password reset email
        const resetUrl = email_data?.confirmation_url || 
          `${siteUrl}/auth/reset-password?token=${email_data?.token}`
        
        result = await sendTemplateEmail(
          'password-reset',
          user.email,
          {
            userName: user.user_metadata?.full_name?.split(' ')[0] || 'there',
            actionUrl: resetUrl,
          }
        )
        break
      }

      case 'email_change': {
        // Send email change confirmation
        const confirmUrl = email_data?.confirmation_url || 
          `${siteUrl}/auth/confirm?token=${email_data?.token}&type=email_change`
        
        result = await sendEmail({
          to: user.email,
          subject: 'Confirm Email Change - Talk-To-My-Lawyer',
          html: `
            <h2>Confirm Your New Email Address</h2>
            <p>You requested to change your email address. Click the button below to confirm:</p>
            <p><a href="${confirmUrl}" style="background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Confirm Email Change</a></p>
            <p>If you didn't request this change, please ignore this email.</p>
          `,
          text: `Confirm your new email address: ${confirmUrl}`,
        })
        break
      }

      case 'magic_link': {
        // Send magic link login email
        const magicLinkUrl = email_data?.confirmation_url || 
          `${siteUrl}/auth/confirm?token=${email_data?.token}&type=magiclink`
        
        result = await sendEmail({
          to: user.email,
          subject: 'Your Login Link - Talk-To-My-Lawyer',
          html: `
            <h2>Your Magic Login Link</h2>
            <p>Click the button below to log in to your account:</p>
            <p><a href="${magicLinkUrl}" style="background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Log In</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          `,
          text: `Log in to your account: ${magicLinkUrl}`,
        })
        break
      }

      default:
        console.warn('[SendEmail] Unknown email type:', type)
        return NextResponse.json(
          { error: `Unknown email type: ${type}` },
          { status: 400 }
        )
    }

    if (result?.success) {
      console.log('[SendEmail] Email sent successfully:', {
        type,
        to: user.email,
        messageId: result.messageId,
      })
      return NextResponse.json({ success: true, messageId: result.messageId })
    } else {
      console.error('[SendEmail] Failed to send email:', result?.error)
      return NextResponse.json(
        { error: result?.error || 'Failed to send email' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('[SendEmail] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Also support GET for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Supabase Auth Email Hook Endpoint',
    supportedTypes: ['signup', 'email_confirmation', 'recovery', 'password_recovery', 'email_change', 'magic_link'],
  })
}
