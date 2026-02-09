/**
 * n8n Webhook Service
 *
 * Handles n8n-only workflows for letter generation and PDF generation.
 * Letter generation: jurisdiction research (GPT-4o + Perplexity/SerpAPI),
 * letter generation with state-specific legal context,
 * and direct Supabase update (letter_content, status, statutes_cited, etc.).
 * PDF generation: converts approved letters to formatted PDFs via n8n workflow.
 *
 * IMPORTANT: The n8n workflow expects a nested payload format:
 * { letterType: "Demand Letter", letterId: "uuid", intakeData: { senderName, ... } }
 * n8n uses responseMode: "lastNode" so the response is the Supabase update result.
 * n8n saves directly to Supabase (letter_content, subject, statutes_cited, etc.)
 */

const LETTER_TYPE_MAP: Record<string, string> = {
  'demand_letter': 'Demand Letter',
  'cease_desist': 'Cease & Desist',
  'contract_breach': 'Contract Breach',
  'eviction_notice': 'Eviction Notice',
  'employment_dispute': 'Employment Dispute',
  'consumer_complaint': 'Consumer Complaint',
}

export function mapLetterTypeForN8n(snakeCaseType: string): string {
  return LETTER_TYPE_MAP[snakeCaseType] || snakeCaseType
}

export interface N8nLetterFormData {
  letterType: string
  letterId: string
  userId: string
  intakeData: Record<string, unknown>
}

export interface N8nGenerationResult {
  letterId: string
  status: string
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
        intakeData: formData.intakeData,
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

      console.log('[n8n] Sending payload with letterType:', formData.letterType, 'intakeData keys:', Object.keys(formData.intakeData))

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

      const responseData = await response.json()

      console.log('[n8n] Letter generation completed for:', formData.letterId, {
        responseKeys: Object.keys(responseData),
      })

      return {
        letterId: formData.letterId,
        status: 'pending_review',
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
    letterType: mapLetterTypeForN8n(letterType),
    intakeData,
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


export const n8nPdfConfig = {
  get webhookUrl() { return process.env.N8N_PDF_WEBHOOK_URL },
  get authKey() { return process.env.N8N_PDF_WEBHOOK_AUTH_KEY },
  get isConfigured() { return Boolean(process.env.N8N_PDF_WEBHOOK_URL) },
  timeout: 120000,
  maxRetries: 2,
}

export function isN8nPdfConfigured(): boolean {
  return n8nPdfConfig.isConfigured
}

export interface N8nPdfParams {
  letterId: string
  userId: string
}

export async function generatePdfViaN8n(
  params: N8nPdfParams
): Promise<{ success: boolean; storagePath?: string; letterId?: string }> {
  if (!n8nPdfConfig.isConfigured || !n8nPdfConfig.webhookUrl) {
    throw new Error('n8n PDF webhook is not configured. Set N8N_PDF_WEBHOOK_URL environment variable.')
  }

  const webhookUrl = n8nPdfConfig.webhookUrl
  console.log('[n8n-pdf] Sending PDF generation request for:', params.letterId)

  for (let attempt = 1; attempt <= n8nPdfConfig.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), n8nPdfConfig.timeout)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'talk-to-my-lawyer',
        'X-Letter-Id': params.letterId,
      }

      if (n8nPdfConfig.authKey) {
        headers['Authorization'] = `Bearer ${n8nPdfConfig.authKey}`
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          letterId: params.letterId,
          userId: params.userId,
          source: 'talk-to-my-lawyer',
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('n8n PDF workflow not found. Ensure the workflow is active and listening.')
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error('n8n PDF webhook authentication failed. Check N8N_PDF_WEBHOOK_AUTH_KEY.')
        }

        if (response.status >= 500) {
          console.warn(`[n8n-pdf] Server error (${response.status}), attempt ${attempt}/${n8nPdfConfig.maxRetries}`)
          if (attempt < n8nPdfConfig.maxRetries) {
            const delay = Math.pow(2, attempt) * 1000
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }

        const errorText = await response.text()
        throw new Error(`n8n PDF request failed (${response.status}): ${errorText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || result.message || 'n8n PDF generation failed')
      }

      console.log('[n8n-pdf] PDF generated successfully for:', params.letterId, {
        storagePath: result.storagePath,
        pdfGeneratedAt: result.pdfGeneratedAt,
      })

      return {
        success: true,
        storagePath: result.storagePath,
        letterId: result.letterId,
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`[n8n-pdf] Request timeout, attempt ${attempt}/${n8nPdfConfig.maxRetries}`)
        if (attempt < n8nPdfConfig.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error('n8n PDF request timed out after multiple attempts')
      }

      throw error
    }
  }

  throw new Error('n8n PDF generation failed after all retries')
}
