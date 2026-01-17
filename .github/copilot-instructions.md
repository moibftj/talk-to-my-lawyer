# Copilot Instructions for Talk-To-My-Lawyer

AI legal letter drafting with **mandatory attorney review**.

## Non‑negotiables (security + roles)

1. **Only subscribers can generate letters.** Employees and admins must never access letter generation APIs.
2. **Admin/ attorney review is mandatory.** No “raw AI” letters reach subscribers.
3. **Employees never see letter content.** They only see coupon stats + commissions.
4. **Two admin roles exist: System Admin and Attorney Admin.**
   - Both have access to the letter review workflow in their dedicated dashboards but cannot generate letters.
   - **System Admin:** Has detailed statistics and logs for every user, letter, employee, and discount code. Can view full profile settings and complete information in the letter preview and editing modal.
   - **Attorney Admin:** Can only access the review letter modal without any user information or profile settings visibility.

5. **Respect Supabase RLS.** Never disable Row Level Security.
5. **Do not log sensitive information.** Avoid logging personal data or secrets.
6. **Do not leak secrets.** Never log env var values (mention names like `OPENAI_API_KEY` only).
7. **Use pnpm only.** Do not add npm/yarn lockfiles.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
CI=1 pnpm build
pnpm validate-env
```

## Repo map

- API routes: `app/api/**/route.ts`
- Subscriber UI: `app/dashboard/**`
- Admin portals: `app/secure-admin-gateway/**` and `app/attorney-portal/**`
- Supabase clients: `lib/supabase/server.ts` (server) and `lib/supabase/client.ts` (client)
- API error helpers: `lib/api/api-error-handler.ts`
- Rate limiting: `lib/rate-limit-redis.ts`
- Validation: `lib/validation/**`

## API route pattern

Order: 1) rate limit → 2) auth → 3) role check → 4) validate/sanitize → 5) business logic → 6) consistent response.

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

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    // if (profile?.role !== "subscriber") return errorResponses.forbidden("Only subscribers can ...")

    return successResponse({ ok: true })
  } catch (error) {
    return handleApiError(error, "API")
  }
}
```

## Admin routes

- Use `requireAdminAuth()` from `lib/auth/admin-guard.ts` for admin-only routes.
- Admin login requires the `ADMIN_PORTAL_KEY` factor (do not bypass).

## Endpoints (objective only)

### Auth

- `POST /api/auth/reset-password` — Send a password reset email.
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
- `DELETE /api/letters/[id]/delete` — Delete a letter (draft/rejected/failed; user-owned).

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

### Stripe

- `POST /api/stripe/webhook` — Handle Stripe webhook events.

### Health

- `GET /api/health` — Basic service health check.
- `GET /api/health/detailed` — Detailed health diagnostics.

## Email (Resend)

- Templates: `lib/email/templates.ts` keyed by `EmailTemplate` in `lib/email/types.ts`.
- Direct sends: `sendTemplateEmail()` / `sendEmail()` in `lib/email/service.ts`.
- Reliable delivery: enqueue via `lib/email/queue.ts` and process via `POST /api/cron/process-email-queue` (or `/api/admin/email-queue`).

```ts
import { sendTemplateEmail } from "@/lib/email/service"

await sendTemplateEmail("letter-approved", userEmail, {
  userName: "…",
  letterTitle: "…",
  letterLink: "…",
})
```

## Admin creation

- Prefer the repo scripts and pnpm tooling (avoid `npx`).
- If you need `.env.local` loaded for scripts, use `pnpm dlx dotenv-cli -e .env.local -- pnpm tsx ...`.
