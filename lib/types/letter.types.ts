/**
 * Type definitions for Letter-related entities
 * Centralized types reduce duplication and improve type safety across the app
 */

// Re-export database types (source of truth from Supabase)
export type { Letter, LetterStatus, LetterAuditTrail } from '@/lib/database.types'

// Import for use in this file
import type { LetterStatus } from '@/lib/database.types'

/**
 * Letter type enum - available letter templates
 */
export type LetterType =
  | 'Demand Letter'
  | 'Cease and Desist'
  | 'Legal Notice'
  | 'Consumer Complaint'
  | 'Employment Dispute'
  | 'Landlord-Tenant Issue'
  | 'Contract Dispute'
  | 'Other'

/**
 * Letter with joined user profile data
 */
export interface LetterWithProfile {
  id: string
  user_id: string
  letter_type: LetterType | string | null
  title: string
  status: LetterStatus
  intake_data: Record<string, unknown> | null
  ai_draft_content: string | null
  final_content: string | null
  review_notes: string | null
  rejection_reason: string | null
  draft_metadata: Record<string, unknown> | null
  pdf_url: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  profile?: {
    full_name: string | null
    email: string | null
    company_name: string | null
  }
}

/**
 * Letter update request
 */
export interface LetterUpdateRequest {
  title?: string
  content?: string
  reviewNotes?: string
  finalContent?: string
  rejectionReason?: string
}

/**
 * Draft save request
 */
export interface DraftSaveRequest {
  letterId?: string
  title?: string
  content?: string
  letterType?: LetterType | string
  metadata?: Record<string, unknown>
}

/**
 * Letter allowance check result
 */
export interface LetterAllowance {
  has_allowance: boolean
  remaining: number | null
}

/**
 * Admin action context for letter operations
 */
export interface AdminActionContext {
  adminId: string
  adminEmail?: string
  timestamp: string
}

/**
 * Letter generation response
 */
export interface LetterGenerationResponse {
  success: boolean
  letterId: string
  status: LetterStatus
  isFreeTrial?: boolean
  aiDraft?: string
}
