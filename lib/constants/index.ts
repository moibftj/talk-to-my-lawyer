/**
 * Constants barrel export
 *
 * Single entry point for all application constants
 */

// Named re-exports from roles
export {
  USER_ROLES,
  ADMIN_ROLES,
  isAdminRole,
  isSuperAdmin,
  isSubscriber,
  isEmployee,
  getRoleName,
} from "./roles";
export type { UserRole, AdminRole } from "./roles";

// Named re-exports from statuses
export {
  LETTER_STATUSES,
  VALID_LETTER_TRANSITIONS,
  PAYOUT_STATUSES,
  SUBSCRIPTION_STATUSES,
  EXPORT_STATUSES,
  DELETION_STATUSES,
  EMAIL_QUEUE_STATUSES,
  isValidLetterTransition,
  getLetterStatusName,
  getPayoutStatusName,
} from "./statuses";
export type {
  LetterStatus,
  PayoutStatus,
  SubscriptionStatus,
  ExportStatus,
  DeletionStatus,
  EmailQueueStatus,
} from "./statuses";

// Named re-exports from business
export {
  COMMISSION_RATE,
  FREE_TRIAL_LETTERS,
  MAX_FILE_SIZE,
  SUPPORTED_FILE_TYPES,
  LETTER_LIMITS,
  COUPON_LIMITS,
  PAYOUT_LIMITS,
  EXPORT_EXPIRATION_DAYS,
  DELETION_GRACE_PERIOD_DAYS,
  EMAIL_CONFIG,
  RATE_LIMIT_WINDOWS,
} from "./business";
