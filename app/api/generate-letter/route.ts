/**
 * Letter Generation API Endpoint
 * POST /api/generate-letter
 *
 * ARCHITECTURE: n8n Primary + OpenAI Fallback
 * ============================================
 * 1. POST: User submits letter form data
 * 2. PRIMARY: n8n workflow generates letter (jurisdiction research + AI generation)
 *    - n8n researches state-specific statutes, disclosures, conventions
 *    - n8n generates letter with legal context via GPT-4o
 *    - n8n updates Supabase directly (ai_draft_content, status, research_data)
 * 3. FALLBACK: If n8n unavailable, OpenAI generates letter directly
 * 4. NOTIFY: Admins notified for review
 *
 * Flow: User → POST → [n8n webhook | OpenAI fallback] → Database → Admin Review
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
import {
  isN8nConfigured,
  generateLetterViaN8n,
  transformIntakeToN8nFormat,
  type N8nGenerationResult,
} from '@/lib/services/n8n-webhook-service'
import { notifyAdminsNewLetter } from '@/lib/services/notification-service'
import type { LetterGenerationResponse } from '@/lib/types/letter.types'
import { createBusinessSpan, addSpanAttributes, recordSpanEvent } from '@/lib/monitoring/tracing'

export const runtime = "nodejs"

const GENERATION_TIMEOUT_MS = 60000

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

    const n8nAvailable = isN8nConfigured()
    const generationMethod = n8nAvailable ? 'n8n_primary' : 'openai_direct'

    addSpanAttributes({
      'generation.method': generationMethod,
      'generation.n8n_available': n8nAvailable,
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
    // STEP 4: Verify Generation Service Available
    // =========================================================================
    if (!n8nAvailable && !openaiConfig.isConfigured) {
      console.error("[GenerateLetter] No generation service configured (n8n or OpenAI).")
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
    // STEP 7: Generate Letter (n8n primary, OpenAI fallback)
    // =========================================================================
    let generatedContent: string
    let actualMethod: 'n8n' | 'openai' = 'openai'
    let researchApplied = false
    let researchState: string | undefined

    if (n8nAvailable) {
      // ---- PRIMARY: n8n workflow (jurisdiction research + generation) ----
      try {
        console.log(`[GenerateLetter] Using n8n workflow for letter: ${letterId}`)
        recordSpanEvent('n8n_generation_started')

        const n8nFormData = transformIntakeToN8nFormat(
          letterId!,
          user.id,
          sanitizedLetterType,
          sanitizedIntakeData as Record<string, unknown>
        )

        const n8nResult: N8nGenerationResult = await generateLetterViaN8n(n8nFormData)

        generatedContent = n8nResult.generatedContent
        actualMethod = 'n8n'
        researchApplied = n8nResult.researchApplied
        researchState = n8nResult.state

        if (generatedContent.trim().length < 100) {
          throw new Error("n8n generated content is too short or empty")
        }

        console.log(`[GenerateLetter] n8n generation successful. Content length: ${generatedContent.length}, Research: ${researchApplied}, State: ${researchState}`)
        recordSpanEvent('n8n_generation_completed', {
          content_length: generatedContent.length,
          research_applied: researchApplied,
          state: researchState || 'unknown',
        })

        addSpanAttributes({
          'generation.actual_method': 'n8n',
          'generation.research_applied': researchApplied,
          'generation.research_state': researchState || 'unknown',
        })

      } catch (n8nError) {
        const n8nErrorMessage = n8nError instanceof Error ? n8nError.message : 'Unknown n8n error'
        console.warn(`[GenerateLetter] n8n generation failed for letter ${letterId}, falling back to OpenAI:`, n8nErrorMessage)
        recordSpanEvent('n8n_generation_failed', { error: n8nErrorMessage })

        if (!openaiConfig.isConfigured) {
          console.error(`[GenerateLetter] OpenAI fallback not available either.`)

          await supabase
            .from("letters")
            .update({
              status: "failed",
              generation_error: `n8n failed: ${n8nErrorMessage}. No OpenAI fallback configured.`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", letterId)

          if (!isFreeTrial && !isSuperAdmin) {
            await refundLetterAllowance(user.id, 1).catch(err => {
              console.error("[GenerateLetter] Failed to refund allowance:", err)
            })
          }

          return errorResponses.serverError(
            "Failed to generate letter. Your credit has been refunded. Please try again."
          )
        }

        recordSpanEvent('openai_fallback_started')
        generatedContent = await generateViaOpenAIFallback(
          sanitizedLetterType,
          sanitizedIntakeData,
          letterId!,
          supabase,
          isFreeTrial,
          isSuperAdmin,
          user.id
        )
        actualMethod = 'openai'
      }
    } else {
      // ---- FALLBACK ONLY: Direct OpenAI generation ----
      console.log(`[GenerateLetter] n8n not configured, using OpenAI direct for letter: ${letterId}`)
      recordSpanEvent('openai_direct_started')

      generatedContent = await generateViaOpenAIFallback(
        sanitizedLetterType,
        sanitizedIntakeData,
        letterId!,
        supabase,
        isFreeTrial,
        isSuperAdmin,
        user.id
      )
      actualMethod = 'openai'
    }

    // =========================================================================
    // STEP 8: Save Generated Content (only if OpenAI fallback was used)
    // n8n updates Supabase directly, so skip this step for n8n
    // =========================================================================
    if (actualMethod === 'openai') {
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
        
        await supabase
          .from("letters")
          .update({
            status: "failed",
            generation_error: "Failed to save generated content",
            updated_at: new Date().toISOString(),
          })
          .eq("id", letterId)

        if (!isFreeTrial && !isSuperAdmin) {
          await refundLetterAllowance(user.id, 1).catch(err => {
            console.error("[GenerateLetter] Failed to refund allowance:", err)
          })
        }

        return errorResponses.serverError(
          "Failed to save generated letter. Your credit has been refunded."
        )
      }

      console.log(`[GenerateLetter] Letter ${letterId} saved via OpenAI fallback`)
    } else {
      console.log(`[GenerateLetter] Letter ${letterId} already saved by n8n workflow`)
    }

    recordSpanEvent('letter_saved_to_database', {
      status: 'pending_review',
      method: actualMethod,
    })

    // =========================================================================
    // STEP 9: Audit Trail
    // =========================================================================
    const auditDetails = actualMethod === 'n8n'
      ? `Letter generated via n8n (primary) with jurisdiction research${researchApplied ? ` for ${researchState || 'unknown state'}` : ''}`
      : 'Letter generated via OpenAI (fallback) and queued for admin review'

    await logLetterStatusChange(
      supabase,
      letterId!,
      'generating',
      'pending_review',
      'created',
      auditDetails
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
    span.setStatus({ code: 1 })

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

    if (letterId && supabaseClient) {
      await supabaseClient
        .from("letters")
        .update({
          status: "failed",
          generation_error: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", letterId)
        .catch(() => {})

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
 * Generate letter content via direct OpenAI call (fallback method)
 */
async function generateViaOpenAIFallback(
  letterType: string,
  intakeData: Record<string, unknown>,
  letterId: string,
  supabase: any,
  isFreeTrial: boolean,
  isSuperAdmin: boolean,
  userId: string
): Promise<string> {
  try {
    const generationPromise = generateLetterContent(letterType, intakeData)
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Letter generation timed out')), GENERATION_TIMEOUT_MS)
    })

    const generatedContent = await Promise.race([generationPromise, timeoutPromise])

    if (!generatedContent || generatedContent.trim().length < 100) {
      throw new Error("Generated content is too short or empty")
    }

    console.log(`[GenerateLetter] OpenAI fallback generation successful. Content length: ${generatedContent.length}`)
    recordSpanEvent('openai_fallback_completed', {
      content_length: generatedContent.length,
    })

    addSpanAttributes({
      'generation.actual_method': 'openai_fallback',
    })

    return generatedContent

  } catch (generationError) {
    const errorMessage = generationError instanceof Error ? generationError.message : 'Unknown generation error'
    console.error(`[GenerateLetter] OpenAI fallback failed for letter ${letterId}:`, errorMessage)
    
    recordSpanEvent('openai_fallback_failed', { error: errorMessage })

    await supabase
      .from("letters")
      .update({
        status: "failed",
        generation_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", letterId)

    if (!isFreeTrial && !isSuperAdmin) {
      await refundLetterAllowance(userId, 1).catch(err => {
        console.error("[GenerateLetter] Failed to refund allowance:", err)
      })
    }

    throw generationError
  }
}

export async function GET() {
  const n8nAvailable = isN8nConfigured()

  return successResponse({
    endpoint: '/api/generate-letter',
    method: 'POST',
    description: 'Generate a professional legal letter with jurisdiction research',
    generationMethod: n8nAvailable ? 'n8n (primary) with OpenAI fallback' : 'OpenAI direct',
    n8nConfigured: n8nAvailable,
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
      n8nAvailable
        ? '3. n8n researches jurisdiction (state statutes, disclosures, conventions)'
        : '3. OpenAI generates letter directly (no jurisdiction research)',
      n8nAvailable
        ? '4. n8n generates letter with research context via GPT-4o'
        : '4. Letter content generated with retry logic',
      '5. Letter saved with status "pending_review"',
      '6. Admins notified for review',
      '7. Letter appears in Admin Review Center',
    ],
  })
}
