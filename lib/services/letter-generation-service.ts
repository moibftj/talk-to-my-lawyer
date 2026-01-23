/**
 * Letter Generation Service
 *
 * Handles intelligent letter generation with multi-step pipeline:
 * 1. Research (optional) - Gather jurisdiction-specific legal information
 * 2. Outline - Structure the letter argument
 * 3. Draft - Generate full letter with research integration
 * 4. Review - Quality check and validation
 */

import { generateTextWithRetry } from '@/lib/ai/openai-retry'
import { createAISpan, addSpanAttributes, recordSpanEvent } from '@/lib/monitoring/tracing'
import { conductLegalResearch, formatResearchForPrompt, isLegalResearchAvailable } from '@/lib/services/legal-research-service'
import {
  getSystemPrompt,
  buildLetterPromptWithContext,
  createLetterOutline,
  formatOutlineForPrompt,
  generateQualityChecklist,
  type LetterPromptContext
} from '@/lib/prompts/letter-prompts'
import { getStateName } from '@/lib/validation/letter-schema'
import type {
  EnhancedLetterContext,
  EnhancedLetterResult,
  LetterOutline,
  GenerationMetadata,
  LetterGenerationOptions
} from '@/lib/types/letter-generation.types'

// ============================================================================
// Original API (Backward Compatible)
// ============================================================================

/**
 * Generate letter content using AI with retry logic
 * @deprecated Use generateProfessionalLetter for enhanced features
 * @param letterType - Type of letter to generate
 * @param intakeData - Structured data for the letter
 * @returns Generated letter content
 */
export async function generateLetterContent(
  letterType: string,
  intakeData: Record<string, unknown>
): Promise<string> {
  const span = createAISpan('generateLetterContent', {
    'ai.letter_type': letterType,
    'ai.intake_data_fields': Object.keys(intakeData).length,
    'ai.generation_method': 'single_shot',
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
 */
function buildLetterPrompt(letterType: string, intakeData: Record<string, unknown>): string {
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
    intakeData["senderState"] ? `Sender State: ${getStateName(String(intakeData["senderState"])) || intakeData["senderState"]}` : "",
    formatField("senderEmail"),
    formatField("senderPhone"),
    "",
    "Recipient Information:",
    formatField("recipientName"),
    formatField("recipientAddress"),
    intakeData["recipientState"] ? `Recipient State: ${getStateName(String(intakeData["recipientState"])) || intakeData["recipientState"]}` : "",
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

// ============================================================================
// Enhanced Multi-Step Generation API
// ============================================================================

/**
 * Generate a professional letter with research and multi-step generation
 *
 * This is the enhanced version that:
 * 1. Conducts legal research for the jurisdiction
 * 2. Creates a structured outline
 * 3. Generates the full letter with research integration
 * 4. Performs quality validation
 *
 * @param context - Enhanced context with jurisdiction and optional research
 * @param options - Generation options
 * @returns Enhanced result with content, research, outline, and metadata
 */
export async function generateProfessionalLetter(
  context: EnhancedLetterContext,
  options: LetterGenerationOptions = {}
): Promise<EnhancedLetterResult> {
  const span = createAISpan('generateProfessionalLetter', {
    'ai.letter_type': context.letterType,
    'ai.jurisdiction': context.jurisdiction,
    'ai.options_skip_research': options.skipResearch || false,
    'ai.options_multi_step': options.useMultiStep !== false,
  })

  const startTime = Date.now()

  try {
    console.log(`[LetterGeneration] Starting enhanced generation for ${context.jurisdiction}`)

    // Step 1: Conduct legal research (if enabled and available)
    let research: Awaited<ReturnType<typeof conductLegalResearch>> | undefined
    let researchDuration: number | undefined

    if (!options.skipResearch && isLegalResearchAvailable()) {
      const researchStart = Date.now()

      try {
        research = await conductLegalResearch({
          letterType: context.letterType,
          issueDescription: String(context.intakeData.issueDescription || ''),
          jurisdiction: context.jurisdiction,
          jurisdictionCode: context.jurisdictionCode,
        })

        researchDuration = Date.now() - researchStart

        addSpanAttributes({
          'ai.research.statutes_found': research.relevantStatutes.length,
          'ai.research.case_law_found': research.relevantCaseLaw.length,
          'ai.research.duration_ms': researchDuration,
        })

        console.log(`[LetterGeneration] Research completed: ${research.relevantStatutes.length} statutes, ${research.relevantCaseLaw.length} cases`)

      } catch (error) {
        console.error('[LetterGeneration] Research failed, continuing without research:', error)
        // Continue without research rather than failing
      }
    }

    // Step 2: Create outline (if multi-step is enabled)
    let outline: LetterOutline | undefined
    const promptContext = buildPromptContext(context, research)

    if (options.useMultiStep !== false) {
      outline = await createLetterOutline(promptContext)
      console.log('[LetterGeneration] Outline created')
    }

    // Step 3: Generate the letter
    const letterPrompt = options.useMultiStep !== false && outline
      ? buildEnhancedPromptWithOutline(promptContext, outline)
      : buildLetterPromptWithContext(promptContext)

    const systemPrompt = getSystemPrompt(context.letterType)

    addSpanAttributes({
      'ai.prompt_length': letterPrompt.length,
      'ai.system_prompt_length': systemPrompt.length,
    })

    const { text: generatedContent, attempts, duration } = await generateTextWithRetry({
      prompt: letterPrompt,
      system: systemPrompt,
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2500,
      model: options.model ?? "gpt-4-turbo",
    })

    if (!generatedContent) {
      throw new Error("AI returned empty content")
    }

    const totalDuration = Date.now() - startTime

    // Step 4: Extract citations from generated content
    const citations = extractCitations(generatedContent, research)

    // Build metadata
    const metadata: GenerationMetadata = {
      model: options.model ?? "gpt-4-turbo",
      attempts,
      duration: totalDuration,
      researchUsed: !!research,
      researchDuration,
      outlineGenerated: !!outline,
      generationMethod: options.useMultiStep !== false ? 'multi_step' : 'single_shot',
      timestamp: new Date(),
    }

    console.log(`[LetterGeneration] Completed in ${totalDuration}ms`, metadata)

    addSpanAttributes({
      'ai.total_duration_ms': totalDuration,
      'ai.content_length': generatedContent.length,
      'ai.citations_found': citations.length,
    })

    span.setStatus({ code: 1 }) // SUCCESS

    return {
      content: generatedContent,
      research,
      outline,
      citations,
      metadata,
    }

  } catch (error) {
    span.recordException(error as Error)
    span.setStatus({
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'Generation failed',
    })
    throw error
  } finally {
    span.end()
  }
}

/**
 * Build the prompt context from enhanced context and research
 */
function buildPromptContext(
  context: EnhancedLetterContext,
  research?: Awaited<ReturnType<typeof conductLegalResearch>>
): LetterPromptContext {
  const data = context.intakeData

  return {
    letterType: context.letterType,
    senderName: String(data.senderName || ''),
    senderAddress: String(data.senderAddress || ''),
    senderState: String(data.senderState || context.jurisdictionCode),
    senderCountry: data.senderCountry ? String(data.senderCountry) : undefined,
    senderEmail: data.senderEmail ? String(data.senderEmail) : undefined,
    senderPhone: data.senderPhone ? String(data.senderPhone) : undefined,
    recipientName: String(data.recipientName || ''),
    recipientAddress: String(data.recipientAddress || ''),
    recipientState: String(data.recipientState || context.jurisdictionCode),
    recipientCountry: data.recipientCountry ? String(data.recipientCountry) : undefined,
    recipientEmail: data.recipientEmail ? String(data.recipientEmail) : undefined,
    recipientPhone: data.recipientPhone ? String(data.recipientPhone) : undefined,
    courtType: data.courtType ? String(data.courtType) : undefined,
    issueDescription: String(data.issueDescription || ''),
    desiredOutcome: String(data.desiredOutcome || ''),
    amountDemanded: data.amountDemanded ? Number(data.amountDemanded) : undefined,
    deadlineDate: data.deadlineDate ? String(data.deadlineDate) : undefined,
    incidentDate: data.incidentDate ? String(data.incidentDate) : undefined,
    additionalDetails: data.additionalDetails ? String(data.additionalDetails) : undefined,
    research,
  }
}

/**
 * Build enhanced prompt with outline integration
 */
function buildEnhancedPromptWithOutline(
  context: LetterPromptContext,
  outline: LetterOutline
): string {
  const basePrompt = buildLetterPromptWithContext(context)
  const outlineText = formatOutlineForPrompt(outline)

  return `${basePrompt}

${outlineText}

IMPORTANT: Follow the outline structure above while writing the full letter.
`
}

/**
 * Extract legal citations from generated content
 */
function extractCitations(
  content: string,
  research?: Awaited<ReturnType<typeof conductLegalResearch>>
): Array<{ type: string; text: string; url?: string }> {
  const citations: Array<{ type: string; text: string; url?: string }> = []

  // Extract citations mentioned in the content
  const citationPatterns = [
    { pattern: /(\d+\s+U\.S\.C\.\s+§\s*\d+)/g, type: 'statute' },
    { pattern: /([A-Z]{2,}\s+Code\s+§\s*\d+)/g, type: 'statute' },
    { pattern: /(\d+\s+F\.3d\s+\d+)/g, type: 'case' },
    { pattern: /(\d+\s+F\. Supp\.\s+\d+)/g, type: 'case' },
    { pattern: /([A-Z][a-z]+\s+v\.\s+[A-Z][\w\s]+)/g, type: 'case' },
  ]

  const seen = new Set<string>()

  for (const { pattern, type } of citationPatterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const citation = match[1]
      if (!seen.has(citation)) {
        seen.add(citation)
        citations.push({ type, text: citation })
      }
    }
  }

  // Add citations from research if they're referenced in the content
  if (research) {
    for (const statute of research.relevantStatutes) {
      if (content.includes(statute.citation) || (statute.title && content.includes(statute.title))) {
        if (!seen.has(statute.citation)) {
          seen.add(statute.citation)
          citations.push({ type: 'statute', text: statute.citation, url: statute.url })
        }
      }
    }

    for (const caseLaw of research.relevantCaseLaw) {
      if (content.includes(caseLaw.citation) || (caseLaw.title && content.includes(caseLaw.title))) {
        if (!seen.has(caseLaw.citation)) {
          seen.add(caseLaw.citation)
          citations.push({ type: 'case', text: caseLaw.citation, url: caseLaw.url })
        }
      }
    }
  }

  return citations
}

// ============================================================================
// Letter Improvement API
// ============================================================================

/**
 * Improve existing letter content using AI
 *
 * @param originalContent - Original letter content to improve
 * @param improvementNotes - Specific notes on what to improve
 * @param letterType - Letter type for context-aware improvements
 * @returns Improved letter content
 */
export async function improveLetterContent(
  originalContent: string,
  improvementNotes?: string,
  letterType?: string
): Promise<string> {
  const span = createAISpan('improveLetterContent', {
    'ai.original_length': originalContent.length,
    'ai.has_notes': !!improvementNotes,
    'ai.letter_type': letterType || 'unknown',
  })

  try {
    const prompt = buildImprovementPrompt(originalContent, improvementNotes, letterType)

    const systemPrompt = letterType
      ? `${getSystemPrompt(letterType)}

You are now improving an existing letter. Your task is to:
1. Address the specific improvement requests
2. Enhance clarity and persuasiveness
3. Maintain all key facts and demands
4. Ensure proper legal letter format
5. Keep the letter concise and focused`
      : "You are a professional legal attorney improving legal letters. Maintain professionalism and legal accuracy while addressing the requested improvements."

    const { text: improvedContent } = await generateTextWithRetry({
      prompt,
      system: systemPrompt,
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
function buildImprovementPrompt(
  originalContent: string,
  improvementNotes?: string,
  letterType?: string
): string {
  const basePrompt = [
    "Improve the following legal letter while maintaining its core message and professionalism:",
    "",
    letterType ? `Letter Type: ${letterType}` : "",
    "Original Letter:",
    "-------------------",
    originalContent,
    "-------------------",
    "",
  ].filter(Boolean)

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
    "- Strengthen the legal argument where possible",
    "",
    "Important: Only return the improved letter content itself, no explanations or commentary."
  )

  return basePrompt.join("\n")
}

// ============================================================================
// Quality Validation
// ============================================================================

/**
 * Validate the quality of a generated letter
 *
 * @param content - Generated letter content
 * @param context - Letter context for validation
 * @returns Quality validation result with score and suggestions
 */
export function validateLetterQuality(
  content: string,
  context: LetterPromptContext
): ReturnType<typeof generateQualityChecklist> {
  return generateQualityChecklist(content, context)
}

/**
 * Check if enhanced letter generation is available
 */
export function isEnhancedGenerationAvailable(): boolean {
  return isLegalResearchAvailable()
}
