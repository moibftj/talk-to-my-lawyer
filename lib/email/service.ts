import type {
  EmailProvider,
  EmailMessage,
  EmailResult,
  EmailProviderInterface,
  EmailTemplate,
  TemplateData,
} from './types'
import { BrevoProvider } from './providers/brevo'
import { SMTPProvider, createSMTPProvider } from './providers/smtp'
import { ConsoleProvider } from './providers/console'
import { ResendProvider } from './providers/resend'
import { SendGridProvider } from './providers/sendgrid'
import { renderTemplate } from './templates'

class EmailService {
  private providers: Map<EmailProvider, EmailProviderInterface> = new Map()
  private defaultProvider: EmailProvider
  private fromEmail: string
  private fromName: string

  constructor() {
    // Initialize Resend provider (primary)
    this.providers.set('resend', new ResendProvider())

    // Initialize Brevo API provider
    this.providers.set('brevo', new BrevoProvider())

    // Initialize SendGrid provider
    this.providers.set('sendgrid', new SendGridProvider())

    // Initialize SMTP provider from environment variables
    try {
      const smtpHost = process.env.SMTP_HOST
      const smtpPort = process.env.SMTP_PORT
      const smtpUser = process.env.SMTP_USER
      const smtpPass = process.env.SMTP_PASS

      if (smtpHost && smtpPort && smtpUser && smtpPass) {
        const smtpProvider = createSMTPProvider({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass
        })
        this.providers.set('smtp', smtpProvider)
      }
    } catch (error) {
      console.warn('[EmailService] Failed to initialize SMTP provider:', error)
    }

    this.providers.set('console', new ConsoleProvider())

    this.fromEmail = process.env.EMAIL_FROM || 'noreply@talk-to-my-lawyer.com'
    this.fromName = process.env.EMAIL_FROM_NAME || 'Talk-To-My-Lawyer'
    this.defaultProvider = this.determineDefaultProvider()
  }

  private determineDefaultProvider(): EmailProvider {
    const configuredProvider = process.env.EMAIL_PROVIDER as EmailProvider | undefined

    if (configuredProvider && this.providers.has(configuredProvider)) {
      const provider = this.providers.get(configuredProvider)!
      if (provider.isConfigured()) {
        return configuredProvider
      }
    }

    // Check provider priority order - Resend first, then Brevo, SendGrid, SMTP, console
    const providerPriority: EmailProvider[] = ['resend', 'brevo', 'sendgrid', 'smtp']

    for (const providerName of providerPriority) {
      const provider = this.providers.get(providerName)
      if (provider && provider.isConfigured()) {
        return providerName
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[EmailService] Using console provider in development mode')
      return 'console'
    }

    console.warn('[EmailService] No email provider configured, using console fallback')
    return 'console'
  }

  getProvider(name?: EmailProvider): EmailProviderInterface {
    const providerName = name || this.defaultProvider
    const provider = this.providers.get(providerName)

    if (!provider) {
      throw new Error(`Unknown email provider: ${providerName}`)
    }

    return provider
  }

  isConfigured(): boolean {
    return this.defaultProvider !== 'console' || process.env.NODE_ENV === 'development'
  }

  getDefaultFrom(): { email: string; name: string } {
    return {
      email: this.fromEmail,
      name: this.fromName,
    }
  }

  async send(message: EmailMessage, provider?: EmailProvider): Promise<EmailResult> {
    const emailProvider = this.getProvider(provider)

    const messageWithDefaults: EmailMessage = {
      ...message,
      from: message.from || this.getDefaultFrom(),
    }

    try {
      const result = await emailProvider.send(messageWithDefaults)

      if (result.success) {
        console.log(`[EmailService] Email sent successfully via ${result.provider}:`, {
          to: message.to,
          subject: message.subject,
          messageId: result.messageId,
        })
      } else {
        console.error(`[EmailService] Failed to send email via ${result.provider}:`, result.error)
      }

      return result
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[EmailService] Unexpected error:', errorMessage)

      return {
        success: false,
        error: errorMessage,
        provider: emailProvider.name,
      }
    }
  }

  async sendTemplate(
    template: EmailTemplate,
    to: string | string[],
    data: TemplateData,
    provider?: EmailProvider
  ): Promise<EmailResult> {
    const { subject, text, html } = renderTemplate(template, data)

    return this.send(
      {
        to,
        subject,
        text,
        html,
      },
      provider
    )
  }

  async sendWithRetry(
    message: EmailMessage,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<EmailResult> {
    let lastResult: EmailResult | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.send(message)

      if (result.success) {
        return result
      }

      lastResult = result
      console.warn(`[EmailService] Attempt ${attempt}/${maxRetries} failed:`, result.error)

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
      }
    }

    return lastResult || {
      success: false,
      error: 'Max retries exceeded',
      provider: this.defaultProvider,
    }
  }
}

let emailServiceInstance: EmailService | null = null

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService()
  }
  return emailServiceInstance
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  return getEmailService().send(message)
}

export async function sendTemplateEmail(
  template: EmailTemplate,
  to: string | string[],
  data: TemplateData
): Promise<EmailResult> {
  return getEmailService().sendTemplate(template, to, data)
}

export { EmailService }