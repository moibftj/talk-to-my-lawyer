/**
 * Status constants for various entities
 *
 * Centralized status definitions to eliminate magic strings
 */

/**
 * Letter lifecycle statuses
 */
export const LETTER_STATUSES = {
  DRAFT: 'draft',
  GENERATING: 'generating',
  PENDING_REVIEW: 'pending_review',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type LetterStatus = typeof LETTER_STATUSES[keyof typeof LETTER_STATUSES]

/**
 * Valid letter status transitions
 */
export const VALID_LETTER_TRANSITIONS: Record<LetterStatus, LetterStatus[]> = {
  [LETTER_STATUSES.DRAFT]: [LETTER_STATUSES.GENERATING],
  [LETTER_STATUSES.GENERATING]: [
    LETTER_STATUSES.PENDING_REVIEW,
    LETTER_STATUSES.FAILED,
  ],
  [LETTER_STATUSES.PENDING_REVIEW]: [
    LETTER_STATUSES.UNDER_REVIEW,
    LETTER_STATUSES.APPROVED,
    LETTER_STATUSES.REJECTED,
  ],
  [LETTER_STATUSES.UNDER_REVIEW]: [
    LETTER_STATUSES.APPROVED,
    LETTER_STATUSES.REJECTED,
  ],
  [LETTER_STATUSES.APPROVED]: [LETTER_STATUSES.COMPLETED],
  [LETTER_STATUSES.REJECTED]: [LETTER_STATUSES.PENDING_REVIEW], // Can be resubmitted
  [LETTER_STATUSES.COMPLETED]: [],
  [LETTER_STATUSES.FAILED]: [],
}

/**
 * Payout statuses
 */
export const PAYOUT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export type PayoutStatus = typeof PAYOUT_STATUSES[keyof typeof PAYOUT_STATUSES]

/**
 * Subscription statuses
 */
export const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  PAST_DUE: 'past_due',
  UNPAID: 'unpaid',
  INCOMPLETE: 'incomplete',
  INCOMPLETE_EXPIRED: 'incomplete_expired',
  TRIALING: 'trialing',
  PAUSED: 'paused',
} as const

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[keyof typeof SUBSCRIPTION_STATUSES]

/**
 * GDPR export request statuses
 */
export const EXPORT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const

export type ExportStatus = typeof EXPORT_STATUSES[keyof typeof EXPORT_STATUSES]

/**
 * GDPR deletion request statuses
 */
export const DELETION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
} as const

export type DeletionStatus = typeof DELETION_STATUSES[keyof typeof DELETION_STATUSES]

/**
 * Email queue statuses
 */
export const EMAIL_QUEUE_STATUSES = {
  PENDING: 'pending',
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
  RETRYING: 'retrying',
  ABANDONED: 'abandoned',
} as const

export type EmailQueueStatus = typeof EMAIL_QUEUE_STATUSES[keyof typeof EMAIL_QUEUE_STATUSES]

/**
 * Helper to validate letter status transition
 */
export function isValidLetterTransition(
  from: LetterStatus,
  to: LetterStatus
): boolean {
  const allowedTransitions = VALID_LETTER_TRANSITIONS[from]
  return allowedTransitions.includes(to)
}

/**
 * Get human-readable letter status name
 */
export function getLetterStatusName(status: string): string {
  switch (status) {
    case LETTER_STATUSES.DRAFT:
      return 'Draft'
    case LETTER_STATUSES.GENERATING:
      return 'Generating'
    case LETTER_STATUSES.PENDING_REVIEW:
      return 'Pending Review'
    case LETTER_STATUSES.UNDER_REVIEW:
      return 'Under Review'
    case LETTER_STATUSES.APPROVED:
      return 'Approved'
    case LETTER_STATUSES.REJECTED:
      return 'Rejected'
    case LETTER_STATUSES.COMPLETED:
      return 'Completed'
    case LETTER_STATUSES.FAILED:
      return 'Failed'
    default:
      return 'Unknown'
  }
}

/**
 * Get human-readable payout status name
 */
export function getPayoutStatusName(status: string): string {
  switch (status) {
    case PAYOUT_STATUSES.PENDING:
      return 'Pending'
    case PAYOUT_STATUSES.PROCESSING:
      return 'Processing'
    case PAYOUT_STATUSES.PAID:
      return 'Paid'
    case PAYOUT_STATUSES.FAILED:
      return 'Failed'
    case PAYOUT_STATUSES.CANCELLED:
      return 'Cancelled'
    default:
      return 'Unknown'
  }
}
