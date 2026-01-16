import { createClient } from "@/lib/supabase/server"
import { generateText } from "ai"
import { NextRequest } from "next/server"
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { validateAdminAction } from '@/lib/admin/letter-actions'
import { getOpenAIModel } from '@/lib/ai/openai-client'
import { errorResponses, handleApiError, successResponse } from '@/lib/api/api-error-handler'
import { getRateLimitTuple } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, ...getRateLimitTuple('LETTER_IMPROVE'))
    if (rateLimitResponse) return rateLimitResponse

    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    const supabase = await createClient()

    const body = await request.json()
    const { letterId, content } = body

    if (!letterId || !content) {
      return errorResponses.validation("Letter ID and content are required")
    }

    // Fetch letter details for context
    const { data: letter, error: letterError } = await supabase
      .from("letters")
      .select("title, letter_type, intake_data")
      .eq("id", letterId)
      .single()

    if (letterError || !letter) {
      return errorResponses.notFound("Letter")
    }

    // Improve letter content with AI
    const { text: improvedContent } = await generateText({
      model: getOpenAIModel("gpt-4-turbo"),
      system: `You are a professional legal editor. Your task is to improve legal letters while maintaining their core message and legal integrity.

      Your improvements should:
      - Enhance clarity and professionalism
      - Strengthen legal arguments where appropriate
      - Improve organization and flow
      - Fix any grammatical or stylistic issues
      - Ensure proper legal letter format
      - Add appropriate legal language and terminology
      - Maintain the original intent and factual claims

      Do NOT:
      - Change the fundamental legal claims
      - Add new facts or allegations not in the original
      - Make promises about legal outcomes
      - Change the letter type or purpose

      Return ONLY the improved letter content, no additional commentary.`,
      prompt: `Please improve the following legal letter:\n\nLetter Title: ${letter.title}\nLetter Type: ${letter.letter_type}\nContext: ${JSON.stringify(letter.intake_data || {})}\n\nCurrent Content:\n${content}\n\nImproved version:`,
      temperature: 0.3,
      maxOutputTokens: 4000,
    })

    return successResponse({
      success: true,
      improvedContent
    })

  } catch (error) {
    return handleApiError(error, "Letter Improve")
  }
}
