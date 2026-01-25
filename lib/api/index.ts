/**
 * API module barrel export
 *
 * This file provides a single entry point for all API-related utilities,
 * error handling, and types.
 */

export * from './api-error-handler'
export type {
	ApiResponse,
	ApiError as ApiErrorType,
	PaginatedResponse,
	LoginRequest,
	LoginResponse,
	ResetPasswordRequest,
	UpdatePasswordRequest,
	CreateCheckoutRequest,
	CheckoutSession,
	VerifyPaymentRequest,
	VerifyPaymentResponse,
	BillingHistory,
	LetterDraft,
	GenerateLetterRequest,
	GenerateLetterResponse,
	LetterSubmitRequest,
	LetterReviewAction,
	LetterImproveRequest,
	LetterPdfRequest,
	SendEmailRequest,
	AdminLettersFilters,
	AdminLettersResponse,
	AdminLetterUpdateRequest,
	AdminCouponsRequest,
	AdminCouponCreateRequest,
	AdminCouponResponse,
	EmployeeReferralResponse,
	EmployeePayoutRequest,
	EmployeePayoutResponse,
	GdprAcceptRequest,
	GdprExportRequest,
	GdprDeleteRequest,
	HealthCheckResponse,
	RateLimitStatus,
	EmailQueueItem,
	EmailQueueStatusResponse,
	CsrfTokenResponse,
} from './types'
