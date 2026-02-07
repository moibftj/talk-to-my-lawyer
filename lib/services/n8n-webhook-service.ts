/**
 * n8n Webhook Service
 *
 * Primary letter generation integration via n8n workflow.
 * n8n handles: jurisdiction research (GPT-4o + Google Search),
 * letter generation with state-specific legal context,
 * and direct Supabase update (ai_draft_content, status, research_data).
 *
 * The app falls back to direct OpenAI generation if n8n is unavailable.
 */

export interface N8nLetterFormData {
  letterType: string
  letterId: string
  userId: string

  senderName: string
  senderAddress: string
  senderState: string
  senderEmail?: string
  senderPhone?: string

  recipientName: string
  recipientAddress: string
  recipientState: string
  recipientEmail?: string
  recipientPhone?: string

  issueDescription: string
  desiredOutcome: string
  additionalDetails?: string

  amountDemanded?: number
  deadline?: string
  incidentDate?: string
  courtType?: string
}

export interface N8nGenerationResponse {
  success: boolean
  generatedContent?: string
  letterId?: string
  status?: string
  researchApplied?: boolean
  state?: string
  error?: string
  message?: string
}

export interface N8nGenerationResult {
  generatedContent: string
  letterId: string
  status: string
  researchApplied: boolean
  state?: string
  supabaseUpdated: boolean
}

interface N8nConfig {
  webhookUrl: string | undefined
  authKey: string | undefined
  isConfigured: boolean
  timeout: number
  maxRetries: number
}

export const n8nConfig: N8nConfig = {
  get webhookUrl() {
    return process.env.N8N_WEBHOOK_URL
  },
  get authKey() {
    return process.env.N8N_WEBHOOK_AUTH_KEY
  },
  get isConfigured() {
    return Boolean(process.env.N8N_WEBHOOK_URL)
  },
  timeout: 90000,
  maxRetries: 2,
}

export function isN8nConfigured(): boolean {
  return n8nConfig.isConfigured
}

export async function generateLetterViaN8n(
  formData: N8nLetterFormData
): Promise<N8nGenerationResult> {
  if (!n8nConfig.isConfigured || !n8nConfig.webhookUrl) {
    throw new Error('n8n webhook is not configured. Set N8N_WEBHOOK_URL environment variable.')
  }

  const webhookUrl = n8nConfig.webhookUrl
  console.log('[n8n] Sending letter generation request for:', formData.letterId)

  for (let attempt = 1; attempt <= n8nConfig.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), n8nConfig.timeout)

      const n8nPayload = {
        letterType: formData.letterType,
        letterId: formData.letterId,
        userId: formData.userId,

        senderName: formData.senderName,
        senderAddress: formData.senderAddress,
        senderState: formData.senderState,
        senderEmail: formData.senderEmail,
        senderPhone: formData.senderPhone,

        recipientName: formData.recipientName,
        recipientAddress: formData.recipientAddress,
        recipientState: formData.recipientState,
        recipientEmail: formData.recipientEmail,
        recipientPhone: formData.recipientPhone,

        issueDescription: formData.issueDescription,
        desiredOutcome: formData.desiredOutcome,
        additionalDetails: formData.additionalDetails,

        amountDemanded: formData.amountDemanded,
        deadline: formData.deadline,
        incidentDate: formData.incidentDate,
        courtType: formData.courtType,

        timestamp: new Date().toISOString(),
        source: 'talk-to-my-lawyer',
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'talk-to-my-lawyer',
        'X-Letter-Id': formData.letterId,
      }

      if (n8nConfig.authKey) {
        headers['Authorization'] = `Bearer ${n8nConfig.authKey}`
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(n8nPayload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('n8n workflow not found. Ensure the workflow is active and listening.')
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error('n8n webhook authentication failed. Check N8N_WEBHOOK_AUTH_KEY.')
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

      console.log('[n8n] Letter generated successfully for:', formData.letterId, {
        researchApplied: result.researchApplied,
        state: result.state,
        contentLength: result.generatedContent.length,
      })

      return {
        generatedContent: result.generatedContent,
        letterId: result.letterId || formData.letterId,
        status: result.status || 'pending_review',
        researchApplied: result.researchApplied ?? false,
        state: result.state,
        supabaseUpdated: true,
      }

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

      throw error
    }
  }

  throw new Error('n8n generation failed after all retries')
}

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

    senderName: String(intakeData.senderName || ''),
    senderAddress: String(intakeData.senderAddress || ''),
    senderState: String(intakeData.senderState || ''),
    senderEmail: intakeData.senderEmail ? String(intakeData.senderEmail) : undefined,
    senderPhone: intakeData.senderPhone ? String(intakeData.senderPhone) : undefined,

    recipientName: String(intakeData.recipientName || ''),
    recipientAddress: String(intakeData.recipientAddress || ''),
    recipientState: String(intakeData.recipientState || ''),
    recipientEmail: intakeData.recipientEmail ? String(intakeData.recipientEmail) : undefined,
    recipientPhone: intakeData.recipientPhone ? String(intakeData.recipientPhone) : undefined,

    issueDescription: String(intakeData.issueDescription || ''),
    desiredOutcome: String(intakeData.desiredOutcome || ''),
    additionalDetails: intakeData.additionalDetails ? String(intakeData.additionalDetails) : undefined,

    amountDemanded: typeof intakeData.amountDemanded === 'number' ? intakeData.amountDemanded : undefined,
    deadline: intakeData.deadlineDate ? String(intakeData.deadlineDate) : undefined,
    incidentDate: intakeData.incidentDate ? String(intakeData.incidentDate) : undefined,
    courtType: intakeData.courtType ? String(intakeData.courtType) : undefined,
  }
}


// ============================================================================
// Event Notification Functions (for monitoring/alerting workflows)
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

export async function sendN8nEvent(payload: N8nEventPayload): Promise<boolean> {
  const eventsWebhookUrl = process.env.N8N_EVENTS_WEBHOOK_URL

  if (!eventsWebhookUrl) {
    return false
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Source': 'talk-to-my-lawyer',
      'X-Webhook-Event': payload.event,
    }

    if (n8nConfig.authKey) {
      headers['Authorization'] = `Bearer ${n8nConfig.authKey}`
    }

    const response = await fetch(eventsWebhookUrl, {
      method: 'POST',
      headers,
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
  }).catch(() => {})
}

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
  }).catch(() => {})
}
