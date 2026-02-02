/**
 * Letter Generation Completion Webhook & Documentation
 *
 * POST /api/letter-generated - Receives generated letter content from Zapier
 * GET /api/letter-generated  - Health check and endpoint documentation
 *
 * SECURITY:
 * - Webhook is protected by HMAC signature verification
 * - Requires ZAPIER_WEBHOOK_SECRET environment variable in production
 * - Zapier should send signature in X-Zapier-Signature header
 *
 * ZAPIER INTEGRATION:
 * - Outbound: App sends form data to https://hooks.zapier.com/hooks/catch/14299645/ulilhsl/
 * - Inbound: Zapier posts generated content back to this endpoint
 *
 * WORKFLOW:
 * 1. Letter created with status 'generating'
 * 2. Form data sent to Zapier catch hook
 * 3. Zapier processes with ChatGPT
 * 4. Zapier posts result back here with HMAC signature
 * 5. Signature verified, then letter status updated to 'pending_review'
 * 6. Letter enters attorney review queue
 */
import { type NextRequest } from "next/server"
import { db } from '@/lib/db/client-factory'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { createBusinessSpan, addSpanAttributes } from '@/lib/monitoring/tracing'
import { verifyZapierWebhookSignature } from '@/lib/security/webhook-signature'

interface ZapierLetterCompletionPayload {
    letterId: string
    generatedContent: string
    success?: boolean
    error?: string
    metadata?: {
        letterType?: string
        generatedAt?: string
        model?: string
        tokensUsed?: number
    }
}

/**
 * Handle incoming Zapier webhook with generated letter content
 */
export async function POST(request: NextRequest) {
    const span = createBusinessSpan('letter_generated_webhook', {
        'http.method': 'POST',
        'http.route': '/api/letter-generated',
        'webhook.source': 'zapier'
    })

    try {
        // Verify webhook signature
        const signatureResult = await verifyZapierWebhookSignature(request)

        if (signatureResult && !signatureResult.valid) {
            console.error('[LetterGenerated] Invalid webhook signature:', signatureResult.error)
            addSpanAttributes({
                'webhook.signature_valid': false,
                'webhook.signature_error': signatureResult.error || 'Unknown error'
            })
            return errorResponses.unauthorized('Invalid webhook signature')
        }

        // Log signature verification (null = dev mode without secret)
        if (signatureResult === null) {
            console.warn('[LetterGenerated] Proceeding without signature verification (development mode)')
            addSpanAttributes({ 'webhook.signature_verified': false })
        } else {
            addSpanAttributes({ 'webhook.signature_verified': true })
        }

        // Parse request body
        const body = await request.json() as ZapierLetterCompletionPayload

        const { letterId, generatedContent, success = true, error, metadata } = body

        addSpanAttributes({
            'letter.content_length': generatedContent?.length || 0
        })

        // Validate required fields
        if (!letterId) {
            return errorResponses.validation('Missing letterId', [
                { field: 'letterId', message: 'Letter ID is required' }
            ])
        }

        if (!success || !generatedContent) {
            return await handleGenerationFailure(letterId, error || 'Generation failed')
        }

        if (!generatedContent?.trim()) {
            return errorResponses.validation('Generated content cannot be empty', [
                { field: 'generatedContent', message: 'Generated letter content is required' }
            ])
        }

        console.log(`[LetterGenerated] Processing webhook for letter ${letterId}, content length: ${generatedContent.length}`)

        // Use service role client for database operations
        const serviceClient = db.serviceRole()

        // First, verify the letter exists and is in generating status
        const { data: existingLetter, error: fetchError } = await (serviceClient as any)
            .from('letters')
            .select('id, status, user_id, letter_type')
            .eq('id', letterId)
            .single()

        if (fetchError || !existingLetter) {
            console.error(`[LetterGenerated] Letter ${letterId} not found:`, fetchError)
            return errorResponses.notFound(`Letter ${letterId} not found`)
        }

        if (existingLetter.status !== 'generating') {
            console.warn(`[LetterGenerated] Letter ${letterId} is in status '${existingLetter.status}', expected 'generating'`)
            return errorResponses.validation(`Letter is not in generating status (current: ${existingLetter.status})`)
        }

        // Update letter with generated content and set to pending review
        const updateData = {
            ai_draft: generatedContent,
            status: 'pending_review',
            updated_at: new Date().toISOString(),
            generated_at: new Date().toISOString(),
            generation_metadata: metadata ? JSON.stringify(metadata) : null
        }

        const { data: updatedLetter, error: updateError } = await (serviceClient as any)
            .from('letters')
            .update(updateData)
            .eq('id', letterId)
            .select()
            .single()

        if (updateError) {
            console.error(`[LetterGenerated] Failed to update letter ${letterId}:`, updateError)
            return errorResponses.serverError(`Failed to update letter: ${updateError.message}`)
        }

        console.log(`[LetterGenerated] Successfully updated letter ${letterId} to pending_review status`)

        // Log audit trail
        try {
            await (serviceClient as any).rpc('log_letter_audit', {
                p_letter_id: letterId,
                p_action: 'generated',
                p_admin_id: 'system', // System-generated action
                p_old_status: 'generating',
                p_new_status: 'pending_review',
                p_details: JSON.stringify({
                    source: 'zapier_webhook',
                    content_length: generatedContent.length,
                    metadata: metadata
                })
            })
        } catch (auditError) {
            // Don't fail the request if audit logging fails
            console.error(`[LetterGenerated] Failed to log audit for letter ${letterId}:`, auditError)
        }

        return successResponse({
            message: 'Letter generation completed and queued for review',
            letterId,
            status: 'pending_review',
            contentLength: generatedContent.length,
            updatedAt: updatedLetter.updated_at
        })

    } catch (error) {
        console.error('[LetterGenerated] Webhook processing failed:', error)
        return handleApiError(error, 'letter generation completion')
    }
}

/**
 * Handle generation failure by updating letter status
 */
async function handleGenerationFailure(letterId: string, errorMessage: string) {
    try {
        const serviceClient = db.serviceRole()

        await (serviceClient as any)
            .from('letters')
            .update({
                status: 'failed',
                updated_at: new Date().toISOString(),
                generation_error: errorMessage
            })
            .eq('id', letterId)

        // Log audit trail for failure
        await (serviceClient as any).rpc('log_letter_audit', {
            p_letter_id: letterId,
            p_action: 'generation_failed',
            p_admin_id: 'system',
            p_old_status: 'generating',
            p_new_status: 'failed',
            p_details: JSON.stringify({
                source: 'zapier_webhook',
                error: errorMessage
            })
        })

        console.log(`[LetterGenerated] Marked letter ${letterId} as failed: ${errorMessage}`)

        return errorResponses.serverError(`Letter generation failed: ${errorMessage}`)

    } catch (updateError) {
        console.error(`[LetterGenerated] Failed to update failed letter ${letterId}:`, updateError)
        return errorResponses.serverError('Generation failed and could not update status')
    }
}

/**
 * Health check and documentation endpoint
 * GET /api/letter-generated
 */
export async function GET() {
    return successResponse({
        message: 'Letter generation webhook endpoint is ready',
        endpoints: {
            incoming: {
                url: '/api/letter-generated',
                method: 'POST',
                purpose: 'Receive generated letter content from Zapier',
                security: {
                    type: 'HMAC Signature',
                    header: 'X-Zapier-Signature',
                    secretEnvVar: 'ZAPIER_WEBHOOK_SECRET',
                    required: 'production',
                    notes: 'Zapier must send HMAC signature of payload using shared secret'
                },
                expectedPayload: {
                    letterId: 'string (required) - UUID from original request',
                    generatedContent: 'string (required) - The generated letter text',
                    success: 'boolean (optional, defaults to true)',
                    error: 'string (optional) - Error message if generation failed',
                    metadata: 'object (optional) - Tracking data from ChatGPT/Zapier'
                }
            },
            outbound: {
                url: 'https://hooks.zapier.com/hooks/catch/14299645/ulilhsl/',
                method: 'POST',
                purpose: 'Send letter form data to Zapier for ChatGPT processing',
                payload: 'ZapierLetterFormData (see service documentation)'
            },
            health: {
                url: '/api/letter-generated',
                method: 'GET',
                purpose: 'Check webhook endpoint status and get documentation'
            }
        },
        workflow: [
            '1. User submits letter form → Letter created with status "generating"',
            '2. App sends form data to Zapier catch hook',
            '3. Zapier processes with ChatGPT using professional prompt',
            '4. Zapier posts generated letter back to /api/letter-generated with HMAC signature',
            '5. Signature verified, then letter status updated to "pending_review" for attorney approval',
            '6. Letter appears in review center for attorneys/admins'
        ],
        securityNote: 'This endpoint requires ZAPIER_WEBHOOK_SECRET to be set in production. In development, unsigned requests are allowed with a warning.'
    })
}