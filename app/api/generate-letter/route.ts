/**
 * Letter generation endpoint
 * POST /api/generate-letter
 *
 * Handles intelligent letter generation with:
 * - User authentication and authorization
 * - Allowance checking (free trial, paid, super user)
 * - AI generation via Zapier (primary) or OpenAI (fallback)
 * - Audit trail logging
 * - Admin notifications
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
  generateLetterViaZapier,
  transformIntakeToZapierFormat,
  notifyZapierLetterCompleted,
  notifyZapierLetterFailed,
} from '@/lib/services/zapier-webhook-service'
import type { LetterGenerationResponse } from '@/lib/types/letter.types'
import { createBusinessSpan, addSpanAttributes, recordSpanEvent } from '@/lib/monitoring/tracing'

export const runtime = "nodejs"

/**
 * Generate a letter using AI
 *
 * Uses Zapier webhook for generation (primary), falls back to OpenAI if Zapier fails.
 */
export async function POST(request: NextRequest) {
  const span = createBusinessSpan('generate_letter', {
    'http.method': 'POST',
    'http.route': '/api/generate-letter',
  })

  // Track which generation method is used (Zapier primary, OpenAI fallback)
  const zapierAvailable = isZapierConfigured()

  try {
    recordSpanEvent('letter_generation_started')
    addSpanAttributes({ 'generation.method': 'zapier_primary', 'openai_available': true, 'zapier_available': zapierAvailable })

    // 1. Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, letterGenerationRateLimit, ...getRateLimitTuple('LETTER_GENERATE'))
    if (rateLimitResponse) {
      recordSpanEvent('rate_limit_exceeded')
      span.setStatus({
        code: 2, // ERROR
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

    // 4. Check API configuration (Zapier is primary, OpenAI is fallback)
    // Note: We require at least one generation method to be configured
    const hasGenerationMethod = zapierAvailable || (openaiConfig.apiKey && openaiConfig.isConfigured)
    if (!hasGenerationMethod) {
      console.error("[GenerateLetter] No generation method configured. Set ZAPIER_WEBHOOK_URL or OPENAI_API_KEY.")
      return errorResponses.serverError("Letter generation is temporarily unavailable. Please contact support.")
    }
    if (!openaiConfig.apiKey || !openaiConfig.isConfigured) {
      console.error("[GenerateLetter] OpenAI is not configured.")
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

      // Refund if we deducted (not free trial or super admin)
      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(user.id, 1)
      }

      return errorResponses.serverError("Failed to create letter record")
    }

    // 7. Send to Zapier webhook for async generation (primary)
    // Zapier will send the generated content back to /api/letter-generated
    const generationMethod: 'zapier' | 'openai' = 'zapier'

    if (zapierAvailable) {
      console.log("[GenerateLetter] Sending form data to Zapier webhook (async generation)")
      recordSpanEvent('zapier_webhook_sent')

      const zapierFormData = transformIntakeToZapierFormat(
        newLetter.id,
        user.id,
        sanitizedLetterType,
        sanitizedIntakeData as Record<string, unknown>
      )

      // Fire and forget - Zapier will send webhook back to /api/letter-generated
      generateLetterViaZapier(zapierFormData).catch(err => {
        console.error('[GenerateLetter] Zapier webhook failed (will retry via fallback):', err)
        // If Zapier fails, we'll handle it when the webhook doesn't arrive
        // For now, the letter stays in 'generating' status
        recordSpanEvent('zapier_webhook_failed', {
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      })
    } else {
      // Zapier not configured, try OpenAI as fallback
      console.warn("[GenerateLetter] Zapier not configured, using OpenAI fallback")
      recordSpanEvent('openai_fallback_started')

      try {
        const generatedContent = await generateLetterContent(
          sanitizedLetterType,
          sanitizedIntakeData
        )

        // Update letter with generated content
        const { error: updateError } = await supabase
          .from("letters")
          .update({
            ai_draft: generatedContent,
            status: "pending_review",
            updated_at: new Date().toISOString(),
          })
          .eq("id", newLetter.id)

        if (updateError) {
          throw updateError
        }

        // Log audit trail
        await logLetterStatusChange(
          supabase,
          newLetter.id,
          'generating',
          'pending_review',
          'created',
          `Letter generated successfully via OpenAI (fallback - Zapier not configured)`
        )

        recordSpanEvent('openai_generation_succeeded')
      } catch (openaiError) {
        // OpenAI also failed, mark letter as failed and refund
        await supabase
          .from("letters")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", newLetter.id)

        if (!isFreeTrial && !isSuperAdmin) {
          await refundLetterAllowance(user.id, 1)
        }

        throw openaiError
      }
    }

    // 8. Notify admins (non-blocking for the response)
    // Only notify if we generated synchronously (OpenAI fallback)
    // For Zapier, notification happens when webhook returns
    if (!zapierAvailable) {
      notifyAdminsNewLetter(newLetter.id, newLetter.title, sanitizedLetterType).catch(err => {
        console.error('[GenerateLetter] Admin notification failed:', err)
      })
    }

    // 9. Return success response
    // For Zapier (async): status is 'generating'
    // For OpenAI (sync): status is 'pending_review'
    const responseStatus = zapierAvailable ? 'generating' : 'pending_review'
    const responseDraft = zapierAvailable ? undefined : await supabase
      .from("letters")
      .select("ai_draft")
      .eq("id", newLetter.id)
      .single()
      .then(res => res.data?.ai_draft)

    return successResponse<LetterGenerationResponse>({
      success: true,
      letterId: newLetter.id,
      status: responseStatus,
      isFreeTrial: isFreeTrial,
      aiDraft: await responseDraft,
    })

  } catch (generationError: unknown) {
      console.error("[GenerateLetter] Generation failed:", generationError)

      // Update letter status to failed
      await supabase
        .from("letters")
        .update({
          status: "failed",
          updated_at: new Date().toISOString()
        })
        .eq("id", newLetter.id)

      // Refund if we deducted (not free trial or super admin)
      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(user.id, 1)
      }

      // Log audit trail
      const errorMessage = generationError instanceof Error ? generationError.message : "Unknown error"
      const failedMethod = generationMethod === 'zapier' ? 'Zapier (primary)' :
                          'OpenAI (fallback)'
      await logLetterStatusChange(
        supabase,
        newLetter.id,
        'generating',
        'failed',
        'generation_failed',
        `Generation failed (${failedMethod}): ${errorMessage}`
      )

      // Notify Zapier about the failure (non-blocking, for alerting)
      notifyZapierLetterFailed(newLetter.id, sanitizedLetterType, user.id, errorMessage)

      return errorResponses.serverError(errorMessage || "AI generation failed")
    }

  } catch (error: unknown) {
    span.recordException(error as Error)
    span.setStatus({
      code: 2, // ERROR
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
