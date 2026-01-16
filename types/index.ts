/**
 * Root types barrel export for backward compatibility
 *
 * All types are now centralized in lib/types
 * This file re-exports them for existing imports
 */

// Re-export all centralized types
export type {
  // Database types
  Commission,
  CouponUsage,
  EmployeeCoupon,
  Letter,
  LetterStatus,
  LetterAuditTrail,
  Profile,
  Subscription,
  SubscriptionStatus,
  UserRole,

  // API types
  ApiResponse,
  PaginatedResponse,
  RouteContext,
  LetterGenerationRequest,
  LetterGenerationResponse,
  AdminReviewRequest,
  AdminReviewResponse,
  AuthUser,
  AdminSession,
  CheckoutRequest,
  CheckoutResponse,

  // Letter types
  LetterType,
  LetterWithProfile,
  LetterUpdateRequest,
  DraftSaveRequest,
  LetterAllowance,
  AdminActionContext,

  // Validation types
  ValidationError,
  ValidationResult,

  // Supabase types
  SupabaseResult,
  SupabaseSuccessResult,
  SupabaseErrorResult,
} from '@/lib/types'

// Re-export constants
export { LETTER_STATUSES, USER_ROLES } from '@/lib/types'

// Re-export type guards
export { isSupabaseError, isSupabaseSuccess } from '@/lib/types'

// Search params for letters page (app-specific, not moved)
export interface LettersSearchParams {
  status?: string
  search?: string
  page?: string
  limit?: string
}

// Plan types (app-specific UI type, not moved)
export interface Plan {
  id: string
  name: string
  price: number
  credits: number
  description: string
  features: string[]
  popular?: boolean
}
