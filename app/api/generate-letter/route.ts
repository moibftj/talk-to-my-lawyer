/**
 * Letter generation endpoint
 * POST /api/generate-letter
 *
 * Handles intelligent letter generation with:
 * - User authentication and authorization
 * - Allowance checking (free trial, paid, super user)
 * - AI generation via OpenAI (primary), n8n workflow (fallback 1), or Zapier (fallback 2)
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
  isN8nConfigured,
  generateLetterViaN8n,
  transformIntakeToN8nFormat,
  notifyN8nLetterCompleted,
  notifyN8nLetterFailed,
} from '@/lib/services/n8n-webhook-service'
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
 * Uses n8n workflow for generation if configured, otherwise falls back to local OpenAI.
 */
export async function POST(request: NextRequest) {
  const span = createBusinessSpan('generate_letter', {
    'http.method': 'POST',
    'http.route': '/api/generate-letter',
  })

  // Track which generation method is used (OpenAI primary, n8n fallback)
  const n8nAvailable = isN8nConfigured()

  try {
    recordSpanEvent('letter_generation_started')
    addSpanAttributes({ 'generation.method': 'openai_primary', 'n8n_available': n8nAvailable })

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

    // 4. Check API configuration (OpenAI is primary, n8n is optional fallback)
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

    // 7. Generate letter using AI (OpenAI primary, n8n fallback)
    let generationMethod: 'openai' | 'n8n' = 'openai'
    try {
      let generatedContent: string

      // Try OpenAI first (direct SDK - more reliable)
      try {
        console.log("[GenerateLetter] Using OpenAI SDK for generation (primary)")
        recordSpanEvent('openai_generation_started')

        generatedContent = await generateLetterContent(
          sanitizedLetterType,
          sanitizedIntakeData
        )
        recordSpanEvent('openai_generation_completed')
        generationMethod = 'openai'

      } catch (openaiError) {
        // OpenAI failed, try n8n fallback if available
        if (n8nAvailable) {
          console.warn("[GenerateLetter] OpenAI generation failed, falling back to n8n:", openaiError)
          recordSpanEvent('openai_failed', {
            error: openaiError instanceof Error ? openaiError.message : 'Unknown error'
          })
          recordSpanEvent('n8n_fallback_started')

          const n8nFormData = transformIntakeToN8nFormat(
            newLetter.id,
            user.id,
            sanitizedLetterType,
            sanitizedIntakeData as Record<string, unknown>
          )

          generatedContent = await generateLetterViaN8n(n8nFormData)
          recordSpanEvent('n8n_fallback_succeeded')
          generationMethod = 'n8n'
        } else {
          // No fallback available, re-throw the OpenAI error
          throw openaiError
        }
      }

      // 8. Update letter with generated content
      const { error: updateError } = await supabase
        .from("letters")
        .update({
          ai_draft_content: generatedContent,
          status: "pending_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", newLetter.id)

      if (updateError) {
        throw updateError
      }

      // 9. Log audit trail
      await logLetterStatusChange(
        supabase,
        newLetter.id,
        'generating',
        'pending_review',
        'created',
        `Letter generated successfully via ${generationMethod === 'n8n' ? 'n8n (fallback)' : 'OpenAI (primary)'}`
      )

      // 10. Notify admins (non-blocking for the response)
      notifyAdminsNewLetter(newLetter.id, newLetter.title, sanitizedLetterType).catch(err => {
        console.error('[GenerateLetter] Admin notification failed:', err)
      })

      // 10b. Send completion event to n8n monitoring (non-blocking, optional)
      notifyN8nLetterCompleted(
        newLetter.id,
        sanitizedLetterType,
        newLetter.title,
        user.id,
        isFreeTrial
      )

      // 11. Return success response
      return successResponse<LetterGenerationResponse>({
        success: true,
        letterId: newLetter.id,
        status: "pending_review",
        isFreeTrial: isFreeTrial,
        aiDraft: generatedContent,
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
      await logLetterStatusChange(
        supabase,
        newLetter.id,
        'generating',
        'failed',
        'generation_failed',
        `Generation failed (${generationMethod === 'n8n' ? 'n8n fallback' : 'OpenAI primary'}): ${errorMessage}`
      )

      // Notify n8n about the failure (non-blocking, for alerting)
      notifyN8nLetterFailed(newLetter.id, sanitizedLetterType, user.id, errorMessage)

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
