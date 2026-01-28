/**
 * n8n Webhook Service
 *
 * Handles sending webhook events to n8n workflows for letter generation
 * monitoring, alerts, and automation.
 */

export type N8nLetterEvent =
  | 'letter.generation.started'
  | 'letter.generation.completed'
  | 'letter.generation.failed'
  | 'letter.submitted'
  | 'letter.approved'
  | 'letter.rejected'

export interface N8nLetterPayload {
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

interface N8nConfig {
  webhookUrl: string | undefined
  isConfigured: boolean
  timeout: number
  maxRetries: number
}

/**
 * n8n configuration
 * Supports both test and production webhook URLs
 */
export const n8nConfig: N8nConfig = {
  get webhookUrl() {
    return process.env.N8N_WEBHOOK_URL
  },
  get isConfigured() {
    return Boolean(process.env.N8N_WEBHOOK_URL)
  },
  timeout: 10000, // 10 seconds
  maxRetries: 3,
}

/**
 * Send a webhook event to n8n
 *
 * This is a fire-and-forget function that logs errors but doesn't throw.
 * It includes retry logic with exponential backoff for resilience.
 *
 * @param payload - The event payload to send
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function sendN8nWebhook(payload: N8nLetterPayload): Promise<boolean> {
  if (!n8nConfig.isConfigured || !n8nConfig.webhookUrl) {
    console.log('[n8n] Webhook not configured, skipping event:', payload.event)
    return false
  }

  const webhookUrl = n8nConfig.webhookUrl

  for (let attempt = 1; attempt <= n8nConfig.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), n8nConfig.timeout)

      const response = await fetch(webhookUrl, {
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
        console.log('[n8n] Webhook sent successfully:', payload.event, 'letterId:', payload.letterId)
        return true
      }

      // Handle specific error codes
      if (response.status === 404) {
        console.warn('[n8n] Webhook endpoint not found (404). If using test mode, ensure the workflow is executing in n8n.')
        return false
      }

      if (response.status >= 500) {
        console.warn(`[n8n] Server error (${response.status}), attempt ${attempt}/${n8nConfig.maxRetries}`)
        // Continue to retry for server errors
      } else {
        // Don't retry for client errors (4xx except 404)
        console.error(`[n8n] Webhook failed with status ${response.status}:`, await response.text())
        return false
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`[n8n] Webhook timeout, attempt ${attempt}/${n8nConfig.maxRetries}`)
      } else {
        console.error(`[n8n] Webhook error, attempt ${attempt}/${n8nConfig.maxRetries}:`, error)
      }
    }

    // Exponential backoff before retry (2s, 4s, 8s)
    if (attempt < n8nConfig.maxRetries) {
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  console.error('[n8n] Webhook failed after all retries:', payload.event, 'letterId:', payload.letterId)
  return false
}

/**
 * Notify n8n that letter generation has started
 */
export async function notifyN8nLetterStarted(
  letterId: string,
  letterType: string,
  userId: string
): Promise<void> {
  sendN8nWebhook({
    event: 'letter.generation.started',
    timestamp: new Date().toISOString(),
    letterId,
    letterType,
    userId,
    status: 'generating',
  }).catch(err => {
    console.error('[n8n] Failed to send letter.generation.started event:', err)
  })
}

/**
 * Notify n8n that letter generation completed successfully
 */
export async function notifyN8nLetterCompleted(
  letterId: string,
  letterType: string,
  letterTitle: string,
  userId: string,
  isFreeTrial: boolean
): Promise<void> {
  sendN8nWebhook({
    event: 'letter.generation.completed',
    timestamp: new Date().toISOString(),
    letterId,
    letterType,
    letterTitle,
    userId,
    isFreeTrial,
    status: 'pending_review',
  }).catch(err => {
    console.error('[n8n] Failed to send letter.generation.completed event:', err)
  })
}

/**
 * Notify n8n that letter generation failed
 */
export async function notifyN8nLetterFailed(
  letterId: string,
  letterType: string,
  userId: string,
  error: string
): Promise<void> {
  sendN8nWebhook({
    event: 'letter.generation.failed',
    timestamp: new Date().toISOString(),
    letterId,
    letterType,
    userId,
    status: 'failed',
    error,
  }).catch(err => {
    console.error('[n8n] Failed to send letter.generation.failed event:', err)
  })
}

/**
 * Notify n8n that a letter was submitted for review
 */
export async function notifyN8nLetterSubmitted(
  letterId: string,
  letterTitle: string,
  userId: string
): Promise<void> {
  sendN8nWebhook({
    event: 'letter.submitted',
    timestamp: new Date().toISOString(),
    letterId,
    letterTitle,
    userId,
    status: 'pending_review',
  }).catch(err => {
    console.error('[n8n] Failed to send letter.submitted event:', err)
  })
}

/**
 * Notify n8n that a letter was approved
 */
export async function notifyN8nLetterApproved(
  letterId: string,
  letterTitle: string,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  sendN8nWebhook({
    event: 'letter.approved',
    timestamp: new Date().toISOString(),
    letterId,
    letterTitle,
    userId,
    status: 'approved',
    metadata,
  }).catch(err => {
    console.error('[n8n] Failed to send letter.approved event:', err)
  })
}

/**
 * Notify n8n that a letter was rejected
 */
export async function notifyN8nLetterRejected(
  letterId: string,
  letterTitle: string,
  userId: string,
  reason: string
): Promise<void> {
  sendN8nWebhook({
    event: 'letter.rejected',
    timestamp: new Date().toISOString(),
    letterId,
    letterTitle,
    userId,
    status: 'rejected',
    metadata: { rejectionReason: reason },
  }).catch(err => {
    console.error('[n8n] Failed to send letter.rejected event:', err)
  })
}
