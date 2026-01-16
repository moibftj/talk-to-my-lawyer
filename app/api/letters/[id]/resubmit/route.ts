import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { letterGenerationRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { checkGenerationEligibility, deductLetterAllowance, shouldSkipDeduction } from '@/lib/services/allowance-service'
import { getOpenAIModel } from '@/lib/ai/openai-client'
import { requireAuth } from '@/lib/auth/authenticate-user'
import { errorResponses, handleApiError, successResponse } from '@/lib/api/api-error-handler'
import { getRateLimitTuple } from '@/lib/config'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, letterGenerationRateLimit, ...getRateLimitTuple('LETTER_GENERATE'))
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params

    const { user, supabase } = await requireAuth()

    // Get the letter and verify ownership
    const { data: letter, error: letterError } = await supabase
      .from('letters')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (letterError || !letter) {
      return errorResponses.notFound('Letter')
    }

    // Can only resubmit rejected letters
    if (letter.status !== 'rejected') {
      return errorResponses.validation('Only rejected letters can be resubmitted')
    }

    const eligibility = await checkGenerationEligibility(user.id)
    if (!eligibility.canGenerate) {
      return errorResponses.forbidden(
        eligibility.reason || 'No letter credits remaining. Please upgrade your plan.'
      )
    }

    // Update letter status back to generating
    const { error: updateError } = await supabase
      .from('letters')
      .update({
        status: 'generating',
        rejection_reason: null, // Clear rejection reason
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    try {
      // Regenerate letter with rejection feedback
      const prompt = buildResubmitPrompt(letter, letter.rejection_reason)

      const { text: generatedContent } = await generateText({
        model: getOpenAIModel("gpt-4-turbo"),
        system: "You are a professional legal attorney revising a formal legal letter based on feedback. Incorporate the rejection feedback to create an improved, professional letter.",
        prompt,
        temperature: 0.7,
        maxOutputTokens: 2048,
      })

      if (!generatedContent) {
        throw new Error("AI returned empty content")
      }

      // Update letter with new content and move to pending_review
      const { error: finalUpdateError } = await supabase
        .from('letters')
        .update({
          ai_draft_content: generatedContent,
          status: 'pending_review',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (finalUpdateError) throw finalUpdateError

      // Deduct credit if needed
      if (!shouldSkipDeduction(eligibility)) {
        const deduction = await deductLetterAllowance(user.id)

        if (!deduction.success || !deduction.wasDeducted) {
          // Mark as failed if can't deduct
          await supabase
            .from('letters')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', id)

          return errorResponses.forbidden(
            deduction.error || 'No letter credits remaining. Please upgrade your plan.'
          )
        }
      }

      // Log audit trail
      await supabase.rpc('log_letter_audit', {
        p_letter_id: id,
        p_action: 'resubmitted',
        p_old_status: 'rejected',
        p_new_status: 'pending_review',
        p_notes: 'Letter resubmitted after addressing rejection feedback'
      })

      return successResponse({
        success: true,
        letterId: id,
        status: 'pending_review',
        aiDraft: generatedContent,
      })

    } catch (generationError: any) {
      console.error('[Resubmit] Generation failed:', generationError)

      // Update letter status to failed
      await supabase
        .from('letters')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      // Log audit trail
      await supabase.rpc('log_letter_audit', {
        p_letter_id: id,
        p_action: 'resubmit_failed',
        p_old_status: 'rejected',
        p_new_status: 'failed',
        p_notes: `Resubmission failed: ${generationError.message}`
      })

      return errorResponses.serverError(
        generationError.message || 'Failed to regenerate letter'
      )
    }

  } catch (error) {
    return handleApiError(error, 'Letter Resubmit')
  }
}

function buildResubmitPrompt(letter: any, rejectionReason: string): string {
  const intakeData = letter.intake_data || {}

  return `Please revise and improve this legal letter based on the rejection feedback:

ORIGINAL LETTER:
${letter.ai_draft_content}

REJECTION FEEDBACK:
${rejectionReason}

ORIGINAL INTAKE DATA:
${Object.entries(intakeData).map(([key, value]) => `${key}: ${value}`).join('\n')}

Requirements:
- Address all the points in the rejection feedback
- Maintain professional legal tone and proper formatting
- Keep all the original facts and details from the intake data
- Ensure legal accuracy and effectiveness
- Format as a complete letter with proper structure

Return ONLY the revised letter content, no additional commentary or explanations.`
}
