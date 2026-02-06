/**
 * Letter Generation API Endpoint
 * POST /api/generate-letter
 *
 * ARCHITECTURE: OpenAI-Only Letter Generation
 * ============================================
 * 1. POST: User submits letter form data
 * 2. PROCESS: OpenAI generates professional legal letter
 * 3. SAVE: Letter saved to database with 'pending_review' status
 * 4. NOTIFY: Admins notified for review
 * 
 * Flow: User → POST /api/generate-letter → OpenAI → Database → Admin Review Center
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
import type { LetterGenerationResponse } from '@/lib/types/letter.types'
import { createBusinessSpan, addSpanAttributes, recordSpanEvent } from '@/lib/monitoring/tracing'

export const runtime = "nodejs"

// Constants for letter generation
const GENERATION_TIMEOUT_MS = 60000 // 60 seconds max for OpenAI generation

/**
 * POST /api/generate-letter
 * 
 * Generate a professional legal letter using OpenAI
 * 
 * Request Body:
 * {
 *   letterType: string (e.g., "demand_letter", "cease_and_desist")
 *   intakeData: {
 *     senderName: string
 *     senderAddress: string
 *     senderState: string (e.g., "FL" for Florida)
 *     recipientName: string
 *     recipientAddress: string
 *     recipientState: string
 *     issueDescription: string
 *     desiredOutcome: string
 *     amountDemanded?: number
 *     deadlineDate?: string
 *     additionalDetails?: string
 *   }
 * }
 * 
 * Response:
 * {
 *   success: true
 *   letterId: string (UUID)
 *   status: "pending_review"
 *   isFreeTrial: boolean
 *   aiDraft: string (the generated letter content)
 * }
 */
export async function POST(request: NextRequest) {
  const span = createBusinessSpan('generate_letter', {
    'http.method': 'POST',
    'http.route': '/api/generate-letter',
  })

  let letterId: string | null = null
  let isFreeTrial = false
  let isSuperAdmin = false
  let supabaseClient: any = null

  try {
    recordSpanEvent('letter_generation_started')
    addSpanAttributes({ 
      'generation.method': 'openai_direct', 
      'openai_configured': openaiConfig.isConfigured,
    })

    // =========================================================================
    // STEP 1: Rate Limiting
    // =========================================================================
    const rateLimitResponse = await safeApplyRateLimit(
      request, 
      letterGenerationRateLimit, 
      ...getRateLimitTuple('LETTER_GENERATE')
    )
    if (rateLimitResponse) {
      recordSpanEvent('rate_limit_exceeded')
      span.setStatus({ code: 2, message: 'Rate limit exceeded' })
      return rateLimitResponse
    }

    // =========================================================================
    // STEP 2: Authentication & Authorization
    // =========================================================================
    const { user, supabase } = await requireSubscriber()
    supabaseClient = supabase

    addSpanAttributes({
      'user.id': user.id,
      'user.email': user.email || 'unknown',
    })
    recordSpanEvent('user_authenticated', { user_id: user.id })

    // =========================================================================
    // STEP 3: Request Validation
    // =========================================================================
    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.error("[GenerateLetter] Failed to parse request body:", parseError)
      return errorResponses.validation("Invalid JSON in request body")
    }

    const { letterType, intakeData } = body

    if (!letterType || typeof letterType !== 'string') {
      return errorResponses.validation("letterType is required and must be a string")
    }

    if (!intakeData || typeof intakeData !== 'object') {
      return errorResponses.validation("intakeData is required and must be an object")
    }

    const validation = validateLetterGenerationRequest(letterType, intakeData)
    if (!validation.valid) {
      console.error("[GenerateLetter] Validation failed:", validation.errors)
      return errorResponses.validation("Invalid input data", validation.errors)
    }

    const sanitizedLetterType = letterType.trim()
    const sanitizedIntakeData = validation.data!

    addSpanAttributes({
      'letter.type': sanitizedLetterType,
      'letter.sender_state': String(sanitizedIntakeData.senderState || 'unknown'),
      'letter.recipient_state': String(sanitizedIntakeData.recipientState || 'unknown'),
    })

    // =========================================================================
    // STEP 4: Verify OpenAI Configuration
    // =========================================================================
    if (!openaiConfig.isConfigured) {
      console.error("[GenerateLetter] OpenAI not configured. Set OPENAI_API_KEY env variable.")
      return errorResponses.serverError(
        "Letter generation service is temporarily unavailable. Please try again later."
      )
    }

    // =========================================================================
    // STEP 5: Check & Deduct Allowance (Atomic Operation)
    // =========================================================================
    const deductionResult = await checkAndDeductAllowance(user.id)

    if (!deductionResult.success) {
      console.log("[GenerateLetter] Allowance check failed:", deductionResult.errorMessage)
      return errorResponses.validation(
        deductionResult.errorMessage || "No letter credits remaining",
        { needsSubscription: true, code: 'INSUFFICIENT_CREDITS' }
      )
    }

    isFreeTrial = deductionResult.isFreeTrial || false
    isSuperAdmin = deductionResult.isSuperAdmin || false

    addSpanAttributes({
      'user.is_free_trial': isFreeTrial,
      'user.is_super_admin': isSuperAdmin,
    })

    // =========================================================================
    // STEP 6: Create Letter Record (Status: 'generating')
    // =========================================================================
    const letterTitle = `${sanitizedLetterType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${new Date().toLocaleDateString()}`

    const { data: newLetter, error: insertError } = await supabase
      .from("letters")
      .insert({
        user_id: user.id,
        letter_type: sanitizedLetterType,
        title: letterTitle,
        intake_data: sanitizedIntakeData,
        status: "generating",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, title, letter_type, status, created_at")
      .single()

    if (insertError || !newLetter) {
      console.error("[GenerateLetter] Database insert failed:", insertError)
      
      // Refund allowance since we couldn't create the letter
      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(user.id, 1).catch(err => {
          console.error("[GenerateLetter] Failed to refund allowance:", err)
        })
      }
      
      return errorResponses.serverError("Failed to create letter record. Please try again.")
    }

    letterId = newLetter.id
    console.log(`[GenerateLetter] Created letter record: ${letterId}`)
    recordSpanEvent('letter_record_created', { letter_id: letterId! })

    // =========================================================================
    // STEP 7: Generate Letter via OpenAI
    // =========================================================================
    console.log(`[GenerateLetter] Starting OpenAI generation for letter: ${letterId}`)
    recordSpanEvent('openai_generation_started')

    let generatedContent: string

    try {
      // Add timeout protection for OpenAI call
      const generationPromise = generateLetterContent(sanitizedLetterType, sanitizedIntakeData)
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Letter generation timed out')), GENERATION_TIMEOUT_MS)
      })

      generatedContent = await Promise.race([generationPromise, timeoutPromise])

      // Validate generated content
      if (!generatedContent || generatedContent.trim().length < 100) {
        throw new Error("Generated content is too short or empty")
      }

      console.log(`[GenerateLetter] OpenAI generation successful. Content length: ${generatedContent.length}`)
      recordSpanEvent('openai_generation_completed', {
        content_length: generatedContent.length,
      })

    } catch (generationError) {
      const errorMessage = generationError instanceof Error ? generationError.message : 'Unknown generation error'
      console.error(`[GenerateLetter] OpenAI generation failed for letter ${letterId}:`, errorMessage)
      
      recordSpanEvent('openai_generation_failed', { error: errorMessage })

      // Update letter status to 'failed'
      await supabase
        .from("letters")
        .update({
          status: "failed",
          generation_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", letterId)

      // Refund allowance
      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(user.id, 1).catch(err => {
          console.error("[GenerateLetter] Failed to refund allowance:", err)
        })
      }

      return errorResponses.serverError(
        "Failed to generate letter. Your credit has been refunded. Please try again."
      )
    }

    // =========================================================================
    // STEP 8: Save Generated Content & Update Status to 'pending_review'
    // =========================================================================
    const { error: updateError } = await supabase
      .from("letters")
      .update({
        ai_draft_content: generatedContent,
        status: "pending_review",
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", letterId)

    if (updateError) {
      console.error(`[GenerateLetter] Failed to save generated content for letter ${letterId}:`, updateError)
      
      // Try to mark as failed
      await supabase
        .from("letters")
        .update({
          status: "failed",
          generation_error: "Failed to save generated content",
          updated_at: new Date().toISOString(),
        })
        .eq("id", letterId)

      // Refund allowance
      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(user.id, 1).catch(err => {
          console.error("[GenerateLetter] Failed to refund allowance:", err)
        })
      }

      return errorResponses.serverError(
        "Failed to save generated letter. Your credit has been refunded."
      )
    }

    console.log(`[GenerateLetter] Letter ${letterId} saved and set to pending_review`)
    recordSpanEvent('letter_saved_to_database', { status: 'pending_review' })

    // =========================================================================
    // STEP 9: Audit Trail
    // =========================================================================
    await logLetterStatusChange(
      supabase,
      letterId!,
      'generating',
      'pending_review',
      'created',
      'Letter generated successfully via OpenAI and queued for admin review'
    ).catch(err => {
      console.warn("[GenerateLetter] Audit log failed (non-critical):", err)
    })

    // =========================================================================
    // STEP 10: Notify Admins (Fire-and-forget)
    // =========================================================================
    notifyAdminsNewLetter(letterId!, letterTitle, sanitizedLetterType).catch(err => {
      console.warn("[GenerateLetter] Admin notification failed (non-critical):", err)
    })

    recordSpanEvent('admin_notification_queued')

    // =========================================================================
    // STEP 11: Return Success Response
    // =========================================================================
    span.setStatus({ code: 1 }) // SUCCESS

    return successResponse<LetterGenerationResponse>({
      success: true,
      letterId: letterId!,
      status: 'pending_review',
      isFreeTrial: isFreeTrial,
      aiDraft: generatedContent,
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error("[GenerateLetter] Unexpected error:", errorMessage)

    span.recordException(error as Error)
    span.setStatus({ code: 2, message: errorMessage })
    recordSpanEvent('letter_generation_error', { error: errorMessage })

    // If we created a letter but failed later, try to clean up
    if (letterId && supabaseClient) {
      await supabaseClient
        .from("letters")
        .update({
          status: "failed",
          generation_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", letterId)
        .catch(() => {}) // Ignore cleanup errors

      // Refund allowance
      if (!isFreeTrial && !isSuperAdmin) {
        await refundLetterAllowance(letterId, 1).catch(() => {})
      }
    }

    return handleApiError(error, 'GenerateLetter')
  } finally {
    span.end()
  }
}

/**
 * GET /api/generate-letter
 * 
 * Health check and API documentation
 */
export async function GET() {
  return successResponse({
    endpoint: '/api/generate-letter',
    method: 'POST',
    description: 'Generate a professional legal letter using OpenAI',
    openaiConfigured: openaiConfig.isConfigured,
    requiredFields: {
      letterType: 'string - Type of letter (e.g., demand_letter, cease_and_desist)',
      intakeData: {
        senderName: 'string - Full name of sender',
        senderAddress: 'string - Full address of sender',
        senderState: 'string - Two-letter state code (e.g., FL for Florida)',
        recipientName: 'string - Full name of recipient',
        recipientAddress: 'string - Full address of recipient', 
        recipientState: 'string - Two-letter state code',
        issueDescription: 'string - Description of the legal issue',
        desiredOutcome: 'string - What outcome the sender wants',
      }
    },
    optionalFields: {
      'intakeData.amountDemanded': 'number - Amount being demanded (for demand letters)',
      'intakeData.deadlineDate': 'string - Deadline for response',
      'intakeData.incidentDate': 'string - Date of incident',
      'intakeData.additionalDetails': 'string - Any additional context',
    },
    flow: [
      '1. User submits letter form data via POST',
      '2. System validates input and checks user allowance',
      '3. OpenAI generates professional legal letter',
      '4. Letter saved with status "pending_review"',
      '5. Admins notified for review',
      '6. Letter appears in Admin Review Center',
    ],
  })
}
