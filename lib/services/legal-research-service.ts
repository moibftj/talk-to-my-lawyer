/**
 * Legal Research Service
 *
 * Conducts web-based legal research for jurisdiction-aware letter generation.
 * Supports Tavily API (recommended) or Bing Web Search as fallback.
 *
 * Research includes:
 * - Relevant state statutes
 * - Case law precedents
 * - Federal laws if applicable
 * - Attorney general guidance
 */

import { createAISpan, addSpanAttributes, recordSpanEvent } from '@/lib/monitoring/tracing'

// ============================================================================
// Types
// ============================================================================

export interface LegalResearchParams {
  letterType: string
  issueDescription: string
  jurisdiction: string // Full state name (e.g., "California")
  jurisdictionCode?: string // 2-letter code (e.g., "CA")
}

export interface Statute {
  title: string
  citation: string
  url?: string
  relevance: number // 0-1 score
  summary: string
}

export interface CaseLaw {
  title: string
  citation: string
  year?: number
  url?: string
  relevance: number
  summary: string
}

export interface LegalResearchResult {
  relevantStatutes: Statute[]
  relevantCaseLaw: CaseLaw[]
  jurisdictionNotes: string
  federalLawReferences: string[]
  sources: string[]
  researchTimestamp: Date
  jurisdiction: string
}

// ============================================================================
// Search Provider Implementations
// ============================================================================

/**
 * Tavily API Search (Recommended - optimized for AI)
 * Docs: https://docs.tavily.com/docs/tavily-api/rest/api
 */
async function searchWithTavily(
  query: string,
  maxResults: number = 5
): Promise<{ title: string; url: string; snippet: string }[]> {
  const apiKey = process.env.TAVILY_API_KEY

  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is not configured')
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      search_depth: 'advanced',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  return (data.results || []).map((result: any) => ({
    title: result.title || '',
    url: result.url || '',
    snippet: result.content || '',
  }))
}

/**
 * Bing Web Search API (Alternative)
 * Requires: BING_SEARCH_API_KEY from Azure Cognitive Services
 */
async function searchWithBing(
  query: string,
  maxResults: number = 5
): Promise<{ title: string; url: string; snippet: string }[]> {
  const apiKey = process.env.BING_SEARCH_API_KEY

  if (!apiKey) {
    throw new Error('BING_SEARCH_API_KEY is not configured')
  }

  const response = await fetch(
    `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
    {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Bing API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  return (data.webPages?.value || []).map((result: any) => ({
    title: result.name || '',
    url: result.url || '',
    snippet: result.snippet || '',
  }))
}

/**
 * Get available search provider and execute search
 */
async function performLegalSearch(
  query: string,
  maxResults: number = 5
): Promise<{ title: string; url: string; snippet: string }[]> {
  const span = createAISpan('legal_search', {
    'legal.search.query': query,
    'legal.search.max_results': maxResults,
  })

  try {
    // Try Tavily first (recommended for AI)
    if (process.env.TAVILY_API_KEY) {
      addSpanAttributes({ 'legal.search.provider': 'tavily' })
      recordSpanEvent('search_provider_selected', { provider: 'tavily' })
      const results = await searchWithTavily(query, maxResults)
      span.setStatus({ code: 1 }) // SUCCESS
      return results
    }

    // Fallback to Bing
    if (process.env.BING_SEARCH_API_KEY) {
      addSpanAttributes({ 'legal.search.provider': 'bing' })
      recordSpanEvent('search_provider_selected', { provider: 'bing' })
      const results = await searchWithBing(query, maxResults)
      span.setStatus({ code: 1 })
      return results
    }

    // No search provider configured
    recordSpanEvent('no_search_provider', {})
    span.setStatus({ code: 1 }) // Not an error, just no research
    return []

  } catch (error) {
    span.recordException(error as Error)
    span.setStatus({
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'Search failed',
    })
    throw error
  } finally {
    span.end()
  }
}

// ============================================================================
// Research Functions
// ============================================================================

/**
 * Search for relevant statutes in the jurisdiction
 */
async function searchStatutes(params: LegalResearchParams): Promise<Statute[]> {
  const searchQueries = [
    `${params.issueDescription} ${params.jurisdiction} statute code`,
    `${params.issueDescription} ${params.jurisdiction} law`,
  ]

  const statutes: Statute[] = []
  const seenUrls = new Set<string>()

  for (const query of searchQueries) {
    try {
      const results = await performLegalSearch(query, 3)

      for (const result of results) {
        // Skip duplicates
        if (seenUrls.has(result.url)) continue
        seenUrls.add(result.url)

        statutes.push({
          title: result.title,
          citation: extractCitation(result.title, result.url),
          url: result.url,
          relevance: calculateRelevance(result.snippet, params.issueDescription),
          summary: result.snippet,
        })
      }
    } catch (error) {
      console.error(`Statute search failed for query: ${query}`, error)
    }
  }

  return statutes.sort((a, b) => b.relevance - a.relevance).slice(0, 5)
}

/**
 * Search for relevant case law
 */
async function searchCaseLaw(params: LegalResearchParams): Promise<CaseLaw[]> {
  const searchQueries = [
    `${params.issueDescription} ${params.jurisdiction} case law precedent`,
    `${params.issueDescription} ${params.jurisdiction} court decision`,
  ]

  const caseLaw: CaseLaw[] = []
  const seenUrls = new Set<string>()

  for (const query of searchQueries) {
    try {
      const results = await performLegalSearch(query, 3)

      for (const result of results) {
        if (seenUrls.has(result.url)) continue
        seenUrls.add(result.url)

        const year = extractYear(result.title, result.snippet)

        caseLaw.push({
          title: result.title,
          citation: extractCitation(result.title, result.url),
          year,
          url: result.url,
          relevance: calculateRelevance(result.snippet, params.issueDescription),
          summary: result.snippet,
        })
      }
    } catch (error) {
      console.error(`Case law search failed for query: ${query}`, error)
    }
  }

  return caseLaw.sort((a, b) => b.relevance - a.relevance).slice(0, 5)
}

/**
 * Search for federal law references
 */
async function searchFederalLaw(params: LegalResearchParams): Promise<string[]> {
  const searchQueries = [
    `${params.issueDescription} federal law United States`,
    `${params.issueDescription} US code`,
  ]

  const references: string[] = []
  const seenUrls = new Set<string>()

  for (const query of searchQueries) {
    try {
      const results = await performLegalSearch(query, 2)

      for (const result of results) {
        if (seenUrls.has(result.url)) continue
        seenUrls.add(result.url)

        references.push(`${result.title}: ${result.snippet}`)
      }
    } catch (error) {
      console.error(`Federal law search failed for query: ${query}`, error)
    }
  }

  return references.slice(0, 3)
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract a legal citation from title or URL
 */
function extractCitation(title: string, url: string): string {
  // Look for common citation patterns in title
  const citationPatterns = [
    /(\d+\s+[A-Z]{2,}\s+\d+\.\d+)/, // e.g., "42 USC 1983"
    /(\d+\s+U\.S\.C\.\s+§\s*\d+)/, // e.g., "18 U.S.C. § 1234"
    /([A-Z]{2,}\s+Code\s+§\s*\d+)/, // e.g., "California Code § 1234"
    /(v\.\s+[A-Z][\w\s]+)/, // Case citation pattern
  ]

  for (const pattern of citationPatterns) {
    const match = title.match(pattern)
    if (match) return match[1]
  }

  // Fallback: return domain from URL
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return 'Statute Reference'
  }
}

/**
 * Extract year from text
 */
function extractYear(title: string, snippet: string): number | undefined {
  const text = title + ' ' + snippet
  const yearMatch = text.match(/\b(19|20)\d{2}\b/g)

  if (yearMatch) {
    // Return the most recent year found
    const years = yearMatch.map(Number).sort((a, b) => b - a)
    return years[0]
  }

  return undefined
}

/**
 * Calculate relevance score based on keyword overlap
 */
function calculateRelevance(snippet: string, query: string): number {
  const snippetLower = snippet.toLowerCase()
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3)

  let matches = 0
  for (const word of queryWords) {
    if (snippetLower.includes(word)) matches++
  }

  return Math.min(matches / queryWords.length, 1)
}

// ============================================================================
// Main Research Function
// ============================================================================

/**
 * Conduct comprehensive legal research for letter generation
 *
 * @param params - Research parameters including letter type, issue, and jurisdiction
 * @returns Research results with statutes, case law, and references
 */
export async function conductLegalResearch(
  params: LegalResearchParams
): Promise<LegalResearchResult> {
  const span = createAISpan('conductLegalResearch', {
    'legal.letter_type': params.letterType,
    'legal.jurisdiction': params.jurisdiction,
    'legal.issue_length': params.issueDescription.length,
  })

  try {
    console.log(`[LegalResearch] Starting research for ${params.jurisdiction}`)

    const startTime = Date.now()

    // Run searches in parallel for better performance
    const [statutes, caseLaw, federalRefs] = await Promise.all([
      searchStatutes(params).catch(() => []),
      searchCaseLaw(params).catch(() => []),
      searchFederalLaw(params).catch(() => []),
    ])

    const duration = Date.now() - startTime

    // Gather all unique source URLs
    const sources = [
      ...statutes.map(s => s.url).filter((u): u is string => !!u),
      ...caseLaw.map(c => c.url).filter((u): u is string => !!u),
    ]

    // Generate jurisdiction notes
    const jurisdictionNotes = generateJurisdictionNotes(params)

    const result: LegalResearchResult = {
      relevantStatutes: statutes,
      relevantCaseLaw: caseLaw,
      jurisdictionNotes,
      federalLawReferences: federalRefs,
      sources: [...new Set(sources)],
      researchTimestamp: new Date(),
      jurisdiction: params.jurisdiction,
    }

    addSpanAttributes({
      'legal.statutes_found': statutes.length,
      'legal.case_law_found': caseLaw.length,
      'legal.federal_refs_found': federalRefs.length,
      'legal.research_duration_ms': duration,
    })

    recordSpanEvent('legal_research_completed', {
      statutes_count: statutes.length,
      case_law_count: caseLaw.length,
      duration_ms: duration,
    })

    console.log(`[LegalResearch] Completed: ${statutes.length} statutes, ${caseLaw.length} cases in ${duration}ms`)

    span.setStatus({ code: 1 }) // SUCCESS
    return result

  } catch (error) {
    span.recordException(error as Error)
    span.setStatus({
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'Research failed',
    })

    // Return empty result on error (fail gracefully)
    console.error('[LegalResearch] Failed, returning empty result:', error)

    return {
      relevantStatutes: [],
      relevantCaseLaw: [],
      jurisdictionNotes: generateJurisdictionNotes(params),
      federalLawReferences: [],
      sources: [],
      researchTimestamp: new Date(),
      jurisdiction: params.jurisdiction,
    }
  } finally {
    span.end()
  }
}

/**
 * Generate jurisdiction-specific notes
 */
function generateJurisdictionNotes(params: LegalResearchParams): string {
  const notes = [
    `This letter concerns a matter under ${params.jurisdiction} law.`,
    `Legal claims should reference applicable ${params.jurisdiction} statutes and regulations.`,
  ]

  // Add letter-type specific guidance
  switch (params.letterType) {
    case 'demand_letter':
      notes.push(`Demand letters in ${params.jurisdiction} should clearly state the amount owed and provide a reasonable deadline for payment.`)
      break
    case 'cease_desist':
      notes.push(`Cease and desist letters should reference specific ${params.jurisdiction} laws being violated and demand immediate cessation.`)
      break
    case 'eviction_notice':
      notes.push(`Eviction notices must comply with ${params.jurisdiction} landlord-tenant laws and provide proper notice periods.`)
      break
    case 'employment_dispute':
      notes.push(`Employment disputes should reference ${params.jurisdiction} labor laws and may involve state or federal agencies.`)
      break
    case 'consumer_complaint':
      notes.push(`Consumer complaints may reference ${params.jurisdiction} consumer protection laws and applicable federal statutes.`)
      break
    case 'contract_breach':
      notes.push(`Breach of contract claims should reference the contract terms, ${params.jurisdiction} contract law, and available remedies.`)
      break
  }

  return notes.join('\n\n')
}

/**
 * Format research results for inclusion in AI prompt
 */
export function formatResearchForPrompt(research: LegalResearchResult): string {
  const sections: string[] = []

  // Jurisdiction context
  sections.push(`## Jurisdiction: ${research.jurisdiction}`)
  sections.push(research.jurisdictionNotes)
  sections.push('')

  // Relevant statutes
  if (research.relevantStatutes.length > 0) {
    sections.push('## Relevant Statutes')
    for (const statute of research.relevantStatutes) {
      sections.push(`- ${statute.title}`)
      sections.push(`  Citation: ${statute.citation}`)
      if (statute.summary) {
        sections.push(`  Summary: ${statute.summary}`)
      }
    }
    sections.push('')
  }

  // Relevant case law
  if (research.relevantCaseLaw.length > 0) {
    sections.push('## Relevant Case Law')
    for (const caseLaw of research.relevantCaseLaw) {
      sections.push(`- ${caseLaw.title}${caseLaw.year ? ` (${caseLaw.year})` : ''}`)
      sections.push(`  Citation: ${caseLaw.citation}`)
      if (caseLaw.summary) {
        sections.push(`  Summary: ${caseLaw.summary}`)
      }
    }
    sections.push('')
  }

  // Federal law references
  if (research.federalLawReferences.length > 0) {
    sections.push('## Applicable Federal Law')
    for (const ref of research.federalLawReferences) {
      sections.push(`- ${ref}`)
    }
    sections.push('')
  }

  return sections.join('\n')
}

/**
 * Check if legal research is available
 */
export function isLegalResearchAvailable(): boolean {
  return !!(process.env.TAVILY_API_KEY || process.env.BING_SEARCH_API_KEY)
}
