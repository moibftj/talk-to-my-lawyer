/**
 * Centralized type definitions barrel export
 *
 * This module consolidates all type definitions for the application.
 * Import types from here to ensure consistency across the codebase.
 */

// Re-export database types (source of truth from Supabase)
export type {
  Profile,
  Letter,
  Subscription,
  EmployeeCoupon,
  Commission,
  CouponUsage,
  LetterAuditTrail,
  LetterStatus,
  SubscriptionStatus,
  UserRole,
} from '@/lib/database.types'

// Re-export API types
export type {
  ApiResponse,
  PaginatedResponse,
  RouteContext,
  LetterGenerationRequest,
  AdminReviewRequest,
  AdminReviewResponse,
  AuthUser,
  AdminSession,
  CheckoutRequest,
  CheckoutResponse,
  RateLimitConfig,
  RateLimitResult,
  SupabaseResult,
  SupabaseSuccessResult,
  SupabaseErrorResult,
  ApiHandler,
  ValidationError,
  ValidationResult,
} from './api'

// Re-export letter types
export type {
  LetterType,
  LetterWithProfile,
  LetterUpdateRequest,
  DraftSaveRequest,
  LetterAllowance,
  AdminActionContext,
  LetterGenerationResponse,
} from './letter.types'

// Re-export constants
export { LETTER_STATUSES, USER_ROLES } from './api'

// Re-export type guards
export { isSupabaseError, isSupabaseSuccess } from './api'
