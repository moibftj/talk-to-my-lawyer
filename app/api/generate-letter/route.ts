/**
 * Letter generation endpoint
 * POST /api/generate-letter
 *
 * Handles AI-powered letter generation with:
 * - User authentication and authorization
 * - Allowance checking (free trial, paid, super user)
 * - AI generation with retry logic
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
  incrementTotalLetters,
} from '@/lib/services/allowance-service'
import { logLetterStatusChange } from '@/lib/services/audit-service'
import { generateLetterContent } from '@/lib/services/letter-generation-service'
import { notifyAdminsNewLetter } from '@/lib/services/notification-service'
import type { LetterGenerationResponse } from '@/lib/types/letter.types'
import { createBusinessSpan, addSpanAttributes, recordSpanEvent } from '@/lib/monitoring/tracing'

export const runtime = "nodejs"

/**
 * Generate a letter using AI
 */
export async function POST(request: NextRequest) {
  const span = createBusinessSpan('generate_letter', {
    'http.method': 'POST',
    'http.route': '/api/generate-letter',
  })

  try {
    recordSpanEvent('letter_generation_started')

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

    // 4. Check API configuration
    if (!openaiConfig.apiKey) {
      console.error("[GenerateLetter] Missing OPENAI_API_KEY")
      return errorResponses.serverError("Server configuration error")
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

    // 7. Generate letter using AI with retry logic
    try {
      const generatedContent = await generateLetterContent(
        sanitizedLetterType,
        sanitizedIntakeData
      )

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

      // 9. Increment total letters generated
      await incrementTotalLetters(user.id)

      // 10. Log audit trail
      await logLetterStatusChange(
        supabase,
        newLetter.id,
        'generating',
        'pending_review',
        'created',
        'Letter generated successfully by AI'
      )

      // 11. Notify admins
      await notifyAdminsNewLetter(newLetter.id, newLetter.title, sanitizedLetterType)

      // 12. Return success response
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
        `Generation failed: ${errorMessage}`
      )

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
