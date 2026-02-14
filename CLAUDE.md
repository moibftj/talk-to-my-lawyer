# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Talk-To-My-Lawyer** is an AI-powered legal letter drafting platform with mandatory attorney review. Letters generated via OpenAI (through n8n webhooks) must be approved by attorneys (Super Admin or Attorney Admin) before subscribers can access them.

**Tech Stack:**
- Frontend/SSR: Next.js 16 (App Router), React 19, Tailwind v4 + shadcn/ui (new-york style)
- Backend: Supabase (Postgres + RLS), Stripe, Resend email, Upstash Redis
- AI: Vercel AI SDK (`ai` + `@ai-sdk/openai`) with n8n webhook integration for letter generation
- Rich Text: Tiptap editor for letter review/editing
- Charts: Recharts for analytics dashboards
- State: React Query (`@tanstack/react-query`) for server state
- Monitoring: Sentry (`@sentry/nextjs`) + OpenTelemetry tracing
- Package manager: **pnpm only** (version 10.28.0)
- Deployment: Vercel (region `iad1`)

## Development Commands

```bash
# Core development
pnpm dev                  # Start dev server on localhost:3000
pnpm build                # Production build
CI=1 pnpm build           # Strict production build (must pass before merge)
pnpm lint                 # ESLint
pnpm lint:fix             # Auto-fix ESLint issues
pnpm test                 # Run Vitest suite (watch mode)
pnpm test:run             # Run tests once (non-watch)
pnpm test:ui              # Vitest UI mode
pnpm test:coverage        # Coverage report
pnpm test:watch           # Explicit watch mode

# Database & environment
pnpm validate-env         # Check required environment variables
pnpm db:migrate           # Apply Supabase SQL migrations
pnpm db:verify            # Verify database connection

# Security & deployment
pnpm security:scan        # Audit for vulnerabilities (pnpm audit --audit-level=high)
pnpm predeploy:check      # Pre-deployment validation
pnpm health-check         # Local health check
pnpm health-check:production  # Production health check
```

## Build Verification

**After every code change, run the strict production build to ensure it passes:**

```bash
CI=1 pnpm build
```

This must succeed before any code is committed or merged. The strict build catches:
- TypeScript errors (strict mode, `ignoreBuildErrors: false`)
- ESLint violations
- Build-time errors
- Unused exports

If the build fails, fix all errors before proceeding.

## Project Structure

```
talk-to-my-lawyer/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (providers, global setup)
│   ├── page.tsx                  # Homepage / landing page
│   ├── error.tsx                 # Global error boundary
│   ├── not-found.tsx             # 404 handler
│   ├── globals.css               # Global styles (Tailwind imports, CSS variables)
│   ├── robots.ts / sitemap.ts    # SEO
│   ├── actions/                  # Server actions (email-actions.ts)
│   ├── auth/                     # Auth pages (login, signup, forgot-password, etc.)
│   ├── dashboard/                # Subscriber & employee portal
│   ├── attorney-portal/          # Attorney admin review portal
│   ├── secure-admin-gateway/     # Super admin portal
│   ├── contact/ how-it-works/    # Public pages
│   │   faq/ membership/
│   └── api/                      # API routes (~57 endpoints)
│       ├── generate-letter/      # Core letter generation
│       ├── letters/              # Letter CRUD, review, PDF, email
│       ├── admin/                # Admin management operations
│       ├── admin-auth/           # Admin login/logout/session
│       ├── auth/                 # User auth (reset password, resend, etc.)
│       ├── stripe/               # Stripe webhook
│       ├── subscriptions/        # Subscription management + monthly reset cron
│       ├── email/                # Email send + queue processing cron
│       ├── employee/             # Employee referral links, payouts
│       ├── cron/                 # Scheduled jobs (health, cleanup, analytics)
│       ├── gdpr/                 # GDPR data export, deletion, privacy
│       └── health/               # Health check endpoints
├── lib/                          # Business logic & utilities
│   ├── api/                      # Error handler, custom error classes
│   ├── auth/                     # Auth helpers (requireSubscriber, requireAdmin, etc.)
│   ├── ai/                       # OpenAI client wrapper + retry logic
│   ├── admin/                    # Admin management, CSRF client, letter actions
│   ├── config/                   # Type-safe env config, rate limit configs
│   ├── constants/                # Statuses, roles, business rules
│   ├── data/                     # Static data (FAQ)
│   ├── db/                       # Database client factory
│   ├── email/                    # Email service, queue, templates, React Email components
│   ├── errors/                   # Generic error handler
│   ├── fraud-detection/          # Coupon fraud detection
│   ├── logging/                  # Structured logger
│   ├── middleware/               # Cron auth, request ID
│   ├── monitoring/               # OpenTelemetry tracing, Sentry config, health checks
│   ├── pdf/                      # PDF generation (jsPDF)
│   ├── prompts/                  # AI prompt templates for letter generation
│   ├── security/                 # CSRF, JWT, input sanitizer, webhook signatures
│   ├── server/                   # Graceful shutdown handler
│   ├── services/                 # Core business services (letter generation, allowance, etc.)
│   ├── stripe/                   # Stripe client
│   ├── supabase/                 # Server/client/admin Supabase clients
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Retry utility
│   ├── validation/               # Zod schemas (letter validation)
│   ├── database.types.ts         # Auto-generated Supabase types (source of truth)
│   ├── design-tokens.ts          # Semantic color tokens for UI
│   ├── rate-limit-redis.ts       # Redis-based rate limiter (Upstash)
│   └── utils.ts / helpers.ts     # General utilities (cn, formatters, dates)
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components (60+ files)
│   ├── admin/                    # Admin portal components
│   ├── home/                     # Homepage components
│   └── *.tsx                     # Feature components (letter actions, modals, etc.)
├── supabase/
│   └── migrations/               # 67+ SQL migration files
├── scripts/                      # Node.js/bash utility scripts
├── middleware.ts                  # Next.js middleware (session refresh, route protection)
├── instrumentation.ts            # Next.js instrumentation (Sentry + OpenTelemetry init)
└── Configuration files           # next.config.mjs, tsconfig.json, vitest.config.ts, etc.
```

## Architecture

### Letter Lifecycle Flow

```
draft → generating → pending_review → under_review → approved → completed
                  ↘ failed (→ draft retry)      ↘ rejected (→ pending_review resubmit)
```

**Statuses:** `draft`, `generating`, `pending_review`, `under_review`, `approved`, `rejected`, `completed`, `failed`

Status transitions are enforced by `VALID_LETTER_TRANSITIONS` in `lib/constants/statuses.ts`. Letter generation routes through `/api/generate-letter` which:
1. Rate limits the request
2. Authenticates user as subscriber (via `requireSubscriber()`)
3. Checks/deducts letter allowance (atomic deduction)
4. Optionally runs legal research (Tavily/Bing) for jurisdiction context
5. Calls n8n webhook for AI generation
6. Sets status to `pending_review` (attorney must approve)

### Supabase Client Patterns

```typescript
// Server components and API routes (per-request, respects RLS)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Client components (singleton, browser environment)
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Service role (bypasses RLS) - ONLY for system/cron operations
import { getServiceRoleClient } from '@/lib/supabase/admin'
const supabase = getServiceRoleClient()
```

Database types are auto-generated in `lib/database.types.ts`. Import `DatabaseWithRelationships` from `lib/supabase/types.ts` for typed queries.

### API Route Standard Pattern

All API routes follow this structure:

```typescript
import { type NextRequest } from "next/server"
import { safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { requireSubscriber, requireAuth } from '@/lib/auth/authenticate-user'
import { successResponse, handleApiError } from '@/lib/api/api-error-handler'

export const runtime = "nodejs"  // Required for routes needing longer timeouts

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit
    const rateLimitResponse = await safeApplyRateLimit(request, rateLimit, ...config)
    if (rateLimitResponse) return rateLimitResponse

    // 2. Auth
    const { user, supabase } = await requireSubscriber() // or requireAuth(), requireAdmin()

    // 3. Validate input
    const body = await request.json()
    // ... Zod validation

    // 4. Business logic (via services)
    // ... operations

    // 5. Response
    return successResponse({ data }, 200)
  } catch (error) {
    return handleApiError(error, 'context-name')
  }
}
```

**Function timeouts** (configured in `vercel.json`):
- AI generation: 60s (`generate-letter`, `letters/improve`)
- Cron jobs: 120s (`api/cron/**`)
- Admin/Stripe/PDF: 30s

Use custom error classes from `lib/api/api-error-handler.ts`:
- `AuthenticationError` (401)
- `AuthorizationError` (403)
- `ValidationError` (400)
- `NotFoundError` (404)
- `RateLimitError` (429)
- `ExternalServiceError` (502)

### Authentication & Authorization

All auth helpers are in `lib/auth/authenticate-user.ts` and return `{ user, supabase }` or throw:

- `requireAuth()` - any authenticated user
- `requireSubscriber()` - allows subscriber, admin, and super_admin roles
- `requireAdmin()` - admin or super_admin only
- `requireEmployee()` - employee role only
- `requireRole(role)` - specific role check

**Admin portal routes** use `requireAdminSession(request)` from `lib/auth/admin-session.ts` — JWT-signed cookies, valid for 30 minutes. Returns `AdminSession` with `subRole` (`'super_admin'` | `'attorney_admin'`).

**Role checks happen at API route level, not middleware.** Employees (`role = 'employee'`) must never see letter content — enforce in both API and UI.

### Portals & Route Protection

Four distinct portals serve different user roles:

| Portal | Route Prefix | Roles | Purpose |
|--------|-------------|-------|---------|
| Subscriber Dashboard | `/dashboard/*` | subscriber | Letter generation, billing, settings |
| Employee Dashboard | `/dashboard/commissions`, `/dashboard/coupons`, etc. | employee | Commissions, coupons, payouts |
| Attorney Portal | `/attorney-portal/*` | attorney_admin | Letter review and approval |
| Super Admin Portal | `/secure-admin-gateway/*` | super_admin | Full platform management + review |

`middleware.ts` runs on every request (excluding static assets) and:
1. Refreshes Supabase session via `updateSession()` from `lib/supabase/proxy.ts`
2. Reads `role` and `admin_sub_role` from the profiles table
3. Redirects unauthenticated users to login
4. Redirects users to role-appropriate portals
5. Blocks cross-portal access (e.g., attorney admin accessing super admin portal)
6. Reports errors to Sentry

### Services

`lib/services/` contains reusable business logic called from API routes:

| Service | Purpose |
|---------|---------|
| `letter-generation-service.ts` | Orchestrates AI letter generation end-to-end with research integration |
| `n8n-webhook-service.ts` | Calls n8n webhook which invokes OpenAI for generation + PDF conversion |
| `allowance-service.ts` | Checks/deducts subscription letter credits (atomic operations) |
| `audit-service.ts` | Logs all letter status changes with full audit trail |
| `notification-service.ts` | Sends admin alerts for new letters / status changes |
| `legal-research-service.ts` | Web-based legal research (Tavily/Bing) for jurisdiction-aware letters |

### AI Integration

AI generation uses a multi-step pipeline:

1. **Legal Research** (`lib/services/legal-research-service.ts`) — Searches for relevant statutes, case law, and regulations via Tavily API (or Bing fallback)
2. **Prompt Engineering** (`lib/prompts/letter-prompts.ts`) — Jurisdiction-aware professional letter prompts
3. **n8n Webhook** (`lib/services/n8n-webhook-service.ts`) — Calls n8n workflow for OpenAI generation
4. **OpenAI Client** (`lib/ai/openai-client.ts`) — Vercel AI SDK provider with retry logic (`lib/ai/openai-retry.ts`)

### Security

Security utilities in `lib/security/`:

| Module | Purpose |
|--------|---------|
| `csrf.ts` | CSRF token generation/validation (24-hour expiry) |
| `jwt.ts` | JWT signing/verification (HS256) for admin session tokens |
| `input-sanitizer.ts` | XSS prevention, string sanitization |
| `audit-note-sanitizer.ts` | Sanitize audit notes |
| `webhook-signature.ts` | Webhook signature verification |

Additional security features:
- **Fraud Detection** (`lib/fraud-detection/coupon-fraud.ts`) — Velocity, distribution, timing, and behavior analysis for coupon fraud
- **GDPR Compliance** — API routes for data export (`/api/gdpr/export-data`), account deletion (`/api/gdpr/delete-account`), and privacy policy acceptance
- **Content Security Policy** — Configured in `next.config.mjs` with Stripe, Supabase, Resend allowlists
- **Security Headers** — X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy via both `next.config.mjs` and `vercel.json`

### Environment Variables

Access via `lib/config/env.ts` for type-safe configs:
```typescript
import { supabase, openai, stripe, app } from '@/lib/config/env'
```

For direct access, use `process.env.VAR_NAME`. Always add new env vars to both `.env.local` and Vercel Dashboard.

**Critical env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` — Custom domain: `https://app.talk-to-my-lawyer.com`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `EMAIL_FROM`
- `ADMIN_PORTAL_KEY`, `ADMIN_SESSION_SECRET`
- `CRON_SECRET`, `CSRF_SECRET`
- `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_AUTH_USER`, `N8N_WEBHOOK_AUTH_PASSWORD`, `N8N_PDF_WEBHOOK_URL`
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — Upstash Redis for rate limiting

### Cron Jobs (Vercel)

Configured in `vercel.json`:

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/email/process-queue` | Every 5 minutes | Process email queue |
| `/api/cron/health-check` | Every 30 minutes | Health checks |
| `/api/cron/check-stuck-letters` | Every 2 hours | Detect stuck letter generation |
| `/api/cron/cleanup-expired-sessions` | Every 6 hours | Session cleanup |
| `/api/cron/daily-analytics` | Daily at 1 AM | Analytics aggregation |
| `/api/cron/weekly-cleanup` | Sunday 2 AM | Weekly data cleanup |
| `/api/subscriptions/reset-monthly` | 1st of month | Reset monthly letter allowances |

All cron routes are protected by `CRON_SECRET` header (`Authorization: Bearer ${CRON_SECRET}`). Auth logic in `lib/middleware/cron-auth.ts`.

### Monitoring & Observability

**Sentry** (`@sentry/nextjs`) — Error tracking with server, client, and edge configs in `lib/monitoring/sentry/`. Initialized via `instrumentation.ts`.

**OpenTelemetry** — Business spans created with `lib/monitoring/tracing.ts`:
```typescript
import { createBusinessSpan, addSpanAttributes, recordSpanEvent } from '@/lib/monitoring/tracing'

const span = createBusinessSpan('operation_name', { 'key': 'value' })
addSpanAttributes({ 'user.id': userId })
recordSpanEvent('step_completed')
span.setStatus({ code: 1, message: 'Success' })
```

**Structured Logging** — `lib/logging/structured-logger.ts` provides leveled logging (debug, info, warn, error, fatal).

**Health Checks** — `lib/monitoring/health-check.ts` checks database, OpenAI, Supabase Auth, email, and rate limiting.

### Component Patterns

- **Pages** are server components (async, fetch data with server Supabase client)
- **Layouts and interactive shells** (e.g., `components/dashboard-layout.tsx`) are `'use client'`
- Use `@/` path alias: `import { Button } from '@/components/ui/button'`
- Add shadcn components: `pnpm dlx shadcn@latest add <component>`
- Use design tokens from `lib/design-tokens.ts` for semantic colors instead of hardcoding Tailwind classes
- Rich text editing uses Tiptap (`@tiptap/react` + `@tiptap/starter-kit`)

### Email System

Two types of emails:
1. **Auth emails** (confirmations, password reset) — handled by Supabase Auth SMTP
2. **App emails** (notifications, letter status changes) — Resend + queue system

Use `queueTemplateEmail()` from `lib/email` for app emails. It tries immediate send, falls back to queue with retry.

React Email components in `lib/email/react-email/`:
- `WelcomeEmail.tsx`, `EmailConfirmationEmail.tsx`
- `PasswordResetEmail.tsx`
- `LetterApprovedEmail.tsx`, `LetterRejectedEmail.tsx`

Debug email issues:
1. Run `node check-email-config.js`
2. Run `node test-email-send.js`
3. Check `email_queue` table for failed/sending emails
4. Verify Resend dashboard

See `lib/email/AGENTS.md` for detailed debugging protocol.

### PDF Generation

`lib/pdf/generator.ts` generates PDFs using jsPDF with professional formatting. PDF storage URLs are tracked on letter records. The n8n workflow also handles PDF generation/storage via a separate webhook (`N8N_PDF_WEBHOOK_URL`).

## Constants & Types

Use constants from `lib/constants/` — never use magic strings:

```typescript
import { LETTER_STATUSES, VALID_LETTER_TRANSITIONS, isValidLetterTransition } from '@/lib/constants/statuses'
import { USER_ROLES, isAdminRole, isSuperAdmin } from '@/lib/constants/roles'
import { COMMISSION_RATE, LETTER_LIMITS, COUPON_LIMITS } from '@/lib/constants/business'
```

**Status enums available:** `LETTER_STATUSES`, `PAYOUT_STATUSES`, `SUBSCRIPTION_STATUSES`, `EXPORT_STATUSES`, `DELETION_STATUSES`, `EMAIL_QUEUE_STATUSES`

**Type definitions** in `lib/types/`:
- `api.ts` — API request/response types
- `letter.types.ts` — Letter entities, LetterType enum
- `letter-generation.types.ts` — AI generation pipeline types

**Database types** are auto-generated in `lib/database.types.ts`. Import `DatabaseWithRelationships` from `lib/supabase/types.ts`.

## Key Conventions

- **Never disable Supabase RLS** — all user-facing queries go through RLS-enabled clients
- **Never log secrets or PII** — prompts and AI outputs stored for audit in DB, not console
- **Employees must never see letter content** — enforce at both API and UI layers
- **Letter approval requires attorney review** — no auto-approval paths exist
- **Use constants** — `LETTER_STATUSES`, `USER_ROLES` from `lib/constants/`, no magic strings
- **Use pnpm only** — no npm/yarn lockfiles allowed
- **Type safety** — `lib/database.types.ts` is auto-generated, use for DB queries; TypeScript strict mode is on
- **Error handling** — use shared `handleApiError()` and custom error classes from `lib/api/api-error-handler.ts`
- **Atomic operations** — Letter allowance deduction and coupon operations use database-level atomic functions
- **Input sanitization** — Use `lib/security/input-sanitizer.ts` for user input; validate at system boundaries

## Testing

- Tests use **Vitest** with **happy-dom** environment
- Test files: `**/*.{test,spec}.{ts,tsx}`
- Run single test: `pnpm test -- <pattern>`
- Environment variables for tests are set in `vitest.setup.ts`
- Coverage thresholds: 50% minimum for statements, branches, functions, and lines
- Coverage provider: v8, reporters: text, json, html
- Mocks: `mockReset`, `restoreMocks`, `clearMocks` all enabled

**Test locations** — tests are co-located throughout the codebase:
- `app/api/__tests__/` — API integration tests (auth, letters, payments, GDPR, admin, webhooks)
- `lib/services/__tests__/` — Service unit tests
- `lib/security/__tests__/` — Security utility tests
- `lib/email/__tests__/` — Email delivery and queue tests
- `components/__tests__/` — Component tests

## Important Files

| Purpose | File |
|---------|------|
| Status constants & transitions | `lib/constants/statuses.ts` |
| Role constants & helpers | `lib/constants/roles.ts` |
| Business rules & limits | `lib/constants/business.ts` |
| API error handling | `lib/api/api-error-handler.ts` |
| Auth functions | `lib/auth/authenticate-user.ts` |
| Admin session (JWT) | `lib/auth/admin-session.ts` |
| Environment config | `lib/config/env.ts` |
| Rate limiting | `lib/rate-limit-redis.ts` |
| Rate limit configs per route | `lib/config/rate-limits.ts` |
| Letter validation (Zod) | `lib/validation/letter-schema.ts` |
| Design tokens | `lib/design-tokens.ts` |
| Email service | `lib/email/service.ts` |
| Email queue | `lib/email/queue.ts` |
| Tracing (OpenTelemetry) | `lib/monitoring/tracing.ts` |
| Sentry config | `lib/monitoring/sentry/sentry.server.config.ts` |
| CSRF protection | `lib/security/csrf.ts` |
| Input sanitization | `lib/security/input-sanitizer.ts` |
| PDF generation | `lib/pdf/generator.ts` |
| AI prompts | `lib/prompts/letter-prompts.ts` |
| OpenAI client | `lib/ai/openai-client.ts` |
| Legal research | `lib/services/legal-research-service.ts` |
| Letter generation API | `app/api/generate-letter/route.ts` |
| Middleware (route protection) | `middleware.ts` |
| Instrumentation (Sentry + OTEL) | `instrumentation.ts` |
| Supabase server client | `lib/supabase/server.ts` |
| Supabase service role client | `lib/supabase/admin.ts` |
| Session proxy (middleware) | `lib/supabase/proxy.ts` |
| Auto-generated DB types | `lib/database.types.ts` |
| Vercel config (crons, timeouts) | `vercel.json` |
| Next.js config (headers, CSP) | `next.config.mjs` |

## Admin Roles

- **Super Admin** — Full platform access: user management, analytics, letter review/approval, coupon/commission management
- **Attorney Admin** — Access to Letter Review Center (`/attorney-portal/review`), can edit/approve/reject letters
- **Employee** — Coupons, commissions, payouts, customer support (never sees letter content)
- **Subscriber** — Generates letters, views own history, manages subscription/billing

Admin sub-roles are stored as `admin_sub_role` enum on profiles table. Admin sessions use JWT-signed cookies with 30-minute expiry. Admin auth API routes are under `/api/admin-auth/`.

## Production Readiness

### Known Issues (Must Fix Before Launch)

1. **Patch `path-to-regexp` ReDoS vulnerability** — Transitive dependency via `@vercel/node`. Run:
   ```bash
   pnpm update @vercel/node
   pnpm audit --audit-level=high
   ```

2. **Expand rate limiting coverage** — Rate limit configs are defined in `lib/config/rate-limits.ts` but only applied to ~12 of 59 API routes. Prioritize admin routes, auth endpoints, and any expensive operations not yet protected.

3. **Health check info exposure** — `/api/cron/health-check` returns specific missing env var names. In production this helps attackers; return a generic `"Configuration error"` instead of variable names.

### Already Addressed

- CSP `frame-ancestors` fixed to `'self'` (prevents clickjacking)
- Startup env validation added in `instrumentation.ts` (fails fast on missing config in production)
- No hardcoded secrets or credentials anywhere in the codebase
- Employee data isolation enforced at both RLS and API layers
- Stripe webhook signature verification with DB-level idempotency
- Full GDPR Articles 15, 17, 20 compliance

### Pre-Deployment Checklist

```bash
pnpm audit --audit-level=high   # Must show 0 high vulnerabilities
CI=1 pnpm build                 # Must pass
pnpm lint                       # Must pass
pnpm test:run                   # 801+ tests must pass
pnpm validate-env               # Must show all vars present
```

Verify in Vercel Dashboard before go-live:
- All env vars set (see Critical env vars list above)
- Sentry DSN configured
- Stripe webhook endpoint registered with correct secret
- Cron jobs scheduled (auto-configured via `vercel.json`)

## Database Migrations

67+ SQL migration files in `supabase/migrations/` covering:
- Core schema (profiles, subscriptions, letters, coupons, etc.)
- Row-Level Security policies (consolidated and optimized)
- Database functions (PL/pgSQL)
- Letter allowance system (atomic deduction)
- Audit trail tables
- GDPR compliance (data export/deletion)
- Webhook idempotency
- Email queue with concurrency handling
- Employee coupon triggers
- Geographic fields (state/jurisdiction)
- Performance indexes and optimizations

Run migrations with `pnpm db:migrate`. Verify connection with `pnpm db:verify`.
