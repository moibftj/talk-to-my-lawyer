# CLAUDE.md — AI Assistant Developer Notes

Talk-To-My-Lawyer: AI legal letter drafts with **mandatory attorney review**.

Last updated: 2026-01-31

## Non‑negotiables (security + roles)

1. **Only subscribers can generate letters.** Employees and admins must never access letter generation APIs.
2. **Both admin sub-roles (`attorney_admin`, `super_admin`) can review letters; review is mandatory.** No “raw AI” letters reach subscribers.
3. **Employees never see letter content.** They only see coupon stats + commissions.
4. **Respect Supabase RLS.** Never disable Row Level Security.
5. **Do not leak secrets.** Never log env var values.
6. Use **pnpm only** (`pnpm-lock.yaml` is source of truth).

## Stack (high level)

- Next.js App Router + TypeScript + Tailwind
- Supabase (Postgres + Auth + RLS)
- OpenAI (draft generation)
- Stripe (payments)
- Resend (email) + email queue
- Upstash Redis (rate limiting; falls back to in-memory)
- n8n workflow for letter generation monitoring + alerts
- OpenTelemetry tracing
- Vercel (hosting + deployment)
- pnpm (package management)
- Zod (validation)
- Playwright + Vitest (testing)
- Husky (pre-commit hooks)
- Prisma (optional, for certain DB operations)
- Claude (architecture planning agent)
- ESLint + Prettier (linting/formatting)
- Commitlint (commit message standards)

## Key flows (mental model)

- **Letter lifecycle**: `draft` → `generating` → `pending_review` → `under_review` → `approved|rejected` → `completed|failed`
- **Allowance**: check/deduct via DB RPCs (atomic), refund on failures where applicable.
- **Review**: attorneys approve/reject with CSRF protection; audit trail tracks state changes.

## Repo “where is what”

- API routes: `app/api/**/route.ts`
- Subscriber UI: `app/dashboard/**`
- Admin portals: `app/secure-admin-gateway/**` (super admin) and `app/attorney-portal/**`
- Server Supabase client: `lib/supabase/server.ts`
- Service role Supabase client: `lib/supabase/admin.ts`
- Client Supabase client: `lib/supabase/client.ts`
- Shared API responses/errors: `lib/api/api-error-handler.ts`
- Rate limiting: `lib/rate-limit-redis.ts`
- Validation: `lib/validation/**`
- **Next.js Middleware (Edge Runtime):** `proxy.ts` (see below)
- API middleware helpers: `lib/api/middleware.ts` (higher-order functions for routes)

## Next.js Middleware (`proxy.ts`)

**IMPORTANT:** This project uses `proxy.ts` as the Next.js middleware file (instead of `middleware.ts`).

- Location: Root level `proxy.ts` (this IS the Next.js middleware)
- Alternative names: `middleware.ts` (standard), `proxy.ts` (used here)
- Purpose: Edge Runtime middleware that runs on EVERY request before pages/API routes
- Implementation: `proxy.ts` → calls `lib/supabase/proxy.ts` (updateSession function)
- Handles:
  - Session refresh for authenticated users
  - Route protection based on user roles
  - Admin portal authentication (separate from Supabase auth)
  - Role-based redirects

**DO NOT rename `proxy.ts` to `middleware.ts` without updating all references!**

## API route pattern (copy/paste)

All sensitive routes should follow this order:

1) rate limit → 2) auth → 3) role check → 4) validate/sanitize → 5) business logic → 6) consistent response

```ts
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { safeApplyRateLimit, apiRateLimit } from "@/lib/rate-limit-redis"
import { successResponse, errorResponses, handleApiError } from "@/lib/api/api-error-handler"

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 100, "1 m")
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return errorResponses.unauthorized()

    // Role check example
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    // if (profile?.role !== "subscriber") return errorResponses.forbidden("Only subscribers can ...")

    // Validate input + do work...
    return successResponse({ ok: true })
  } catch (error) {
    return handleApiError(error, "API")
  }
}
```

## Endpoints (objective only)

### Auth

- `POST /api/auth/send-email` — Send an auth email.
- `POST /api/auth/reset-password` — Send a password reset email.
- `POST /api/auth/resend-confirmation` — Resend confirmation email.
- `POST /api/auth/update-password` — Update the user password after reset.

### Admin auth

- `POST /api/admin-auth/login` — Admin login (creates admin session; routes by sub-role).
- `POST /api/admin-auth/logout` — Admin logout (clears admin session).

### Profile

- `POST /api/create-profile` — Create/update the user profile row after signup.

### Checkout & billing

- `POST /api/create-checkout` — Create a checkout flow (Stripe session or free flow) for a plan/coupon.
- `POST /api/verify-payment` — Verify checkout and finalize subscription/credits.
- `GET /api/subscriptions/check-allowance` — Return remaining letter credits/allowance.
- `GET /api/subscriptions/billing-history` — Return billing history for the current user.
- `POST /api/subscriptions/activate` — Activate the current user’s subscription and apply allowances.
- `POST /api/subscriptions/reset-monthly` — Cron reset of monthly allowances.

### Letters

- `POST /api/generate-letter` — Generate an AI draft letter for a subscriber (for attorney review).
- `POST /api/letters/drafts` — Create/update a draft letter (autosave).
- `GET /api/letters/drafts` — List the user’s draft letters.

- `POST /api/letters/[id]/submit` — Submit a letter for attorney review.
- `POST /api/letters/[id]/start-review` — Mark a letter as under review (attorney/admin).

- `GET /api/letters/[id]/approve` — Get CSRF token for the approve action.
- `POST /api/letters/[id]/approve` — Approve a letter (attorney/admin action).
- `POST /api/letters/[id]/reject` — Reject a letter with a reason (attorney/admin action).
- `POST /api/letters/[id]/resubmit` — Resubmit a rejected letter.

- `POST /api/letters/[id]/complete` — Mark a letter as completed.
- `DELETE /api/letters/[id]/delete` — Delete a letter (when permitted).

- `POST /api/letters/[id]/improve` — Improve a specific letter via AI.
- `POST /api/letters/improve` — Improve provided letter content via AI (admin tool).

- `GET /api/letters/[id]/pdf` — Generate/download a letter PDF.
- `POST /api/letters/[id]/send-email` — Queue sending a letter by email.
- `GET /api/letters/[id]/audit` — Fetch a letter’s audit trail.

### Admin

- `GET /api/admin/csrf` — Get a CSRF token for admin actions.
- `GET /api/admin/letters` — List letters for admin review/management.
- `POST /api/admin/letters/[id]/update` — Update a letter (admin edit).
- `POST /api/admin/letters/batch` — Bulk update letters (admin).

- `GET /api/admin/analytics` — Fetch admin analytics/stats.

- `GET /api/admin/coupons` — List coupons and usage stats.
- `POST /api/admin/coupons/create` — Create a promo coupon.
- `PATCH /api/admin/coupons/create` — Toggle promo coupon active status.

- `GET /api/admin/email-queue` — View email queue items + stats.
- `POST /api/admin/email-queue` — Trigger queue processing or manage retries/cleanup.

### Employee

- `GET /api/employee/referral-link` — Get employee coupon + referral/share links.
- `GET /api/employee/payouts` — Get employee commission/payout summary.
- `POST /api/employee/payouts` — Request a commission payout.

### GDPR

- `POST /api/gdpr/accept-privacy-policy` — Record privacy policy acceptance/consents.
- `GET /api/gdpr/accept-privacy-policy` — Check acceptance for a required version.

- `POST /api/gdpr/export-data` — Create (and possibly immediately fulfill) a user data export request.
- `GET /api/gdpr/export-data` — List recent export requests for the current user.

- `POST /api/gdpr/delete-account` — Create an account deletion request.
- `GET /api/gdpr/delete-account` — List deletion requests/status for the current user.
- `DELETE /api/gdpr/delete-account` — Admin executes an approved deletion request.

### Email queue cron

- `POST /api/cron/process-email-queue` — Process queued emails (cron-secured).
- `GET /api/cron/process-email-queue` — Health/status for the cron endpoint.
- `GET /api/cron/health-check` — Cron health check endpoint.
- `POST /api/cron/daily-analytics` — Daily analytics rollup job.
- `POST /api/cron/weekly-cleanup` — Weekly cleanup job.
- `POST /api/cron/cleanup-expired-sessions` — Cleanup expired admin sessions.

### Email (app)

- `POST /api/email/process-queue` — Process email queue items (app endpoint).

### Test

- `POST /api/test/create-accounts` — Create test accounts (requires test mode).

### Stripe

- `POST /api/stripe/webhook` — Handle Stripe webhook events.

### Health

- `GET /api/health` — Basic service health check.
- `GET /api/health/detailed` — Detailed health diagnostics.

## Admin auth notes

- Prefer `requireAdminAuth()` from `lib/auth/admin-guard.ts` for admin-only routes.
- “Admin portal key” is a **3rd factor** for admin login (do not bypass).

## Environment variables (minimum)

Required by `pnpm validate-env`:
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- OpenAI: `OPENAI_API_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Email: `RESEND_API_KEY`
- Admin: `ADMIN_PORTAL_KEY`
- Cron: `CRON_SECRET`

Also required for full functionality:
- Supabase service role (server-only): `SUPABASE_SERVICE_ROLE_KEY`
- Stripe publishable key used in client code: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Site/app URL (used in email links): `NEXT_PUBLIC_SITE_URL` (preferred) or `NEXT_PUBLIC_APP_URL` (legacy)
- Email sender: `EMAIL_FROM` (+ optional `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`)
- Test mode toggles: `ENABLE_TEST_MODE`, `NEXT_PUBLIC_TEST_MODE`

Note: Stripe publishable key is currently read from both `STRIPE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in different modules. Set both until unified.
Note: Rate limiting uses Upstash envs `KV_REST_API_URL` and `KV_REST_API_TOKEN` (see `lib/rate-limit-redis.ts`).

## n8n Integration

Letter generation can use n8n workflows instead of direct OpenAI calls. When configured, the app sends form data to n8n, which processes it through ChatGPT and returns the generated letter.

**Environment variables:**
- `N8N_WEBHOOK_URL` - Primary webhook URL for letter generation (required for n8n mode)
- `N8N_EVENTS_WEBHOOK_URL` - Optional webhook for monitoring/alerting events

**How it works:**
1. App handles auth, rate limiting, allowance checking
2. App creates letter record with `generating` status
3. App sends form data to n8n webhook
4. n8n generates letter via ChatGPT
5. n8n returns `{ success: true, generatedContent: "..." }`
6. App saves content, updates status, notifies admins

**Fallback:** If `N8N_WEBHOOK_URL` is not set, the app uses local OpenAI integration.

**n8n workflow response format:**
```json
{
  "success": true,
  "generatedContent": "Dear Mr. Smith,\n\nThis letter serves as formal notice...",
  "letterId": "uuid-here"
}
```

See `lib/services/n8n-webhook-service.ts` for implementation details.

## Email (Resend)

- Templates live in `lib/email/templates.ts` and are keyed by `EmailTemplate` (see `lib/email/types.ts`).
- Use `sendTemplateEmail()` / `sendEmail()` from `lib/email/service.ts` for direct sends.
- For reliability (retries + persistence), enqueue via `lib/email/queue.ts` and process via `POST /api/email/process-queue` (cron endpoints proxy to this). Admin tools live under `/api/admin/email-queue`.

**Send a template (direct):**

```ts
import { sendTemplateEmail } from "@/lib/email/service"

await sendTemplateEmail("letter-approved", userEmail, {
  userName: "…",
  letterTitle: "…",
  letterLink: "…",
})
```

**Add/modify a template:**

1) Update `EmailTemplate` (if adding a new key) in `lib/email/types.ts`.
2) Implement the template in `lib/email/templates.ts` (subject + `text` + `html`).

**Config:**

- Resend: `RESEND_API_KEY`
- Sender: `EMAIL_FROM` (and optional `EMAIL_FROM_NAME`)

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
CI=1 pnpm build
pnpm validate-env
pnpm db:migrate
pnpm db:verify
pnpm audit:security
pnpm precommit
pnpm test
pnpm test:run
```

## Pointers (use these instead of duplicating details here)

- Setup/config: `docs/SETUP_AND_CONFIGURATION.md`
- Architecture/dev: `docs/ARCHITECTURE_AND_DEVELOPMENT.md`
- Security: `docs/SECURITY.md`
- DB & RLS: `docs/DATABASE.md`
- API integrations: `docs/API_AND_INTEGRATIONS.md`
- Operations/deploy: `docs/OPERATIONS.md`, `docs/DEPLOYMENT_GUIDE.md`

## Architecture Planning Agent

For architectural decisions, scalability planning, and system coherence:

- **Agent spec**: `docs/agents/architecture-planner.md`
- **Usage**: Call with `subagent_type="Plan"` when making significant changes
- **Purpose**: Ensures architectural consistency across the platform
