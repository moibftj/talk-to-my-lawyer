/**
 * Business logic constants
 *
 * Centralized business rules and configuration values
 */

/**
 * Commission rate for employee referrals (5%)
 */
export const COMMISSION_RATE = 0.05

/**
 * Free trial letter allowance
 */
export const FREE_TRIAL_LETTERS = 1

/**
 * Maximum file upload size (bytes)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Supported file types for uploads
 */
export const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
] as const

/**
 * Letter generation limits
 */
export const LETTER_LIMITS = {
  MIN_LENGTH: 100,
  MAX_LENGTH: 5000,
  MAX_TITLE_LENGTH: 200,
} as const

/**
 * Coupon limits
 */
export const COUPON_LIMITS = {
  MIN_DISCOUNT_PERCENT: 1,
  MAX_DISCOUNT_PERCENT: 100,
  MIN_CODE_LENGTH: 3,
  MAX_CODE_LENGTH: 50,
} as const

/**
 * Payout limits
 */
export const PAYOUT_LIMITS = {
  MIN_AMOUNT: 10, // $10 minimum payout
  MAX_AMOUNT: 10000, // $10,000 maximum payout
} as const

/**
 * Data export expiration (days)
 */
export const EXPORT_EXPIRATION_DAYS = 7

/**
 * Account deletion grace period (days)
 */
export const DELETION_GRACE_PERIOD_DAYS = 30

/**
 * Email retry configuration
 */
export const EMAIL_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  ABANDON_AFTER_HOURS: 24,
} as const

/**
 * Rate limit windows
 */
export const RATE_LIMIT_WINDOWS = {
  PER_MINUTE: '1 m',
  PER_HOUR: '1 h',
  PER_DAY: '1 d',
} as const
