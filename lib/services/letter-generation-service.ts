/**
 * Letter Generation Service
 *
 * Handles AI-powered letter generation logic
 * Extracted from the generate-letter API route for better separation of concerns
 */

import { generateTextWithRetry } from '@/lib/ai/openai-retry'
import { createAISpan, addSpanAttributes, recordSpanEvent } from '@/lib/monitoring/tracing'

/**
 * Generate letter content using AI with retry logic
 *
 * @param letterType - Type of letter to generate
 * @param intakeData - Structured data for the letter
 * @returns Generated letter content
 * @throws Error if AI generation fails
 */
export async function generateLetterContent(
  letterType: string,
  intakeData: Record<string, unknown>
): Promise<string> {
  const span = createAISpan('generateLetterContent', {
    'ai.letter_type': letterType,
    'ai.intake_data_fields': Object.keys(intakeData).length,
  })

  try {
    const prompt = buildLetterPrompt(letterType, intakeData)

    addSpanAttributes({
      'ai.prompt_length': prompt.length,
    })

    console.log('[LetterGenerationService] Starting AI generation with retry logic')
    const generationStartTime = Date.now()

    recordSpanEvent('ai_generation_starting', {
      letter_type: letterType,
      prompt_length: prompt.length,
    })

    const { text: generatedContent, attempts, duration } = await generateTextWithRetry({
      prompt,
      system: "You are a professional legal attorney drafting formal legal letters. Always produce professional, legally sound content with proper formatting.",
      temperature: 0.7,
      maxOutputTokens: 2048,
      model: "gpt-4-turbo"
    })

    const generationTime = Date.now() - generationStartTime
    console.log(`[LetterGenerationService] AI generation completed:`, {
      attempts,
      duration,
      generationTime,
      contentLength: generatedContent.length
    })

    if (!generatedContent) {
      const error = new Error("AI returned empty content")
      span.recordException(error)
      span.setStatus({
        code: 2, // ERROR
        message: 'AI returned empty content'
      })
      throw error
    }

    addSpanAttributes({
      'ai.attempts': attempts,
      'ai.duration_ms': duration,
      'ai.generation_time_ms': generationTime,
      'ai.content_length': generatedContent.length,
      'ai.success': true,
    })

    recordSpanEvent('ai_generation_completed', {
      attempts,
      duration_ms: duration,
      content_length: generatedContent.length,
    })

    span.setStatus({ code: 1 }) // SUCCESS
    return generatedContent

  } catch (error) {
    span.recordException(error as Error)
    span.setStatus({
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  } finally {
    span.end()
  }
}

/**
 * Build AI prompt from letter type and intake data
 *
 * @param letterType - Type of letter to generate
 * @param intakeData - Structured data for the letter
 * @returns Formatted prompt string
 */
export function buildLetterPrompt(letterType: string, intakeData: Record<string, unknown>): string {
  const formatField = (key: string): string => {
    const value = intakeData[key]
    if (value === undefined || value === null || value === '') return ''
    const fieldName = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ')
    return `${fieldName}: ${String(value)}`
  }

  const amountField = intakeData["amountDemanded"]
    ? `Amount Demanded: $${Number(intakeData["amountDemanded"]).toLocaleString()}`
    : ""

  const deadlineField = intakeData["deadlineDate"]
    ? `Deadline: ${intakeData["deadlineDate"]}`
    : ""

  const incidentDateField = intakeData["incidentDate"]
    ? `Incident Date: ${intakeData["incidentDate"]}`
    : ""

  const basePrompt = [
    `Draft a professional ${letterType} letter with the following details:`,
    "",
    "Sender Information:",
    formatField("senderName"),
    formatField("senderAddress"),
    formatField("senderEmail"),
    formatField("senderPhone"),
    "",
    "Recipient Information:",
    formatField("recipientName"),
    formatField("recipientAddress"),
    formatField("recipientEmail"),
    formatField("recipientPhone"),
    "",
    "Case Details:",
    formatField("issueDescription"),
    formatField("desiredOutcome"),
    amountField,
    deadlineField,
    incidentDateField,
    formatField("additionalDetails"),
    "",
    "Requirements:",
    "- Write a professional, legally sound letter (300-500 words)",
    "- Include proper date and formal letter format",
    "- Present facts clearly and objectively",
    "- State clear demands with specific deadlines (if applicable)",
    "- Maintain professional legal tone throughout",
    "- Include proper salutations and closing",
    "- Format as a complete letter with all standard elements",
    "- Avoid any legal advice beyond standard letter writing",
    "",
    "Important: Only return the letter content itself, no explanations or commentary."
  ]

  return basePrompt.filter(Boolean).join("\n")
}

/**
 * Improve existing letter content using AI
 *
 * @param originalContent - Original letter content to improve
 * @param improvementNotes - Specific notes on what to improve
 * @returns Improved letter content
 * @throws Error if AI generation fails
 */
export async function improveLetterContent(
  originalContent: string,
  improvementNotes?: string
): Promise<string> {
  const span = createAISpan('improveLetterContent', {
    'ai.original_length': originalContent.length,
    'ai.has_notes': !!improvementNotes,
  })

  try {
    const prompt = buildImprovementPrompt(originalContent, improvementNotes)

    const { text: improvedContent } = await generateTextWithRetry({
      prompt,
      system: "You are a professional legal attorney improving legal letters. Maintain professionalism and legal accuracy while addressing the requested improvements.",
      temperature: 0.7,
      maxOutputTokens: 2048,
      model: "gpt-4-turbo"
    })

    if (!improvedContent) {
      throw new Error("AI returned empty content")
    }

    span.setStatus({ code: 1 }) // SUCCESS
    return improvedContent

  } catch (error) {
    span.recordException(error as Error)
    span.setStatus({
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  } finally {
    span.end()
  }
}

/**
 * Build prompt for improving letter content
 */
function buildImprovementPrompt(originalContent: string, improvementNotes?: string): string {
  const basePrompt = [
    "Improve the following legal letter while maintaining its core message and professionalism:",
    "",
    "Original Letter:",
    originalContent,
    "",
  ]

  if (improvementNotes) {
    basePrompt.push(
      "Specific Improvements Requested:",
      improvementNotes,
      ""
    )
  }

  basePrompt.push(
    "Requirements:",
    "- Maintain professional legal tone",
    "- Preserve all key facts and demands",
    "- Improve clarity and persuasiveness",
    "- Ensure proper legal letter format",
    "- Keep the letter concise and focused",
    "",
    "Important: Only return the improved letter content itself, no explanations or commentary."
  )

  return basePrompt.join("\n")
}
