/**
 * n8n Webhook Service
 *
 * Integrates with n8n workflows for letter generation.
 * Sends form data to n8n, which uses ChatGPT to generate the letter content.
 */

/**
 * Form data structure expected by n8n workflow
 */
export interface N8nLetterFormData {
  // Letter metadata
  letterType: string
  letterId: string
  userId: string

  // Sender information
  senderName: string
  senderAddress: string
  senderState: string
  senderEmail?: string
  senderPhone?: string

  // Recipient information
  recipientName: string
  recipientAddress: string
  recipientState: string
  recipientEmail?: string
  recipientPhone?: string

  // Letter content
  issueDescription: string
  desiredOutcome: string
  additionalDetails?: string

  // Optional fields
  amountDemanded?: number
  deadline?: string
  incidentDate?: string
  courtType?: string
}

/**
 * Response from n8n webhook
 */
export interface N8nGenerationResponse {
  success: boolean
  generatedContent?: string
  letterId?: string
  error?: string
  message?: string
}

interface N8nConfig {
  webhookUrl: string | undefined
  isConfigured: boolean
  timeout: number
  maxRetries: number
}

/**
 * n8n configuration
 */
export const n8nConfig: N8nConfig = {
  get webhookUrl() {
    return process.env.N8N_WEBHOOK_URL
  },
  get isConfigured() {
    return Boolean(process.env.N8N_WEBHOOK_URL)
  },
  timeout: 60000, // 60 seconds - AI generation can take time
  maxRetries: 2,
}

/**
 * Check if n8n integration is available
 */
export function isN8nConfigured(): boolean {
  return n8nConfig.isConfigured
}

/**
 * Generate letter content via n8n workflow
 *
 * Sends form data to n8n, which processes it through ChatGPT
 * and returns the generated letter content.
 *
 * @param formData - The letter form data
 * @returns Generated letter content or throws an error
 */
export async function generateLetterViaN8n(
  formData: N8nLetterFormData
): Promise<string> {
  if (!n8nConfig.isConfigured || !n8nConfig.webhookUrl) {
    throw new Error('n8n webhook is not configured. Set N8N_WEBHOOK_URL environment variable.')
  }

  const webhookUrl = n8nConfig.webhookUrl
  console.log('[n8n] Sending letter generation request for:', formData.letterId)

  for (let attempt = 1; attempt <= n8nConfig.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), n8nConfig.timeout)

      // Transform our form data to match n8n's expected structure
      const n8nPayload = {
        letterType: formData.letterType,
        letterId: formData.letterId,
        userId: formData.userId,

        // Sender info
        senderName: formData.senderName,
        senderAddress: formData.senderAddress,
        senderState: formData.senderState,
        senderEmail: formData.senderEmail,
        senderPhone: formData.senderPhone,

        // Recipient info
        recipientName: formData.recipientName,
        recipientAddress: formData.recipientAddress,
        recipientState: formData.recipientState,
        recipientEmail: formData.recipientEmail,
        recipientPhone: formData.recipientPhone,

        // Content
        issueDescription: formData.issueDescription,
        desiredOutcome: formData.desiredOutcome,
        additionalDetails: formData.additionalDetails,

        // Optional fields
        amountDemanded: formData.amountDemanded,
        deadline: formData.deadline,
        incidentDate: formData.incidentDate,
        courtType: formData.courtType,

        // Metadata
        timestamp: new Date().toISOString(),
        source: 'talk-to-my-lawyer',
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': 'talk-to-my-lawyer',
          'X-Letter-Id': formData.letterId,
        },
        body: JSON.stringify(n8nPayload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 404) {
          throw new Error('n8n workflow not found. Ensure the workflow is active and listening.')
        }

        if (response.status >= 500) {
          console.warn(`[n8n] Server error (${response.status}), attempt ${attempt}/${n8nConfig.maxRetries}`)
          if (attempt < n8nConfig.maxRetries) {
            const delay = Math.pow(2, attempt) * 1000
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }

        const errorText = await response.text()
        throw new Error(`n8n request failed (${response.status}): ${errorText}`)
      }

      const result: N8nGenerationResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || result.message || 'n8n generation failed')
      }

      if (!result.generatedContent) {
        throw new Error('n8n returned success but no generated content')
      }

      console.log('[n8n] Letter generated successfully for:', formData.letterId)
      return result.generatedContent

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`[n8n] Request timeout, attempt ${attempt}/${n8nConfig.maxRetries}`)
        if (attempt < n8nConfig.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error('n8n request timed out after multiple attempts')
      }

      // Don't retry for non-timeout errors
      throw error
    }
  }

  throw new Error('n8n generation failed after all retries')
}

/**
 * Transform app intake data to n8n form data format
 */
export function transformIntakeToN8nFormat(
  letterId: string,
  userId: string,
  letterType: string,
  intakeData: Record<string, unknown>
): N8nLetterFormData {
  return {
    letterId,
    userId,
    letterType,

    // Sender
    senderName: String(intakeData.senderName || ''),
    senderAddress: String(intakeData.senderAddress || ''),
    senderState: String(intakeData.senderState || ''),
    senderEmail: intakeData.senderEmail ? String(intakeData.senderEmail) : undefined,
    senderPhone: intakeData.senderPhone ? String(intakeData.senderPhone) : undefined,

    // Recipient
    recipientName: String(intakeData.recipientName || ''),
    recipientAddress: String(intakeData.recipientAddress || ''),
    recipientState: String(intakeData.recipientState || ''),
    recipientEmail: intakeData.recipientEmail ? String(intakeData.recipientEmail) : undefined,
    recipientPhone: intakeData.recipientPhone ? String(intakeData.recipientPhone) : undefined,

    // Content
    issueDescription: String(intakeData.issueDescription || ''),
    desiredOutcome: String(intakeData.desiredOutcome || ''),
    additionalDetails: intakeData.additionalDetails ? String(intakeData.additionalDetails) : undefined,

    // Optional
    amountDemanded: typeof intakeData.amountDemanded === 'number' ? intakeData.amountDemanded : undefined,
    deadline: intakeData.deadlineDate ? String(intakeData.deadlineDate) : undefined,
    incidentDate: intakeData.incidentDate ? String(intakeData.incidentDate) : undefined,
    courtType: intakeData.courtType ? String(intakeData.courtType) : undefined,
  }
}


// ============================================================================
// Event Notification Functions (for monitoring/alerting workflows)
// These are optional and can be used alongside the generation flow
// ============================================================================

export type N8nLetterEvent =
  | 'letter.generation.started'
  | 'letter.generation.completed'
  | 'letter.generation.failed'
  | 'letter.submitted'
  | 'letter.approved'
  | 'letter.rejected'

export interface N8nEventPayload {
  event: N8nLetterEvent
  timestamp: string
  letterId: string
  letterType?: string
  letterTitle?: string
  status?: string
  userId?: string
  isFreeTrial?: boolean
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Send an event notification to n8n (fire-and-forget)
 * This is separate from generation - used for monitoring/alerting
 */
export async function sendN8nEvent(payload: N8nEventPayload): Promise<boolean> {
  // Use a separate events webhook URL if configured, otherwise skip
  const eventsWebhookUrl = process.env.N8N_EVENTS_WEBHOOK_URL

  if (!eventsWebhookUrl) {
    // Events are optional, silently skip if not configured
    return false
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(eventsWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'talk-to-my-lawyer',
        'X-Webhook-Event': payload.event,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      console.log('[n8n] Event sent:', payload.event)
      return true
    }

    console.warn('[n8n] Event send failed:', response.status)
    return false
  } catch (error) {
    console.warn('[n8n] Event send error:', error)
    return false
  }
}

/**
 * Notify n8n that letter generation completed (for monitoring)
 */
export function notifyN8nLetterCompleted(
  letterId: string,
  letterType: string,
  letterTitle: string,
  userId: string,
  isFreeTrial: boolean
): void {
  sendN8nEvent({
    event: 'letter.generation.completed',
    timestamp: new Date().toISOString(),
    letterId,
    letterType,
    letterTitle,
    userId,
    isFreeTrial,
    status: 'pending_review',
  }).catch(() => {
    // Ignore errors for non-blocking events
  })
}

/**
 * Notify n8n that letter generation failed (for alerting)
 */
export function notifyN8nLetterFailed(
  letterId: string,
  letterType: string,
  userId: string,
  error: string
): void {
  sendN8nEvent({
    event: 'letter.generation.failed',
    timestamp: new Date().toISOString(),
    letterId,
    letterType,
    userId,
    status: 'failed',
    error,
  }).catch(() => {
    // Ignore errors for non-blocking events
  })
}
