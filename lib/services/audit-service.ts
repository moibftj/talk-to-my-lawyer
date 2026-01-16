/**
 * Audit logging service
 *
 * Provides type-safe wrapper around letter audit trail logging
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { LetterStatus } from '@/lib/database.types'

export type LetterAuditAction =
  | 'created'
  | 'updated'
  | 'submitted'
  | 'review_started'
  | 'approved'
  | 'rejected'
  | 'resubmitted'
  | 'completed'
  | 'deleted'
  | 'improved'
  | 'pdf_generated'
  | 'email_sent'
  | 'generation_failed'

export interface LogLetterAuditParams {
  letterId: string
  action: LetterAuditAction
  oldStatus?: LetterStatus | null
  newStatus?: LetterStatus | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Log an audit trail entry for a letter
 *
 * @param supabase - Supabase client
 * @param params - Audit log parameters
 * @throws Error if logging fails
 */
export async function logLetterAudit(
  supabase: SupabaseClient,
  params: LogLetterAuditParams
): Promise<void> {
  const { letterId, action, oldStatus, newStatus, notes, metadata } = params

  const { error } = await supabase.rpc('log_letter_audit', {
    p_letter_id: letterId,
    p_action: action,
    p_old_status: oldStatus || null,
    p_new_status: newStatus || null,
    p_notes: notes || null,
    p_metadata: metadata || null,
  })

  if (error) {
    console.error('[AuditService] Failed to log audit entry:', error)
    throw new Error(`Failed to log audit entry: ${error.message}`)
  }
}

/**
 * Log letter status change with audit trail
 *
 * @param supabase - Supabase client
 * @param letterId - Letter ID
 * @param oldStatus - Previous status
 * @param newStatus - New status
 * @param action - Action that triggered the change
 * @param notes - Optional notes
 */
export async function logLetterStatusChange(
  supabase: SupabaseClient,
  letterId: string,
  oldStatus: LetterStatus,
  newStatus: LetterStatus,
  action: LetterAuditAction,
  notes?: string
): Promise<void> {
  await logLetterAudit(supabase, {
    letterId,
    action,
    oldStatus,
    newStatus,
    notes,
  })
}

/**
 * Log letter action without status change
 *
 * @param supabase - Supabase client
 * @param letterId - Letter ID
 * @param action - Action performed
 * @param notes - Optional notes
 * @param metadata - Optional metadata
 */
export async function logLetterAction(
  supabase: SupabaseClient,
  letterId: string,
  action: LetterAuditAction,
  notes?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logLetterAudit(supabase, {
    letterId,
    action,
    notes,
    metadata,
  })
}
