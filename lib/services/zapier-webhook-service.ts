/**
 * Zapier Webhook Service
 *
 * Integrates with Zapier workflows for letter generation using bidirectional webhooks.
 *
 * **SETUP GUIDE**: See docs/ZAPIER_SETUP.md for complete configuration instructions
 *
 * ## WEBHOOK ENDPOINTS:
 * 
 * ### 1. OUTBOUND: App → Zapier (Letter Generation Request)
 * - **URL**: Configured via `ZAPIER_WEBHOOK_URL` (required)
 * - **Method**: POST
 * - **Purpose**: Send form data to Zapier for ChatGPT processing
 * - **Payload**: ZapierLetterFormData (see interface below)
 * 
 * ### 2. INBOUND: Zapier → App (Generated Letter Response)
 * - **URL**: [YOUR_APP_URL]/api/letter-generated
 * - **Method**: POST
 * - **Purpose**: Receive generated letter content and update database
 * - **Payload**: 
 *   ```json
 *   {
 *     "letterId": "uuid-from-original-request",
 *     "generatedContent": "the generated letter text",
 *     "success": true,
 *     "metadata": { "optional": "tracking data" }
 *   }
 *   ```
 * 
 * ### 3. HEALTH CHECK: App Status Endpoint
 * - **URL**: [YOUR_APP_URL]/api/letter-generated
 * - **Method**: GET
 * - **Purpose**: Verify webhook endpoint is ready
 * - **Response**: Endpoint documentation and expected payload format
 * 
 * ## WORKFLOW:
 * 1. User submits letter form → Letter created with status 'generating'
 * 2. App sends form data to Zapier catch hook
 * 3. Zapier processes with ChatGPT using professional prompt
 * 4. Zapier posts generated letter back to /api/letter-generated
 * 5. Letter status updated to 'pending_review' for attorney approval
 * 6. Letter appears in review center for attorneys/admins
 */

/**
 * Form data structure expected by Zapier workflow
 * Matches the ChatGPT prompt template in Zapier
 */
export interface ZapierLetterFormData {
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

  // Letter content - mapped to match Zapier ChatGPT template
  issueDetails: string  // Maps from issueDescription
  desiredOutcome?: string
  additionalDetails?: string
  tone?: string  // Optional tone parameter

  // Optional fields
  amountDemanded?: number
  deadline?: string
  incidentDate?: string
  courtType?: string
}

/**
 * Response from Zapier webhook
 */
export interface ZapierGenerationResponse {
  success: boolean
  generatedContent?: string
  letterId?: string
  error?: string
  message?: string
}

interface ZapierConfig {
  webhookUrl: string | undefined
  isConfigured: boolean
  timeout: number
  maxRetries: number
}

/**
 * Zapier configuration
 * 
 * Environment Variables:
 * - ZAPIER_WEBHOOK_URL: Required. The Zapier catch hook URL for your account.
 * 
 * **SECURITY**: No fallback URL is provided. If ZAPIER_WEBHOOK_URL is not set,
 * the integration is treated as "not configured" and no user data is sent to Zapier.
 */
export const zapierConfig: ZapierConfig = {
  get webhookUrl() {
    return process.env.ZAPIER_WEBHOOK_URL || ''
  },
  get isConfigured() {
    return Boolean(process.env.ZAPIER_WEBHOOK_URL)
  },
  timeout: 30000, // 30 seconds - Zapier is typically faster than n8n
  maxRetries: 2,
}

/**
 * Send generated letter to Zapier webhook (fire-and-forget notification)
 *
 * This sends the completed letter to Zapier after generation.
 * Used for logging, analytics, or triggering downstream workflows.
 *
 * @param letterId - The letter ID
 * @param letterType - Type of letter generated
 * @param letterTitle - Title of the letter
 * @param userId - User who generated the letter
 * @param generatedContent - The actual generated letter content
 * @param intakeData - Original form data submitted
 */
export async function sendToZapierWebhook(
  letterId: string,
  letterType: string,
  letterTitle: string,
  userId: string,
  generatedContent: string,
  intakeData: Record<string, unknown>
): Promise<void> {
  if (!zapierConfig.isConfigured || !zapierConfig.webhookUrl) {
    console.log('[Zapier] Webhook not configured, skipping notification')
    return
  }

  const webhookUrl = zapierConfig.webhookUrl
  console.log('[Zapier] Sending letter notification for:', letterId)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout for notification

    // Prepare the payload with all relevant data
    const payload = {
      // Letter metadata
      letterId,
      letterType,
      letterTitle,
      userId,
      timestamp: new Date().toISOString(),

      // Form data (intake)
      senderName: intakeData.senderName,
      senderAddress: intakeData.senderAddress,
      senderState: intakeData.senderState,
      senderEmail: intakeData.senderEmail,
      senderPhone: intakeData.senderPhone,

      recipientName: intakeData.recipientName,
      recipientAddress: intakeData.recipientAddress,
      recipientState: intakeData.recipientState,
      recipientEmail: intakeData.recipientEmail,
      recipientPhone: intakeData.recipientPhone,

      issueDescription: intakeData.issueDescription,
      desiredOutcome: intakeData.desiredOutcome,
      additionalDetails: intakeData.additionalDetails,

      // The generated letter content
      generatedContent,

      // Source identifier
      source: 'talk-to-my-lawyer',
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'talk-to-my-lawyer',
        'X-Letter-Id': letterId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      console.log('[Zapier] Letter notification sent successfully for:', letterId)
    } else {
      console.warn('[Zapier] Webhook returned non-OK status:', response.status)
    }
  } catch (error) {
    // Don't throw - this is a non-critical notification
    console.warn('[Zapier] Webhook notification failed (non-critical):', error)
  }
}

/**
 * Check if Zapier integration is available
 */
export function isZapierConfigured(): boolean {
  return zapierConfig.isConfigured
}

/**
 * Send letter generation data to Zapier webhook
 *
 * Sends form data to Zapier, which can trigger custom workflows.
 * The Zapier workflow should return the generated letter content.
 *
 * @param formData - The letter form data
 * @returns Generated letter content or throws an error
 */
export async function generateLetterViaZapier(
  formData: ZapierLetterFormData
): Promise<string> {
  if (!zapierConfig.isConfigured || !zapierConfig.webhookUrl) {
    throw new Error('Zapier webhook is not configured. Set ZAPIER_WEBHOOK_URL environment variable.')
  }

  const webhookUrl = zapierConfig.webhookUrl
  console.log('[Zapier] Sending letter generation request for:', formData.letterId)

  for (let attempt = 1; attempt <= zapierConfig.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), zapierConfig.timeout)

      // Transform form data to match Zapier's ChatGPT template
      const zapierPayload = {
        // Required fields for ChatGPT prompt template
        letterType: formData.letterType,
        senderName: formData.senderName,
        senderAddress: formData.senderAddress,
        recipientName: formData.recipientName,
        recipientAddress: formData.recipientAddress,
        issueDetails: formData.issueDetails,  // Key field for ChatGPT prompt
        tone: formData.tone || 'professional',  // Default tone

        // Optional metadata (not used in ChatGPT prompt but useful for tracking)
        letterId: formData.letterId,
        userId: formData.userId,
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
        body: JSON.stringify(zapierPayload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 404) {
          throw new Error('Zapier workflow not found. Ensure the ZAP is active and listening.')
        }

        if (response.status >= 500) {
          console.warn(`[Zapier] Server error (${response.status}), attempt ${attempt}/${zapierConfig.maxRetries}`)
          if (attempt < zapierConfig.maxRetries) {
            const delay = Math.pow(2, attempt) * 1000
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }

        const errorText = await response.text()
        throw new Error(`Zapier request failed (${response.status}): ${errorText}`)
      }

      // Zapier webhooks typically return 200 OK on success
      // The response format depends on your ZAP setup
      // Try to parse as JSON, fall back to text if needed
      let result: ZapierGenerationResponse

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        result = await response.json()
      } else {
        // For simple Zapier webhooks that don't return JSON
        const text = await response.text()
        // If no content is returned but status is OK, consider it successful
        // The ZAP should handle the actual generation
        result = {
          success: true,
          message: 'Zapier webhook triggered successfully',
          generatedContent: text || undefined,
        }
      }

      if (!result.success) {
        throw new Error(result.error || result.message || 'Zapier generation failed')
      }

      // Note: If your Zapier workflow returns the generated content in the response,
      // it will be available in result.generatedContent
      // If your ZAP works asynchronously, you may need to implement a callback mechanism
      if (!result.generatedContent) {
        // If your Zapier workflow doesn't return content directly, you can:
        // 1. Set up a Zapier action that returns the content
        // 2. Use a webhook callback from Zapier to your app
        // 3. Store the result and poll for completion

        // For now, we'll assume the ZAP returns the content or throw an error
        throw new Error('Zapier returned success but no generated content. Ensure your ZAP returns the generated letter in the response.')
      }

      console.log('[Zapier] Letter generated successfully for:', formData.letterId)
      return result.generatedContent

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`[Zapier] Request timeout, attempt ${attempt}/${zapierConfig.maxRetries}`)
        if (attempt < zapierConfig.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error('Zapier request timed out after multiple attempts')
      }

      // Don't retry for non-timeout errors
      throw error
    }
  }

  throw new Error('Zapier generation failed after all retries')
}

/**
 * Transform app intake data to Zapier form data format
 */
export function transformIntakeToZapierFormat(
  letterId: string,
  userId: string,
  letterType: string,
  intakeData: Record<string, unknown>
): ZapierLetterFormData {
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

    // Content - mapped to match Zapier ChatGPT template
    // Combine issueDescription and desiredOutcome into a comprehensive issueDetails field
    issueDetails: `${String(intakeData.issueDescription || '')}\n\nDesired Outcome: ${String(intakeData.desiredOutcome || '')}${intakeData.additionalDetails ? `\n\nAdditional Details: ${String(intakeData.additionalDetails)}` : ''}`,
    tone: intakeData.tone ? String(intakeData.tone) : 'professional',  // Default tone

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

export type ZapierLetterEvent =
  | 'letter.generation.started'
  | 'letter.generation.completed'
  | 'letter.generation.failed'
  | 'letter.submitted'
  | 'letter.approved'
  | 'letter.rejected'

export interface ZapierEventPayload {
  event: ZapierLetterEvent
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
 * Send an event notification to Zapier (fire-and-forget)
 * This is separate from generation - used for monitoring/alerting
 */
export async function sendZapierEvent(payload: ZapierEventPayload): Promise<boolean> {
  // Use a separate events webhook URL if configured, otherwise skip
  const eventsWebhookUrl = process.env.ZAPIER_EVENTS_WEBHOOK_URL

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
      console.log('[Zapier] Event sent:', payload.event)
      return true
    }

    console.warn('[Zapier] Event send failed:', response.status)
    return false
  } catch (error) {
    console.warn('[Zapier] Event send error:', error)
    return false
  }
}

/**
 * Notify Zapier that letter generation completed (for monitoring)
 */
export function notifyZapierLetterCompleted(
  letterId: string,
  letterType: string,
  letterTitle: string,
  userId: string,
  isFreeTrial: boolean
): void {
  sendZapierEvent({
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
 * Notify Zapier that letter generation failed (for alerting)
 */
export function notifyZapierLetterFailed(
  letterId: string,
  letterType: string,
  userId: string,
  error: string
): void {
  sendZapierEvent({
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
