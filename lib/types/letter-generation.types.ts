/**
 * Letter Generation Types
 *
 * Type definitions for the enhanced letter generation system
 * with multi-step pipeline and research integration.
 */

import { LegalResearchResult } from '@/lib/services/legal-research-service'

// ============================================================================
// Core Generation Types
// ============================================================================

/**
 * Enhanced context for letter generation with geographic and research data
 */
export interface EnhancedLetterContext {
  letterType: string
  intakeData: Record<string, unknown>
  jurisdiction: string // Full state name (e.g., "California")
  jurisdictionCode: string // 2-letter code (e.g., "CA")
  research?: LegalResearchResult
}

/**
 * Letter outline structure for multi-step generation
 */
export interface LetterOutline {
  introduction: string
  factsSection: string[]
  legalBasis: string[]
  demands: string[]
  consequences: string[]
  conclusion: string
}

/**
 * Legal citation in Bluebook format
 */
export interface LegalCitation {
  type: 'statute' | 'case' | 'regulation' | 'other'
  text: string // Formatted citation string
  url?: string
}

/**
 * Metadata about the generation process
 */
export interface GenerationMetadata {
  model: string
  attempts: number
  duration: number
  researchUsed: boolean
  researchDuration?: number
  outlineGenerated: boolean
  generationMethod: 'single_shot' | 'multi_step'
  timestamp: Date
}

/**
 * Result of the enhanced letter generation process
 */
export interface EnhancedLetterResult {
  content: string
  research?: LegalResearchResult
  outline?: LetterOutline
  citations: LegalCitation[]
  metadata: GenerationMetadata
}

// ============================================================================
// Research Types (re-exported for convenience)
// ============================================================================

export type { Statute, CaseLaw, LegalResearchResult, LegalResearchParams } from '@/lib/services/legal-research-service'

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of letter quality validation
 */
export interface QualityValidationResult {
  isValid: boolean
  score: number // 0-100
  checks: {
    hasProperFormat: boolean
    hasJurisdictionReferences: boolean
    hasLegalCitations: boolean
    hasClearDemands: boolean
    hasProfessionalTone: boolean
    hasAppropriateLength: boolean
    hasDeadline: boolean
    hasConsequences: boolean
  }
  suggestions: string[]
}

/**
 * Letter generation options
 */
export interface LetterGenerationOptions {
  skipResearch?: boolean // Skip research step for faster generation
  useMultiStep?: boolean // Use multi-step generation process
  maxTokens?: number // Maximum tokens for generation
  temperature?: number // AI temperature (0-1)
  model?: string // AI model to use
}

// ============================================================================
// Court Types
// ============================================================================

export type CourtType =
  | 'state_court'
  | 'federal_court'
  | 'small_claims'
  | 'superior_court'
  | 'municipal_court'
  | 'district_court'
  | 'circuit_court'

// ============================================================================
// Letter Types
// ============================================================================

export type LetterType =
  | 'demand_letter'
  | 'cease_desist'
  | 'contract_breach'
  | 'eviction_notice'
  | 'employment_dispute'
  | 'consumer_complaint'

// ============================================================================
// Letter Status Types (from database)
// ============================================================================

export type LetterStatus =
  | 'draft'
  | 'generating'
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed'
