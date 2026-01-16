import { NextRequest } from 'next/server'
import { generateText } from 'ai'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { validateAdminAction } from '@/lib/admin/letter-actions'
import { sanitizeString } from '@/lib/security/input-sanitizer'
import { getOpenAIModel } from '@/lib/ai/openai-client'
import { errorResponses, handleApiError, successResponse } from '@/lib/api/api-error-handler'
import { getRateLimitTuple } from '@/lib/config'
import { openaiConfig } from '@/lib/config'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, ...getRateLimitTuple('LETTER_IMPROVE'))
    if (rateLimitResponse) return rateLimitResponse

    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    const { id } = await params

    const body = await request.json()
    const instruction = body?.instruction || body?.instructions
    const content = body?.content

    if (!content || !instruction) {
      return errorResponses.validation('Content and instruction are required')
    }

    const sanitizedContent = sanitizeString(content, 20000)
    const sanitizedInstruction = sanitizeString(instruction, 2000)

    if (!sanitizedContent || !sanitizedInstruction) {
      return errorResponses.validation('Invalid content or instruction')
    }

    if (!openaiConfig.apiKey) {
      console.error('[v0] Missing OPENAI_API_KEY')
      return errorResponses.serverError('Server configuration error')
    }

    // Call OpenAI API for content improvement using AI SDK
    const prompt = buildImprovementPrompt(sanitizedContent, sanitizedInstruction)

    const { text: improvedContent } = await generateText({
      model: getOpenAIModel("gpt-4-turbo"),
      system: "You are a professional legal attorney improving formal legal letters. Always maintain professional legal tone and proper formatting.",
      prompt,
      temperature: 0.7,
      maxOutputTokens: 2048,
    })

    if (!improvedContent) {
      throw new Error('AI returned empty content')
    }

    return successResponse({ improvedContent })
  } catch (error) {
    return handleApiError(error, 'Letter Improve')
  }
}

function buildImprovementPrompt(content: string, instruction: string): string {
  return `You are a professional legal attorney improving a formal legal letter.

Current letter content:
${content}

Improvement instruction: ${instruction}

Please improve the letter according to the instruction while maintaining:
- Professional legal tone and language
- Proper letter structure and formatting
- All critical facts and details from the original
- Legal accuracy and effectiveness

Return ONLY the improved letter content, with no additional commentary or explanations.`
}
