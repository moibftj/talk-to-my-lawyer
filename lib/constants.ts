export const DEFAULT_LOGO_SRC = '/talk-to-my-lawyer-logo.svg'
export const DEFAULT_LOGO_ALT = 'Talk-To-My-Lawyer logo'

/**
 * Time conversion constants for readability
 */
export const TIME_CONSTANTS = {
  SECONDS_PER_MINUTE: 60,
  SECONDS_PER_HOUR: 3600,
  SECONDS_PER_DAY: 86400,
  SECONDS_PER_WEEK: 604800,
  MILLISECONDS_PER_SECOND: 1000,
} as const

/**
 * Letter type definitions used across the application
 */
export const LETTER_TYPES = [
  { value: 'demand_letter', label: 'Demand Letter', price: 200 },
  { value: 'cease_desist', label: 'Cease & Desist', price: 200 },
  { value: 'contract_breach', label: 'Contract Breach Notice', price: 200 },
  { value: 'eviction_notice', label: 'Eviction Notice', price: 200 },
  { value: 'employment_dispute', label: 'Employment Dispute', price: 200 },
  { value: 'consumer_complaint', label: 'Consumer Complaint', price: 200 },
] as const

/**
 * Subscription plan configurations
 * - Single Letter: $200 one-time
 * - Monthly Membership: $200/month, then $50 per letter
 * - Annual Plan: $2,000 one-time, includes 48 letters (≈$41.67/letter)
 */
export const SUBSCRIPTION_PLANS = [
  { letters: 1, price: 200, planType: 'one_time', popular: false, name: 'Single Letter' },
  { letters: 0, price: 200, planType: 'monthly_membership', popular: true, name: 'Monthly Membership', perLetterPrice: 50 },
  { letters: 48, price: 2000, planType: 'annual', popular: false, name: 'Annual Plan' },
] as const

/**
 * Plan configuration lookup by plan type
 */
export const PLAN_CONFIG: Record<string, { price: number, letters: number, planType: string, name: string, perLetterPrice?: number }> = {
  'one_time': { price: 200, letters: 1, planType: 'one_time', name: 'Single Letter' },
  'monthly_membership': { price: 200, letters: 0, planType: 'monthly_membership', name: 'Monthly Membership', perLetterPrice: 50 },
  'annual': { price: 2000, letters: 48, planType: 'annual', name: 'Annual Plan' }
} as const
