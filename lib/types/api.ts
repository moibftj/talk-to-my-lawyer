import { NextRequest, NextResponse } from 'next/server'

// Common API Response Types
export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Re-export database types from the source
export type {
  Profile,
  Letter,
  Subscription,
  EmployeeCoupon,
  Commission,
  LetterAuditTrail,
  LetterStatus,
  UserRole
} from '@/lib/database.types'

// Import types for use in this file
import type { LetterStatus, Profile } from '@/lib/database.types'

// Letter Status Types
export const LETTER_STATUSES = [
  'draft',
  'generating',
  'pending_review',
  'under_review',
  'approved',
  'completed',
  'rejected',
  'failed'
] as const satisfies readonly LetterStatus[]

// User Role Types  
export const USER_ROLES = ['subscriber', 'employee', 'admin'] as const

// API Route Handler Types
export interface RouteContext<TParams = Record<string, string>> {
  params: TParams
}

// Letter Generation Types (deprecated - use lib/types/letter.types instead)
// Kept for backward compatibility
export interface LetterGenerationRequest {
  recipientName: string
  recipientAddress: string
  subject: string
  tone: 'formal' | 'friendly' | 'urgent'
  content: string
  additionalDetails?: string
}

// Admin Review Types
export interface AdminReviewRequest {
  adminContent?: string
  notes?: string
  action: 'approve' | 'reject' | 'improve'
}

export interface AdminReviewResponse {
  letterId: string
  status: LetterStatus
  adminContent?: string
  notes?: string
}

// Auth Types
export interface AuthUser {
  id: string
  email?: string
  role?: 'subscriber' | 'employee' | 'admin'
}

export interface AdminSession {
  email: string
  expiresAt: number
}

// Payment Types
export interface CheckoutRequest {
  planId: string
  couponCode?: string
}

export interface CheckoutResponse {
  checkoutUrl: string
  sessionId: string
}

// Rate Limiting Types
export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message?: string
}

export interface RateLimitResult {
  limited: boolean
  resetTime?: number
  remaining?: number
}

// Supabase Query Result Types
export type SupabaseResult<T> = {
  data: T | null
  error: Error | null
}

export type SupabaseSuccessResult<T> = {
  data: T
  error: null
}

export type SupabaseErrorResult = {
  data: null
  error: Error
}

// Type Guards
export function isSupabaseError<T>(result: SupabaseResult<T>): result is SupabaseErrorResult {
  return result.error !== null
}

export function isSupabaseSuccess<T>(result: SupabaseResult<T>): result is SupabaseSuccessResult<T> {
  return result.error === null && result.data !== null
}

// Environment Variable Types (deprecated - use @/lib/config instead)
// Kept for backward compatibility
export interface EnvConfig {
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  OPENAI_API_KEY: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  ADMIN_EMAIL: string
  ADMIN_PASSWORD: string
  ADMIN_PORTAL_KEY: string
  NEXT_PUBLIC_APP_URL?: string
}

// API Handler Types
export type ApiHandler<TRequest = unknown, TResponse = unknown> = (
  request: NextRequest,
  context?: RouteContext
) => Promise<NextResponse<ApiResponse<TResponse>>>

// Validation Types
export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult<T = unknown> {
  isValid: boolean
  data?: T
  errors?: ValidationError[]
}