# System Review Overview

## Authentication and User Provisioning
- **Profile creation**: `app/api/create-profile/route.ts` ensures authenticated Supabase users create profiles with rate limiting, role validation, and an optional employee coupon bootstrap; it uses service-role access for writes and sends a welcome email asynchronously.
- **Admin login**: `app/api/admin-auth/login/route.ts` validates portal configuration, applies Redis-backed rate limiting, verifies credentials plus portal key, then issues an admin session token, logging both failed and successful attempts.

### Cross-cutting safety layers
- **Shared rate limiting**: The authenticated API surface reuses the centralized helpers in `@/lib/rate-limit-redis` (or the in-memory `@/lib/rate-limit` fallback for profile creation) via `safeApplyRateLimit`, keeping Upstash-backed throttling and fallback behavior consistent. Per-endpoint limiters (`authRateLimit`, `adminRateLimit`, `letterGenerationRateLimit`, `subscriptionRateLimit`) are defined once and reused to keep thresholds and headers uniform.
- **Consistent auth helpers**: Authentication flows consistently call either `authenticateUser` (for customer-facing routes) or `createClient`/`createServerClient` + `supabase.auth.getUser()` for token validation, keeping session and role checks centralized.
- **Error handling patterns**: API routes wrap handlers in `try/catch`, return structured `NextResponse.json` payloads with explicit status codes, and log server-side failures with scoped tags (e.g., `[GenerateLetter]`, `[Checkout]`, `[AdminAuth]`). Validation failures return 4xx with details, while unexpected exceptions fall back to 500 responses without leaking sensitive data.

## Letter Workflow
- **Generation**: `app/api/generate-letter/route.ts` applies per-IP rate limits, validates Supabase auth and subscriber role, checks allowances/free-trial status, deducts credits upfront, writes a `letters` row in "generating" status, invokes OpenAI via retry wrapper, updates content/status to `pending_review`, increments totals, and logs audit entries; failures roll back allowances and mark the letter as `failed` with audit logging.
- **Admin review**: `app/api/letters/[id]/approve/route.ts` exposes a CSRF-token GET helper, rate-limits POST, validates admin auth + CSRF, sanitizes final content/notes, updates status with audit trail and timestamps, and notifies the letter owner via templated email.

## Billing and Subscriptions
- **Checkout/session creation**: `app/api/create-checkout/route.ts` rate-limits, authenticates the user, validates plan selection, and handles coupons with fraud detection and logging. It supports test mode/TALK3 free flows, zero-cost subscription inserts, Stripe checkout creation for paid plans, and commission tracking for employee referrals; metadata captures subscription and coupon context for webhook reconciliation.

## Testing
- `pnpm build` (Next.js production build) completes successfully with Turbopack, generating all app and API routes listed in the output.
