/**
 * Letter Generation Completion Webhook
 * POST /api/letter-generated
 *
 * Receives generated letter content from Zapier and updates the database.
 * Sets letter status to 'pending_review' for admin/attorney review.
 */
import { type NextRequest } from "next/server"
import { db } from '@/lib/db/client-factory'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { createBusinessSpan, addSpanAttributes } from '@/lib/monitoring/tracing'

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
        // Parse request body
        const body = await request.json() as ZapierLetterCompletionPayload

        const { letterId, generatedContent, success = true, error, metadata } = body

        addSpanAttributes(span, {
            'letter.id': letterId,
            'letter.success': success,
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

        return successResponse('Letter generation completed and queued for review', {
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
 * Health check endpoint
 */
export async function GET() {
    return successResponse('Letter generation webhook endpoint is ready', {
        endpoint: '/api/letter-generated',
        method: 'POST',
        expectedPayload: {
            letterId: 'string (required)',
            generatedContent: 'string (required)',
            success: 'boolean (optional, defaults to true)',
            error: 'string (optional)',
            metadata: 'object (optional)'
        }
    })
}