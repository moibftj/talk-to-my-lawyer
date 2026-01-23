/**
 * Enhanced Letter Generation Prompts
 *
 * Professional, jurisdiction-aware prompts for generating high-quality legal letters.
 * Each letter type has a specialized system prompt and research-aware generation template.
 */

import { LegalResearchResult } from '@/lib/services/legal-research-service'
import { getStateName } from '@/lib/validation/letter-schema'

// ============================================================================
// Types
// ============================================================================

export interface LetterPromptContext {
  letterType: string
  senderName: string
  senderAddress: string
  senderState: string
  senderCountry?: string
  senderEmail?: string
  senderPhone?: string
  recipientName: string
  recipientAddress: string
  recipientState: string
  recipientCountry?: string
  recipientEmail?: string
  recipientPhone?: string
  courtType?: string
  issueDescription: string
  desiredOutcome: string
  amountDemanded?: number
  deadlineDate?: string
  incidentDate?: string
  additionalDetails?: string
  research?: LegalResearchResult
}

export interface LetterOutline {
  introduction: string
  factsSection: string[]
  legalBasis: string[]
  demands: string[]
  consequences: string[]
  conclusion: string
}

// ============================================================================
// System Prompts by Letter Type
// ============================================================================

const SYSTEM_PROMPTS: Record<string, string> = {
  demand_letter: `You are an experienced attorney specializing in demand letters and debt recovery. You have 15+ years of experience drafting formal demand letters that comply with all state and federal laws, including the Fair Debt Collection Practices Act (FDCPA) when applicable.

Your expertise includes:
- State-specific debt collection laws and statutes of limitation
- Professional yet firm tone that preserves legal options
- Clear articulation of damages and payment demands
- Proper documentation of amounts owed
- Compliance with consumer protection laws

Core Principles:
1. FACT-BASED: Only state facts provided by the client
2. JURISDICTION-AWARE: Reference applicable state laws specifically
3. PROFESSIONAL TONE: Firm but respectful, avoiding harassment
4. CLEAR DEMANDS: Specific amounts and deadlines
5. LEGAL COMPLIANCE: Adhere to all applicable federal and state laws
6. PROPER CITATIONS: Use Bluebook format for legal references

Format: Standard business letter format with date, recipient address, salutation, body, and professional closing.`,

  cease_desist: `You are an intellectual property and civil rights attorney specializing in cease and desist letters. You have extensive experience drafting letters that protect clients' rights while maintaining legal defensibility.

Your expertise includes:
- Intellectual property law (trademark, copyright, patent)
- Defamation, libel, and slander law
- Harassment and restraining order procedures
- Contract violations and tortious interference
- State-specific civil procedure requirements

Core Principles:
1. CLEAR VIOLATION: Specifically identify the unlawful conduct
2. LEGAL BASIS: Cite specific statutes or case law supporting the claim
3. DEMAND ACTION: Clearly state what must cease and desist
4. DEADLINE: Provide reasonable time for compliance
5. CONSEQUENCES: Explain potential legal action if non-compliant
6. PRESERVE RIGHTS: Maintain all legal options and defenses

Format: Formal legal letter with proper citation of violated laws/regulations.`,

  contract_breach: `You are a commercial litigation attorney specializing in breach of contract matters. You have significant experience reviewing contracts and drafting demand letters that articulate clear breach claims.

Your expertise includes:
- Contract interpretation and performance requirements
- Material vs. minor breach distinctions
- Damages calculation and recovery options
- State contract law variations
- Alternative dispute resolution considerations

Core Principles:
1. CONTRACT REFERENCE: Identify the specific contract provisions breached
2. BREACH DETAILS: Clearly articulate how the breach occurred
3. DAMAGES: Specify actual and consequential damages
4. CURE PERIOD: Provide reasonable opportunity to cure if appropriate
5. GOOD FAITH: Maintain position of acting in good faith
6. SETTLEMENT FOCUS: Leave room for negotiated resolution

Format: Structured legal letter with contract references and legal citations.`,

  eviction_notice: `You are a landlord-tenant attorney specializing in eviction proceedings and notices. You thoroughly understand the complex notice requirements across different jurisdictions.

Your expertise includes:
- State-specific notice requirements and periods
- Lease agreement interpretation
- Grounds for eviction (non-payment, lease violation, holdover)
- Required legal language and formatting
- Avoiding illegal self-help eviction practices

Core Principles:
1. LEGAL GROUNDS: Clearly state the specific basis for eviction
2. NOTICE COMPLIANCE: Include all statutorily required language
3. CURE PERIOD: Specify time to remedy (if required by law)
4. DOCUMENTATION: Reference lease provisions and violations
5. DEADLINE: Clear vacate date or cure deadline
6. NEXT STEPS: Explain legal process if non-compliant

WARNING: Eviction notices have strict legal requirements. Include all required statutory language.`,

  employment_dispute: `You are an employment law attorney representing employees in workplace disputes. You understand federal and state employment laws including anti-discrimination statutes, wage laws, and workplace protections.

Your expertise includes:
- Title VII, ADA, ADEA, and FLSA compliance
- State anti-discrimination and wage laws
- Wrongful termination and retaliation claims
- Severance negotiation strategies
- EEOC and state agency procedures

Core Principles:
1. PROTECTED STATUS: Identify protected class if applicable
2. VIOLATION FACTS: Clearly state discriminatory or unlawful conduct
3. DAMAGES: Specify lost wages, emotional distress, other damages
4. AGENCY OPTIONS: Explain EEOC/state agency filing options
5. SETTLEMENT OPENING: Professional invitation to resolve
6. DOCUMENTATION: Reference key emails, documents, or witnesses

Format: Professional legal letter suitable for employer or HR review.`,

  consumer_complaint: `You are a consumer protection attorney helping clients resolve disputes with businesses. You understand federal and state consumer protection laws and effective complaint strategies.

Your expertise includes:
- Federal consumer protection laws (FTC Act, FCRA, TILA, etc.)
- State consumer protection statutes
- Attorney general referral processes
- BBB and regulatory agency complaints
- Small claims court procedures

Core Principles:
1. SPECIFIC HARM: Clearly describe the consumer harm
2. VIOLATED LAWS: Cite specific consumer protection statutes
3. DEMANDED RELIEF: Specify refund, repair, or other remedy sought
3. DEADLINE: Provide reasonable response timeframe
4. ESCALATION: Mention regulatory escalation options
5. PROFESSIONAL: Business-appropriate tone

Format: Formal business letter suitable for corporate legal departments.`
}

/**
 * Get the system prompt for a specific letter type
 */
export function getSystemPrompt(letterType: string): string {
  return SYSTEM_PROMPTS[letterType] || getDefaultSystemPrompt()
}

/**
 * Default system prompt for unknown letter types
 */
function getDefaultSystemPrompt(): string {
  return `You are a professional attorney drafting formal legal correspondence. You have extensive experience in legal writing and maintain high standards of professionalism, accuracy, and ethical practice.

Core Principles:
1. FACT-BASED: Only include facts provided by the client
2. LEGAL ACCURACY: Reference applicable laws accurately
3. PROFESSIONAL TONE: Formal, respectful, and clear
4. CLEAR COMMUNICATION: Articulate positions and demands precisely
5. ETHICAL PRACTICE: Maintain all professional obligations
6. PROPER FORMAT: Standard legal letter structure`
}

// ============================================================================
// Research-Aware Prompt Generation
// ============================================================================

/**
 * Build the full user prompt with research integration
 */
export function buildLetterPromptWithContext(context: LetterPromptContext): string {
  const sections: string[] = []

  // Letter type and jurisdiction header
  const recipientStateName = getStateName(context.recipientState) || context.recipientState
  sections.push(`## Letter Type: ${context.letterType.replace(/_/g, ' ').toUpperCase()}`)
  sections.push(`## Jurisdiction: ${recipientStateName}`)
  sections.push('')

  // Legal research if available
  if (context.research) {
    sections.push('## Legal Research')
    sections.push(formatResearchForPrompt(context.research))
    sections.push('')
  }

  // Sender information
  sections.push('## Sender Information')
  sections.push(`Name: ${context.senderName}`)
  sections.push(`Address: ${context.senderAddress}`)
  sections.push(`State: ${getStateName(context.senderState) || context.senderState}`)
  if (context.senderCountry && context.senderCountry !== 'US') {
    sections.push(`Country: ${context.senderCountry}`)
  }
  if (context.senderEmail) sections.push(`Email: ${context.senderEmail}`)
  if (context.senderPhone) sections.push(`Phone: ${context.senderPhone}`)
  sections.push('')

  // Recipient information
  sections.push('## Recipient Information')
  sections.push(`Name: ${context.recipientName}`)
  sections.push(`Address: ${context.recipientAddress}`)
  sections.push(`State: ${recipientStateName}`)
  if (context.recipientCountry && context.recipientCountry !== 'US') {
    sections.push(`Country: ${context.recipientCountry}`)
  }
  if (context.recipientEmail) sections.push(`Email: ${context.recipientEmail}`)
  if (context.recipientPhone) sections.push(`Phone: ${context.recipientPhone}`)
  if (context.courtType) sections.push(`Court Type: ${context.courtType}`)
  sections.push('')

  // Case details
  sections.push('## Case Details')
  sections.push(`### Issue Description`)
  sections.push(context.issueDescription)
  sections.push('')

  sections.push(`### Desired Outcome`)
  sections.push(context.desiredOutcome)
  sections.push('')

  if (context.amountDemanded) {
    sections.push(`### Amount Demanded`)
    sections.push(`$${context.amountDemanded.toLocaleString()}`)
    sections.push('')
  }

  if (context.deadlineDate) {
    sections.push(`### Deadline`)
    sections.push(context.deadlineDate)
    sections.push('')
  }

  if (context.incidentDate) {
    sections.push(`### Incident Date`)
    sections.push(context.incidentDate)
    sections.push('')
  }

  if (context.additionalDetails) {
    sections.push(`### Additional Details`)
    sections.push(context.additionalDetails)
    sections.push('')
  }

  // Letter requirements
  sections.push('## Requirements')
  sections.push(`Generate a professional ${context.letterType.replace(/_/g, ' ')} letter that:`)

  const requirements = getLetterRequirements(context.letterType)
  sections.push(requirements.map(r => `- ${r}`).join('\n'))

  sections.push('')
  sections.push('**IMPORTANT**: Return only the letter content with no explanations or commentary. The letter should be ready for attorney review.')

  return sections.join('\n')
}

/**
 * Get letter-specific requirements
 */
function getLetterRequirements(letterType: string): string[] {
  const baseRequirements = [
    'Uses proper formal letter format with date, addresses, and salutation',
    'Maintains a professional, legally appropriate tone throughout',
    'Presents facts clearly and objectively',
    'States demands or requests with clarity and specificity',
    'Includes appropriate deadline for response or action',
    'References applicable laws based on the provided research',
    'Concludes with professional closing and signature block',
    'Is approximately 400-600 words for thoroughness',
  ]

  const typeSpecific: Record<string, string[]> = {
    demand_letter: [
      'Clearly states the amount owed with calculation breakdown',
      'References applicable state debt collection statutes',
      'Provides specific payment deadline and methods',
      'Mentions potential legal action if non-compliant',
      'Avoids language that violates debt collection laws',
    ],
    cease_desist: [
      'Identifies the specific unlawful conduct with clarity',
      'Cites specific statutes or rights being violated',
      'Demands immediate cessation of the unlawful activity',
      'Specifies consequences for continued violations',
      'Preserves all legal rights and remedies',
    ],
    contract_breach: [
      'Identifies the specific contract provisions breached',
      'Describes how the breach occurred with factual detail',
      'Quantifies damages resulting from the breach',
      'Provides cure period if legally appropriate',
      'References applicable state contract law principles',
    ],
    eviction_notice: [
      'Identifies the specific lease provision violated',
      'Includes all statutorily required language and notices',
      'Specifies cure period or vacate date as required by law',
      'References state landlord-tenant statutes',
      'Avoids illegal self-help eviction language',
    ],
    employment_dispute: [
      'Identifies protected class if applicable',
      'References specific federal/state employment laws violated',
      'Documents specific discriminatory or unlawful actions',
      'Quantifies damages (back pay, emotional distress, etc.)',
      'Mentions agency complaint filing options if appropriate',
    ],
    consumer_complaint: [
      'Describes the specific product/service failure',
      'Cites applicable consumer protection statutes',
      'Specifies requested remedy (refund, repair, replacement)',
      'Mentions regulatory escalation options',
      'Includes documentation reference if applicable',
    ],
  }

  return [...baseRequirements, ...(typeSpecific[letterType] || [])]
}

// ============================================================================
// Outline Generation Prompts
// ============================================================================

/**
 * Create a structured outline for the letter before full generation
 */
export async function createLetterOutline(context: LetterPromptContext): Promise<LetterOutline> {
  const recipientStateName = getStateName(context.recipientState) || context.recipientState

  return {
    introduction: `Formal introduction identifying the sender (${context.senderName}) and the purpose of the ${context.letterType.replace(/_/g, ' ')} letter to ${context.recipientName}.`,

    factsSection: [
      `The sender is located in ${getStateName(context.senderState) || context.senderState}`,
      `The recipient is located in ${recipientStateName}`,
      `Issue: ${context.issueDescription.substring(0, 200)}...`,
      context.incidentDate ? `Incident occurred on ${context.incidentDate}` : null,
      context.additionalDetails ? `Additional context available` : null,
    ].filter(Boolean),

    legalBasis: [
      `Applicable ${recipientStateName} state law`,
      ...(context.research?.relevantStatutes.map(s => s.citation) || []),
      ...(context.research?.federalLawReferences || []),
    ].filter(Boolean),

    demands: [
      context.desiredOutcome,
      context.amountDemanded ? `Payment of $${context.amountDemanded.toLocaleString()}` : null,
      context.deadlineDate ? `Response by ${context.deadlineDate}` : 'Response within 14 business days',
    ].filter(Boolean),

    consequences: [
      'Further legal action may be taken if demands are not met',
      'Availability of alternative dispute resolution',
      'Preservation of all legal rights and remedies',
    ],

    conclusion: `Professional closing indicating expectation of prompt response and willingness to discuss further.`,
  }
}

/**
 * Format outline for AI prompt
 */
export function formatOutlineForPrompt(outline: LetterOutline): string {
  const sections: string[] = ['## Letter Outline', '']

  sections.push('### Introduction')
  sections.push(outline.introduction)
  sections.push('')

  sections.push('### Facts to Present')
  outline.factsSection.forEach(fact => sections.push(`- ${fact}`))
  sections.push('')

  sections.push('### Legal Basis')
  outline.legalBasis.forEach(basis => sections.push(`- ${basis}`))
  sections.push('')

  sections.push('### Demands')
  outline.demands.forEach(demand => sections.push(`- ${demand}`))
  sections.push('')

  sections.push('### Potential Consequences')
  outline.consequences.forEach(conseq => sections.push(`- ${conseq}`))
  sections.push('')

  sections.push('### Conclusion Approach')
  sections.push(outline.conclusion)

  return sections.join('\n')
}

// ============================================================================
// Research Formatting
// ============================================================================

/**
 * Format research results for inclusion in prompt
 */
function formatResearchForPrompt(research: LegalResearchResult): string {
  const sections: string[] = []

  if (research.relevantStatutes.length > 0) {
    sections.push('### Relevant Statutes')
    for (const statute of research.relevantStatutes.slice(0, 3)) {
      sections.push(`**${statute.title}**`)
      sections.push(`Citation: ${statute.citation}`)
      if (statute.summary) {
        sections.push(`> ${statute.summary}`)
      }
      sections.push('')
    }
  }

  if (research.relevantCaseLaw.length > 0) {
    sections.push('### Relevant Case Law')
    for (const caseLaw of research.relevantCaseLaw.slice(0, 2)) {
      sections.push(`**${caseLaw.title}**${caseLaw.year ? ` (${caseLaw.year})` : ''}`)
      sections.push(`Citation: ${caseLaw.citation}`)
      if (caseLaw.summary) {
        sections.push(`> ${caseLaw.summary}`)
      }
      sections.push('')
    }
  }

  if (research.federalLawReferences.length > 0) {
    sections.push('### Federal Law References')
    research.federalLawReferences.forEach(ref => {
      sections.push(`- ${ref}`)
    })
    sections.push('')
  }

  return sections.join('\n')
}

// ============================================================================
// Jurisdiction-Specific Guidance
// ============================================================================

/**
 * Get jurisdiction-specific legal guidance
 */
export function getJurisdictionGuidance(stateCode: string): string {
  const guidance: Record<string, string> = {
    CA: 'California law requires specific notice periods for many legal actions. Consider California Civil Code provisions and the California Consumer Protection Act.',
    TX: 'Texas law generally favors more limited notice periods. Consider Texas Property Code for landlord-tenant matters and Texas Business & Commerce Code for commercial disputes.',
    NY: 'New York has strict requirements for certain notices. Consider New York General Obligations Law and specific statutory requirements.',
    FL: 'Florida law has specific consumer protection provisions. Consider Florida Deceptive and Unfair Trade Practices Act (FDUTPA).',
    IL: 'Illinois has robust consumer protection. Consider Illinois Consumer Fraud and Deceptive Business Practices Act.',
    // Add more states as needed
  }

  return guidance[stateCode] || 'Be sure to reference applicable state statutes and regulations specific to this jurisdiction.'
}

// ============================================================================
// Letter Quality Checklist
// ============================================================================

export interface LetterQualityChecklist {
  hasProperFormat: boolean
  hasJurisdictionReferences: boolean
  hasLegalCitations: boolean
  hasClearDemands: boolean
  hasProfessionalTone: boolean
  hasAppropriateLength: boolean
  hasDeadline: boolean
  hasConsequences: boolean
}

/**
 * Generate quality checklist for attorney review
 */
export function generateQualityChecklist(content: string, context: LetterPromptContext): LetterQualityChecklist {
  const wordCount = content.split(/\s+/).length

  return {
    hasProperFormat: content.includes('Dear') && (content.includes('Sincerely') || content.includes('Respectfully')),
    hasJurisdictionReferences: content.includes(context.recipientState) || content.includes(getStateName(context.recipientState) || ''),
    hasLegalCitations: /\(\d{4}\)/.test(content) || /§\s*\d+/.test(content) || /v\./.test(content),
    hasClearDemands: content.toLowerCase().includes('demand') || content.toLowerCase().includes('request') || content.toLowerCase().includes('require'),
    hasProfessionalTone: !/!!!!/.test(content), // Avoid excessive exclamation marks
    hasAppropriateLength: wordCount >= 300 && wordCount <= 800,
    hasDeadline: /\d+\s*(day|week|business day)/i.test(content) || /by:\s*\w+/i.test(content),
    hasConsequences: /court|legal action|attorney|lawsuit/i.test(content),
  }
}
