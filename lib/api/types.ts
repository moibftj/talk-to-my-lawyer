/**
 * Centralized API request and response type definitions
 *
 * This file provides TypeScript types for all API endpoints to ensure
 * type safety across the application and enable better IDE support.
 */

// ============================================================================
// Base Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  error: string
  details?: string
  code?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ============================================================================
// Auth Types
// ============================================================================

export interface LoginRequest {
  email: string
  password: string
  adminPortalKey?: string
}

export interface LoginResponse {
  user: {
    id: string
    email: string
    role: string
  }
  redirectPath?: string
}

export interface ResetPasswordRequest {
  email: string
}

export interface UpdatePasswordRequest {
  password: string
  token: string
}

// ============================================================================
// Checkout & Billing Types
// ============================================================================

export interface CreateCheckoutRequest {
  planType: 'basic' | 'professional' | 'enterprise'
  couponCode?: string
}

export interface CheckoutSession {
  sessionId: string
  url: string
}

export interface VerifyPaymentRequest {
  sessionId: string
}

export interface VerifyPaymentResponse {
  success: true
  subscriptionId: string
  letters: number
  message: string
}

export interface BillingHistory {
  id: string
  created_at: string
  amount: number
  status: string
  plan_type: string
  stripe_session_id?: string
}

// ============================================================================
// Letter Types
// ============================================================================

export interface LetterDraft {
  id?: string
  title: string
  content: string
  recipient_name?: string
  recipient_address?: string
  sender_role?: string
  category?: string
}

export interface GenerateLetterRequest {
  title: string
  recipient_name: string
  recipient_address: string
  sender_role: string
  category: string
  tone: string
  key_points: string[]
  additional_context?: string
}

export interface GenerateLetterResponse {
  success: true
  letterId: string
  allowance?: {
    remaining: number
    total: number
  }
}

export interface LetterSubmitRequest {
  letterId: string
}

export interface LetterReviewAction {
  action: 'approve' | 'reject' | 'mark_completed'
  finalContent?: string
  reviewNotes?: string
  rejectionReason?: string
}

export interface LetterImproveRequest {
  letterId: string
  improvements: string
}

export interface LetterPdfRequest {
  letterId: string
  includeAuditLog?: boolean
}

export interface SendEmailRequest {
  letterId: string
  recipientEmail?: string
  subject?: string
  message?: string
}

// ============================================================================
// Admin Types
// ============================================================================

export interface AdminLettersFilters {
  status?: string
  limit?: number
  offset?: number
}

export interface AdminLetterUpdateRequest {
  letterId: string
  action: string
  finalContent?: string
  reviewNotes?: string
  rejectionReason?: string
}

export interface BatchLetterUpdateRequest {
  letterIds: string[]
  action: 'approve' | 'reject' | 'delete'
  reason?: string
}

export interface CreateCouponRequest {
  code?: string
  discountPercent: number
  maxUses?: number
  expiresAt?: string
  description?: string
}

export interface CouponStats {
  code: string
  discount_percent: number
  usage_count: number
  max_uses: number | null
  is_active: boolean
  created_at: string
  expires_at: string | null
}

export interface AdminAnalytics {
  letters: {
    total: number
    pending: number
    completed: number
    rejected: number
  }
  revenue: {
    total: number
    thisMonth: number
  }
  users: {
    total: number
    active: number
  }
}

// ============================================================================
// Employee Types
// ============================================================================

export interface EmployeeReferralLink {
  couponCode: string
  referralLink: string
  shareLink: string
  qrCodeUrl?: string
}

export interface EmployeePayoutStats {
  totalEarnings: number
  pendingPayouts: number
  completedPayouts: number
  conversionCount: number
}

export interface RequestPayoutRequest {
  amount: number
  paymentMethod: 'stripe' | 'paypal'
  paymentDetails: {
    email?: string
    accountId?: string
  }
}

// ============================================================================
// GDPR Types
// ============================================================================

export interface AcceptPrivacyPolicyRequest {
  version: string
  consents: {
    marketing: boolean
    analytics: boolean
    cookies: boolean
  }
}

export interface ExportDataRequest {
  format?: 'json' | 'csv'
}

export interface ExportDataResponse {
  exportId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  downloadUrl?: string
  expiresAt?: string
}

export interface DeleteAccountRequest {
  reason?: string
  password: string
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, HealthCheck>
  timestamp: string
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy'
  latency?: number
  error?: string
}

// ============================================================================
// Rate Limit Types
// ============================================================================

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: Date
}

export interface RateLimitResponse {
  error: 'Rate limit exceeded'
  retryAfter: number
  limit: number
}

// ============================================================================
// Email Queue Types
// ============================================================================

export interface EmailQueueItem {
  id: string
  to: string
  subject: string
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  created_at: string
}

export interface EmailQueueStats {
  pending: number
  sent: number
  failed: number
  total: number
}

// ============================================================================
// CSFR Types
// ============================================================================

export interface CsrfTokenResponse {
  token: string
  expiresAt: string
}
