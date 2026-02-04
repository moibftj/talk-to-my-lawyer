/**
 * Letter generation endpoint
 * POST /api/generate-letter
 *
 * Handles intelligent letter generation with:
 * - User authentication and authorization
 * - Allowance checking (free trial, paid, super user)
 * - AI generation via OpenAI (primary) with Zapier notification (optional)
 * - Audit trail logging
 * - Admin notifications
 * 
 * ARCHITECTURE: OpenAI is now the PRIMARY generation method for reliability.
 * Zapier integration is kept as OPTIONAL for workflow notifications.
 */
import { type NextRequest } from "next/server"
import { letterGenerationRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { validateLetterGenerationRequest } from '@/lib/validation/letter-schema'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { requireSubscriber } from '@/lib/auth/authenticate-user'
import { openaiConfig, getRateLimitTuple } from '@/lib/config'
import {
  checkAndDeductAllowance,
  refundLetterAllowance,
} from '@/lib/services/allowance-service'
import { logLetterStatusChange } from '@/lib/services/audit-service'
import { generateLetterContent } from '@/lib/services/letter-generation-service'
import { notifyAdminsNewLetter } from '@/lib/services/notification-service'
import {
  isZapierConfigured,
  sendToZapierWebhook,
  notifyZapierLetterCompleted,
} from '@/lib/services/zapier-webhook-service'
import type { LetterGenerationResponse } from '@/lib/types/letter.types'
import { createBusinessSpan, addSpanAttributes, recordSpanEvent } from '@/lib/monitoring/tracing'

export const runtime = "nodejs"

/**
 * Generate a letter using AI
 *
 * Uses OpenAI directly for letter generation (reliable, synchronous).
 * Optionally notifies Zapier workflow for monitoring/logging.
 */
export async function POST(request: NextRequest) {
  const span = createBusinessSpan('generate_letter', {
    'http.method': 'POST',
    'http.route': '/api/generate-letter',
  })

  const zapierAvailable = isZapierConfigured()

  try {
    recordSpanEvent('letter_generation_started')
    addSpanAttributes({ 
      'generation.method': 'openai_primary', 
      'openai_available': openaiConfig.isConfigured, 
      'zapier_available': zapierAvailable 
    })

    // 1. Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, letterGenerationRateLimit, ...getRateLimitTuple('LETTER_GENERATE'))
    if (rateLimitResponse) {
      recordSpanEvent('rate_limit_exceeded')
      span.setStatus({
        code: 2,
        message: 'Rate limit exceeded'
      })
      return rateLimitResponse
    }

    // 2. Authenticate and authorize user
    const { user, supabase } = await requireSubscriber()

    addSpanAttributes({
      'user.id': user.id,
      'user.email': user.email || 'unknown',
    })
    recordSpanEvent('authentication_successful')

    // 3. Parse and validate request body (before allowance deduction)
    const body = await request.json()
    const { letterType, intakeData } = body

    const validation = validateLetterGenerationRequest(letterType, intakeData)
    if (!validation.valid) {
      console.error("[GenerateLetter] Validation failed:", validation.errors)
      return errorResponses.validation("Invalid input data", validation.errors)
    }

    const sanitizedLetterType = letterType
    const sanitizedIntakeData = validation.data!

    // 4. Check API configuration - OpenAI is required
    if (!openaiConfig.apiKey || !openaiConfig.isConfigured) {
      console.error("[GenerateLetter] OpenAI API key not configured. Set OPENAI_API_KEY environment variable.")
      return errorResponses.serverError("Letter generation is temporarily unavailable. Please contact support.")
    }

    // 5. Atomically check eligibility AND deduct allowance
    const deductionResult = await checkAndDeductAllowance(user.id)

    if (!deductionResult.success) {
      return errorResponses.validation(
        deductionResult.errorMessage || "No letter credits remaining",
        { needsSubscription: true }
      )
    }

    const isFreeTrial = deductionResult.isFreeTrial
    const isSuperAdmin = deductionResult.isSuperAdmin

    // 6. Create letter record with 'generating' status
    const { data: newLetter, error: insertError } = await supabase
      .from("letters")
      .insert({
        user_id: user.id,
        letter_type: sanitizedLetterType,
        title: `${sanitizedLetterType} - ${new Date().toLocaleDateString()}`,
        intake_data: sanitizedIntakeData,
        status: "generating",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("[GenerateLetter] Database insert error:", insertError)

      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(user.id, 1)
      }

      return errorResponses.serverError("Failed to create letter record")
    }

    // 7. Generate letter content using OpenAI directly
    console.log("[GenerateLetter] Starting OpenAI generation for letter:", newLetter.id)
    recordSpanEvent('openai_generation_started')

    let generatedContent: string

    try {
      generatedContent = await generateLetterContent(
        sanitizedLetterType,
        sanitizedIntakeData
      )

      if (!generatedContent || generatedContent.trim().length === 0) {
        throw new Error("OpenAI returned empty content")
      }

      console.log("[GenerateLetter] OpenAI generation successful, content length:", generatedContent.length)
      recordSpanEvent('openai_generation_succeeded', {
        content_length: generatedContent.length
      })

    } catch (openaiError) {
      console.error("[GenerateLetter] OpenAI generation failed:", openaiError)
      recordSpanEvent('openai_generation_failed', {
        error: openaiError instanceof Error ? openaiError.message : 'Unknown error'
      })

      // Mark letter as failed and refund
      await supabase
        .from("letters")
        .update({
          status: "failed",
          generation_error: openaiError instanceof Error ? openaiError.message : 'Generation failed',
          updated_at: new Date().toISOString(),
        })
        .eq("id", newLetter.id)

      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(user.id, 1)
      }

      throw openaiError
    }

    // 8. Update letter with generated content and set to pending_review
    const { error: updateError } = await supabase
      .from("letters")
      .update({
        ai_draft_content: generatedContent,
        status: "pending_review",
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", newLetter.id)

    if (updateError) {
      console.error("[GenerateLetter] Failed to update letter with generated content:", updateError)
      
      // Still mark as failed and refund
      await supabase
        .from("letters")
        .update({
          status: "failed",
          generation_error: 'Failed to save generated content',
          updated_at: new Date().toISOString(),
        })
        .eq("id", newLetter.id)

      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(user.id, 1)
      }

      return errorResponses.serverError("Failed to save generated letter")
    }

    // 9. Log audit trail
    await logLetterStatusChange(
      supabase,
      newLetter.id,
      'generating',
      'pending_review',
      'created',
      `Letter generated successfully via OpenAI`
    )

    // 10. Notify admins about new letter for review (non-blocking)
    notifyAdminsNewLetter(newLetter.id, newLetter.title, sanitizedLetterType).catch(err => {
      console.error('[GenerateLetter] Admin notification failed:', err)
    })

    // 11. Optionally send to Zapier for workflow notifications (fire-and-forget)
    if (zapierAvailable) {
      sendToZapierWebhook(
        newLetter.id,
        sanitizedLetterType,
        newLetter.title,
        user.id,
        generatedContent,
        sanitizedIntakeData as Record<string, unknown>
      ).catch(err => {
        console.warn('[GenerateLetter] Zapier notification failed (non-critical):', err)
      })

      // Also notify Zapier events webhook
      notifyZapierLetterCompleted(
        newLetter.id,
        sanitizedLetterType,
        newLetter.title,
        user.id,
        isFreeTrial
      )
    }

    // 12. Return success response with generated draft
    return successResponse<LetterGenerationResponse>({
      success: true,
      letterId: newLetter.id,
      status: 'pending_review',
      isFreeTrial: isFreeTrial,
      aiDraft: generatedContent,
    })

  } catch (error: unknown) {
    span.recordException(error as Error)
    span.setStatus({
      code: 2,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    recordSpanEvent('letter_generation_failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return handleApiError(error, 'GenerateLetter')
  } finally {
    span.end()
  }
}
