import { Resend } from 'resend'
import type { EmailMessage, EmailResult, EmailProviderInterface } from '../types'
import { emailConfig } from '@/lib/config'

export class ResendProvider implements EmailProviderInterface {
  name = 'resend' as const
  private client: Resend | undefined
  private fromEmail: string
  private fromName: string

  constructor() {
    const apiKey = emailConfig.apiKey
    if (apiKey) {
      this.client = new Resend(apiKey)
    }
    this.fromEmail = emailConfig.from
    this.fromName = emailConfig.fromName
  }

  isConfigured(): boolean {
    return !!this.client
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.client) {
      console.error('[ResendProvider] Send failed: Resend client not configured (missing RESEND_API_KEY)')
      return {
        success: false,
        error: 'Resend is not configured',
        provider: this.name,
      }
    }

    const from = message.from
      ? `${message.from.name || this.fromName} <${message.from.email || this.fromEmail}>`
      : `${this.fromName} <${this.fromEmail}>`

    // Enhanced logging for delivery tracking
    console.log('[ResendProvider] Attempting to send email:', {
      to: message.to,
      from,
      subject: message.subject,
      hasHtml: !!message.html,
      hasText: !!message.text,
      hasAttachments: !!message.attachments?.length,
      replyTo: message.replyTo,
    })

    try {
      // Build email parameters with proper typing
      const emailParams: {
        from: string
        to: string | string[]
        subject: string
        html: string
        text?: string
        replyTo?: string | string[]
        attachments?: Array<{ filename: string; content: string }>
      } = {
        from,
        to: message.to,
        subject: message.subject,
        html: message.html || '',
      }

      // Add text version if provided
      if (message.text) {
        emailParams.text = message.text
      }

      // Add reply-to for better deliverability
      if (message.replyTo) {
        emailParams.replyTo = message.replyTo
      }

      // Add attachments if present
      if (message.attachments && message.attachments.length > 0) {
        emailParams.attachments = message.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
        }))
      }

      const result = await this.client.emails.send(emailParams)

      if (result.error) {
        console.error('[ResendProvider] Send failed with error:', {
          to: message.to,
          subject: message.subject,
          errorCode: result.error.statusCode,
          errorMessage: result.error.message,
          errorName: result.error.name,
        })
        return {
          success: false,
          error: result.error.message,
          provider: this.name,
        }
      }

      // Success logging
      console.log('[ResendProvider] Email sent successfully:', {
        to: message.to,
        subject: message.subject,
        messageId: result.data?.id,
        provider: this.name,
      })

      return {
        success: true,
        messageId: result.data?.id,
        provider: this.name,
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : undefined

      console.error('[ResendProvider] Unexpected error during send:', {
        to: message.to,
        subject: message.subject,
        errorMessage,
        errorStack,
      })

      return {
        success: false,
        error: errorMessage,
        provider: this.name,
      }
    }
  }
}