/**
 * Letter allowance and eligibility checking service
 * Extracts complex business logic for cleaner API routes
 */

import { createClient } from '@/lib/supabase/server'
import type { LetterAllowance } from '@/lib/types/letter.types'

/**
 * Check letter allowance from database
 */
export async function checkLetterAllowance(userId: string): Promise<LetterAllowance> {
  const supabase = await createClient()

  const { data } = await supabase.rpc('check_letter_allowance', {
    u_id: userId,
  })

  return {
    has_allowance: data?.has_access ?? false,
    remaining: data?.letters_remaining ?? 0,
  }
}

/**
 * Result of atomic check and deduct operation
 */
export interface AtomicDeductionResult {
  success: boolean
  remaining: number | null
  errorMessage: string | null
  isFreeTrial: boolean
  isSuperAdmin: boolean
}

/**
 * Atomically check eligibility AND deduct letter allowance in a single operation.
 * This prevents race conditions where concurrent requests could pass the check
 * and all deduct, resulting in over-generation.
 *
 * Uses the database-level SELECT FOR UPDATE lock to ensure atomicity.
 */
export async function checkAndDeductAllowance(userId: string): Promise<AtomicDeductionResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('check_and_deduct_allowance', {
    u_id: userId,
  })

  if (error) {
    console.error('[Allowance] check_and_deduct_allowance RPC failed:', error)
    return {
      success: false,
      remaining: null,
      errorMessage: error.message,
      isFreeTrial: false,
      isSuperAdmin: false,
    }
  }

  // The RPC returns a single row with the results
  if (!data || data.length === 0) {
    return {
      success: false,
      remaining: null,
      errorMessage: 'Failed to check allowance',
      isFreeTrial: false,
      isSuperAdmin: false,
    }
  }

  const result = Array.isArray(data) ? data[0] : data

  return {
    success: result.success as boolean,
    remaining: result.remaining as number | null,
    errorMessage: result.error_message as string | null,
    isFreeTrial: result.is_free_trial as boolean,
    isSuperAdmin: result.is_super_admin as boolean,
  }
}

/**
 * Refund letter allowance (e.g., after failed generation)
 * Uses atomic database operation
 */
export async function refundLetterAllowance(
  userId: string,
  amount: number = 1
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('refund_letter_allowance', {
    u_id: userId,
    amount,
  })

  if (error) {
    console.error('[Allowance] refund_letter_allowance RPC failed:', error)
    return {
      success: false,
      error: error.message,
    }
  }

  // The RPC returns a table with success and error_message
  const result = Array.isArray(data) ? data[0] : data

  if (!result || !result.success) {
    return {
      success: false,
      error: result?.error_message || 'Refund failed',
    }
  }

  return { success: true }
}
