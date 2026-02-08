import { type NextRequest } from "next/server"
import { letterGenerationRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { validateLetterGenerationRequest } from '@/lib/validation/letter-schema'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import { requireSubscriber } from '@/lib/auth/authenticate-user'
import { getRateLimitTuple } from '@/lib/config'
import {
  checkAndDeductAllowance,
  refundLetterAllowance,
} from '@/lib/services/allowance-service'
import { logLetterStatusChange } from '@/lib/services/audit-service'
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

    addSpanAttributes({
      'generation.method': 'n8n',
      'generation.n8n_available': n8nAvailable,
    })

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

    const { user, supabase } = await requireSubscriber()
    supabaseClient = supabase

    addSpanAttributes({
      'user.id': user.id,
      'user.email': user.email || 'unknown',
    })
    recordSpanEvent('user_authenticated', { user_id: user.id })

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

    if (!n8nAvailable) {
      console.error("[GenerateLetter] n8n is not configured.")
      return errorResponses.serverError(
        "Letter generation service is temporarily unavailable. Please try again later."
      )
    }

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

    let generatedContent: string
    let researchApplied = false
    let researchState: string | undefined

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
        'generation.research_applied': researchApplied,
        'generation.research_state': researchState || 'unknown',
      })

    } catch (n8nError) {
      const n8nErrorMessage = n8nError instanceof Error ? n8nError.message : 'Unknown n8n error'
      console.error(`[GenerateLetter] n8n generation failed for letter ${letterId}:`, n8nErrorMessage)
      recordSpanEvent('n8n_generation_failed', { error: n8nErrorMessage })

      await supabase
        .from("letters")
        .update({
          status: "failed",
          generation_error: `Generation failed: ${n8nErrorMessage}`,
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

    console.log(`[GenerateLetter] Letter ${letterId} saved by n8n workflow`)

    recordSpanEvent('letter_saved_to_database', {
      status: 'pending_review',
      method: 'n8n',
    })

    await logLetterStatusChange(
      supabase,
      letterId!,
      'generating',
      'pending_review',
      'created',
      `Letter generated via n8n with jurisdiction research${researchApplied ? ` for ${researchState || 'unknown state'}` : ''}`
    ).catch(err => {
      console.warn("[GenerateLetter] Audit log failed (non-critical):", err)
    })

    notifyAdminsNewLetter(letterId!, letterTitle, sanitizedLetterType).catch(err => {
      console.warn("[GenerateLetter] Admin notification failed (non-critical):", err)
    })

    recordSpanEvent('admin_notification_queued')

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

export async function GET() {
  const n8nAvailable = isN8nConfigured()

  return successResponse({
    endpoint: '/api/generate-letter',
    method: 'POST',
    description: 'Generate a professional legal letter with jurisdiction research (n8n only)',
    generationMethod: 'n8n',
    n8nConfigured: n8nAvailable,
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
      '3. n8n researches jurisdiction (state statutes, disclosures, conventions)',
      '4. n8n generates letter with research context via GPT-4o',
      '5. Letter saved with status "pending_review"',
      '6. Admins notified for review',
      '7. Letter appears in Admin Review Center',
    ],
  })
}
