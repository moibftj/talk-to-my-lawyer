# Agent Handbook for Talk-To-My-Lawyer

This file is the canonical blueprint for the Talk-To-My-Lawyer system. It is the single place to understand architecture, data, workflows, and operational rules. Keep it accurate. If code and this file diverge, update this file.

## Non-negotiables
- Use pnpm (packageManager=pnpm@10.25.0). Do not add npm/yarn lockfiles.
- Always run `pnpm lint` and `CI=1 pnpm build` before delivery.
- Keep Supabase auth helpers (`lib/auth/*`, `lib/supabase/*`) and rate limit helpers (`lib/rate-limit-redis.ts`, `lib/rate-limit.ts`) in the request path when touching API routes.
- Use the shared API error handling helpers in `lib/api/api-error-handler.ts` where possible.
- Prefer functional React components. Add `'use client'` only when needed.
- API routes live under `app/api` and must return structured JSON via `NextResponse.json`.
- Avoid introducing non-ASCII characters unless the file already uses them.

## System overview
Talk-To-My-Lawyer is a SaaS platform for AI-assisted legal letter generation with mandatory attorney review. It uses Next.js App Router for UI and API routes, Supabase for auth and database, Stripe for billing, Upstash Redis for rate limiting, and a pluggable email service for notifications.

Core subsystems:
- UI and dashboards: App Router pages in `app/*`.
- API layer: Route handlers in `app/api/*`.
- Auth and sessions: Supabase Auth plus admin session cookies.
- Letter lifecycle: Draft generation, review, approval, and delivery.
- Billing: Stripe Checkout, webhooks, and subscription allowances.
- Email: Provider-agnostic service with queueing.
- Admin portal: Secure gateway with portal key and role checks.
- Rate limiting: Upstash with in-memory fallback.
- PDF generation: Server-side PDF generation for letters.

## Tech stack
- Framework: Next.js 16 (App Router) with React 19 and TypeScript.
- Styling: Tailwind CSS + shadcn/ui components.
- Data: Supabase (Postgres + RLS).
- Auth: Supabase Auth.
- Payments: Stripe.
- AI: Vercel AI SDK (`ai`, `@ai-sdk/openai`), model default `gpt-4-turbo`.
- Email: Resend, Brevo, SendGrid, SMTP, or console provider.
- Rate limiting: Upstash Redis (`@upstash/redis`, `@upstash/ratelimit`).

## Runtime boundaries
- Server components by default; use `'use client'` for interactive client components.
- API routes are Node runtime (`export const runtime = 'nodejs'` where needed).
- Supabase client usage:
  - `lib/supabase/client.ts` for browser/client components.
  - `lib/supabase/server.ts` for server/API routes.
- Admin sessions are cookie-based and validated in `lib/auth/admin-session.ts`.

## Directory map and responsibilities
- `app/` - App Router pages and layouts.
  - `app/page.tsx` - marketing landing.
  - `app/layout.tsx` - root layout + metadata.
  - `app/auth/*` - login, signup, check-email, reset/forgot password flows.
  - `app/dashboard/*` - subscriber/employee dashboard pages.
  - `app/secure-admin-gateway/*` - admin login and dashboards.
  - `app/api/*` - route handlers (see API section).
- `components/` - shared UI and feature widgets.
  - `components/admin/*` - admin UI blocks.
  - `components/ui/*` - shadcn primitives.
- `hooks/` - lightweight hooks (`use-mobile.ts`, `use-toast.ts`).
- `lib/` - server utilities and domain logic.
  - `lib/api/*` - shared API handler/error helpers.
  - `lib/auth/*` - auth, admin guard/session, user helpers.
  - `lib/ai/*` - OpenAI retry/circuit breaker.
  - `lib/email/*` - providers, queue, templates, service.
  - `lib/security/*` - CSRF, input sanitizer, security utils.
  - `lib/rate-limit-redis.ts` / `lib/rate-limit.ts` - rate limiters.
  - `lib/pdf/*` - PDF generation.
  - `lib/stripe/*` - Stripe client and helpers.
  - `lib/monitoring/*` - health checks.
  - `lib/errors/*`, `lib/logging/*` - shared error/log patterns.
  - `lib/fraud-detection/*` - coupon fraud detection.
  - `lib/validation/*` - letter intake validation.
- `types/` - shared domain types.
- `supabase/` - SQL migrations (Supabase CLI format).
- `scripts/` - setup, migrations, CI helpers, validation scripts.
- `styles/` - Tailwind/global styles.
- `public/` - static assets.
- `docs/` - operational documentation.

## Domain model and core types

### Roles and statuses
```ts
export type UserRole = 'subscriber' | 'employee' | 'admin'

export type LetterStatus =
  | 'draft'
  | 'generating'
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'failed'

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'pending'
  | 'payment_failed'
  | 'expired'

export type CommissionStatus = 'pending' | 'paid' | 'cancelled'
```

### Core entities (from `types/index.ts` and `lib/database.types.ts`)
```ts
export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  phone: string | null
  company_name: string | null
  avatar_url: string | null
  bio: string | null
  total_letters_generated: number
  created_at: string
  updated_at: string
}

export interface Letter {
  id: string
  user_id: string
  title: string
  letter_type: string
  status: LetterStatus
  recipient_name: string | null
  recipient_address: string | null
  subject: string | null
  content: string | null
  intake_data: Record<string, any>
  ai_draft_content: string | null
  final_content: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  rejection_reason: string | null
  approved_at: string | null
  completed_at: string | null
  sent_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan: string
  plan_type: string
  status: SubscriptionStatus
  price: number
  discount: number
  coupon_code: string | null
  employee_id: string | null
  credits_remaining: number
  remaining_letters: number
  current_period_start: string
  current_period_end: string
  stripe_session_id: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
}

export interface EmployeeCoupon {
  id: string
  employee_id: string
  code: string
  discount_percent: number
  is_active: boolean
  usage_count: number
  created_at: string
  updated_at: string
}

export interface Commission {
  id: string
  user_id: string
  employee_id: string
  subscription_id: string
  subscription_amount: number
  commission_rate: number
  commission_amount: number
  status: CommissionStatus
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface LetterAuditTrail {
  id: string
  letter_id: string
  performed_by: string
  action: string
  old_status: string | null
  new_status: string | null
  notes: string | null
  created_at: string
}
```

### Additional tables (Supabase)
- `coupon_usage` - coupon redemption tracking.
- `email_queue` - queued emails and retries.
- `admin_audit_log` - admin authentication and activity.
- `fraud_detection_rules`, `fraud_alerts`, `ip_reputation` - fraud detection data.
- `security_audit_log`, `security_config` - security monitoring.

## Letter lifecycle
State transitions (typical path):
```
Draft -> Generating -> Pending Review -> Under Review -> Approved -> Completed
                      |                              |-> Rejected -> Resubmit
                      |-> Failed
```
Key behaviors:
- Drafts are created before AI generation.
- Generation failure sets status `failed`.
- Admin review updates `reviewed_by`, `reviewed_at`, `review_notes`.
- Approve and reject actions log audit trail records.
- Completion and email delivery update `completed_at` and `sent_at`.

## Core workflows

### User registration
- `/auth/signup` uses Supabase Auth for email/password signup.
- A DB trigger creates a `profiles` record with role `subscriber`.
- Users land in `/dashboard` after signup.

### Letter generation
- UI: `/dashboard/letters/new`.
- API: `POST /api/generate-letter`.
- Rate limit: `letterGenerationRateLimit` (5 per hour).
- Validation: `lib/validation/letter-schema.ts` + input sanitization.
- Allowance check: Supabase RPC `check_letter_allowance`.
- Deduction: RPC `deduct_letter_allowance` (atomic).
- AI generation: `lib/ai/openai-retry.ts` with retries and circuit breaker.
- Status flow: `draft` -> `generating` -> `pending_review`.
- Free trial: first letter allowed if no prior generation.

### Admin review
- Admin portal: `/secure-admin-gateway`.
- Auth: Supabase login + portal key + admin role.
- Admin session: cookie-based, 30 minute timeout.
- Review actions:
  - `POST /api/letters/[id]/start-review` -> status `under_review`.
  - `POST /api/letters/[id]/approve` -> status `approved` + final content.
  - `POST /api/letters/[id]/reject` -> status `rejected` + reason.
  - `POST /api/letters/[id]/improve` -> AI improvement.
- CSRF protection: admin action routes expose `GET` for CSRF token.
- Audit trail: `log_letter_audit` RPC.
- Notifications: `lib/email/service.ts` templates.

### Subscription and billing
- `POST /api/create-checkout` creates Stripe Checkout sessions.
- `POST /api/verify-payment` verifies Stripe session.
- `POST /api/subscriptions/activate` finalizes subscription on webhook.
- Monthly reset: `POST /api/subscriptions/reset-monthly` (cron guarded).
- Test mode: `ENABLE_TEST_MODE=true` bypasses Stripe and creates subscription directly.

### Employee referrals and commissions
- Employee referral link: `GET /api/employee/referral-link`.
- Coupon issuance: `employee_coupons` table.
- Commission tracking: `commissions` table with 5 percent default rate.
- Payouts: `POST /api/employee/payouts` and admin review.

### Email queue
- Emails are queued in `email_queue` and processed by cron.
- Cron route: `POST /api/cron/process-email-queue` (guarded by `CRON_SECRET`).
- Providers selected via `EMAIL_PROVIDER`.

### GDPR
- `POST /api/gdpr/accept-privacy-policy`.
- `POST /api/gdpr/delete-account`.
- `GET /api/gdpr/export-data`.

### Health and monitoring
- `GET /api/health` and `GET /api/health/detailed` return service status.
- `scripts/health-check.js` provides CLI health check.

## API routes (complete list)
All routes return JSON via `NextResponse.json` and use shared auth and error handling.

Auth and profile:
- `POST /api/auth/reset-password` - Supabase reset link.
- `POST /api/auth/update-password` - confirm reset and update.
- `POST /api/create-profile` - profile provisioning + welcome email.

Admin auth:
- `POST /api/admin-auth/login` - admin sign-in + portal key.
- `POST /api/admin-auth/logout` - clear admin session.
- `GET /api/admin/csrf` - admin CSRF token for protected actions.

Letters:
- `POST /api/generate-letter` - generate AI draft.
- `GET /api/letters/drafts` - list user drafts.
- `POST /api/letters/[id]/submit` - submit for review.
- `POST /api/letters/[id]/start-review` - admin starts review.
- `GET /api/letters/[id]/approve` - admin CSRF token.
- `POST /api/letters/[id]/approve` - approve letter.
- `GET /api/letters/[id]/reject` - admin CSRF token.
- `POST /api/letters/[id]/reject` - reject letter.
- `GET /api/letters/[id]/improve` - admin CSRF token.
- `POST /api/letters/[id]/improve` - admin improve action.
- `POST /api/letters/improve` - admin AI improve content.
- `POST /api/letters/[id]/complete` - mark completed.
- `POST /api/letters/[id]/send-email` - send status email.
- `POST /api/letters/[id]/resubmit` - resubmit after rejection.
- `DELETE /api/letters/[id]/delete` - delete user letter.
- `GET /api/letters/[id]/pdf` - generate PDF.
- `GET /api/letters/[id]/audit` - audit trail.

Admin letters and analytics:
- `GET /api/admin/letters` - list letters for admin.
- `POST /api/admin/letters/batch` - batch actions.
- `GET /api/admin/analytics` - analytics dashboard data.

Coupons:
- `GET /api/admin/coupons` - list coupons.
- `POST /api/admin/coupons/create` - create coupon.

Email queue:
- `GET /api/admin/email-queue` - queue status.

Subscriptions and billing:
- `POST /api/create-checkout` - create Stripe Checkout.
- `POST /api/verify-payment` - verify payment.
- `POST /api/subscriptions/activate` - activate subscription.
- `GET /api/subscriptions/check-allowance` - remaining credits.
- `GET /api/subscriptions/billing-history` - Stripe history.
- `POST /api/subscriptions/reset-monthly` - cron reset.

Employee:
- `GET /api/employee/referral-link` - referral URL.
- `POST /api/employee/payouts` - request payout.

GDPR:
- `POST /api/gdpr/accept-privacy-policy`.
- `POST /api/gdpr/delete-account`.
- `GET /api/gdpr/export-data`.

Cron:
- `POST /api/cron/process-email-queue` - email queue processor.

Health:
- `GET /api/health`.
- `GET /api/health/detailed`.

Stripe:
- `POST /api/stripe/webhook` - Stripe webhooks.

## Supabase and database
- Supabase Auth drives user identity.
- RLS policies ensure users only access their own records; admins have wider access.
- Key RPC functions:
  - `check_letter_allowance(u_id)`
  - `deduct_letter_allowance(u_id)`
  - `add_letter_allowances(u_id, amount)`
  - `log_letter_audit(p_letter_id, p_action, p_old_status, p_new_status, p_notes)`
  - `increment_total_letters(p_user_id)`
  - `get_employee_coupon(p_employee_id)`
- Migrations live in `supabase/migrations` and `scripts/*.sql`.

## Security and rate limiting
- Rate limits (Upstash + fallback):
  - Auth: 5 requests / 15 minutes.
  - Admin: 10 requests / 15 minutes.
  - API: 100 requests / 1 minute.
  - Letter generation: 5 requests / 1 hour.
  - Subscriptions: 3 requests / 1 hour.
- CSRF: Admin actions require a CSRF token cookie (`lib/security/csrf.ts`).
- Input sanitization: `lib/security/input-sanitizer.ts`.
- Validation: `lib/validation/letter-schema.ts`.
- Error handling: `lib/api/api-error-handler.ts`.
- CSP and security headers: `next.config.mjs`.
- Admin portal requires portal key plus role check.

## Email system
- Provider selection via `EMAIL_PROVIDER` (resend, brevo, sendgrid, smtp, console).
- Default sender is configured via `EMAIL_FROM` and `EMAIL_FROM_NAME`.
- Template sending via `lib/email/service.ts`.
- Queue processing via `app/api/cron/process-email-queue/route.ts`.

## Stripe integration
- Stripe client helper: `lib/stripe/client.ts` (sanitizes keys).
- Checkout flow: `app/api/create-checkout/route.ts`.
- Webhook handler: `app/api/stripe/webhook/route.ts`.
- Test mode bypass: `ENABLE_TEST_MODE=true`.

## AI generation
- `lib/ai/openai-retry.ts` handles retries and circuit breaker.
- Uses `ai` and `@ai-sdk/openai` with model `gpt-4-turbo`.
- Prompt input is sanitized and validated.

## PDF generation
- `lib/pdf/generator.ts` and `lib/pdf/index.ts` generate PDFs.
- PDFs served via `GET /api/letters/[id]/pdf`.

## Realtime updates
- Supabase Realtime subscription used in `components/generation-tracker-modal.tsx`.
- Updates status in near real time after admin review actions.

## Environment variables
Environment validation is enforced by `scripts/validate-env.js` and `npm run start:prod`.

Critical (always required):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

Production required (when NODE_ENV=production and ENABLE_TEST_MODE is false):
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ADMIN_EMAIL` (deprecated but still validated)
- `ADMIN_PORTAL_KEY`
- `CRON_SECRET`

Optional or feature flags:
- `NEXT_PUBLIC_APP_URL` (default http://localhost:3000)
- `NEXT_PUBLIC_SITE_URL` (links in email templates)
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` (signup override)
- `SUPABASE_HOSTNAME` (image CSP allowlist)
- `DATABASE_URL` (server-only)
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` (Upstash)
- `REDIS_URL` (health check only, not used by rate limiter)
- `EMAIL_PROVIDER`
- `EMAIL_FROM`, `EMAIL_FROM_NAME`
- `RESEND_API_KEY`, `BREVO_API_KEY`, `SENDGRID_API_KEY`
- `ENABLE_TEST_MODE`, `NEXT_PUBLIC_TEST_MODE`

Deprecated or legacy:
- `ADMIN_PASSWORD` (no longer used for admin auth)

## Commands and scripts
- `pnpm dev` - start dev server.
- `pnpm build` - production build.
- `pnpm lint` - lint.
- `pnpm start:prod` - validate env and start production server.
- `pnpm validate-env` - environment validation.
- `pnpm db:migrate` - run migrations (`scripts/run-migrations.js`).
- `pnpm health-check` - health check script.
- `pnpm audit --audit-level=high` - security audit.

## Admin management
- Admins are standard Supabase users with `profiles.role = 'admin'`.
- Create admins via `scripts/create-additional-admin.ts`.
- Portal key is required for admin login: `ADMIN_PORTAL_KEY`.
- Admin session timeout is 30 minutes (`lib/auth/admin-session.ts`).

## Design and UI conventions
- Tailwind + shadcn UI; use existing primitives in `components/ui`.
- Keep layout in `components/dashboard-layout.tsx` and admin layout components.
- Prefer consistent button variants defined in `components/ui/button.tsx`.

## Testing and validation
- Test mode is controlled by `ENABLE_TEST_MODE` and `NEXT_PUBLIC_TEST_MODE`.
- Test mode bypasses Stripe and creates subscriptions directly.
- Generation timeline modal uses Supabase Realtime and falls back to polling.
- Use `docs/STRIPE_SETUP.md` for local webhook setup.

## Deployment
- Production start command: `npm run start:prod` (validates env then `next start`).
- Vercel deployment uses `vercel.json` and environment variables set in Vercel.
- `next.config.mjs` sets output to `standalone` and applies CSP/security headers.

## Operational runbook
- If admin login fails, verify `ADMIN_PORTAL_KEY` and `profiles.role`.
- If rate limiting fails, check Upstash credentials and HTTPS URL format.
- If emails fail, check `EMAIL_PROVIDER` and provider API keys; use console provider in dev.
- If Stripe webhooks fail, validate `STRIPE_WEBHOOK_SECRET` and Stripe CLI setup.
- If health checks show Redis degraded, Upstash config is missing (fallback still works).

---

## Appendices (Reference Material)

### Appendix A: Database Schema (Core Tables)

#### Table: `profiles`
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('subscriber', 'employee', 'admin')),
  phone TEXT,
  company_name TEXT,
  is_super_user BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  bio TEXT,
  stripe_customer_id TEXT,
  total_letters_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `subscriptions`
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'pending', 'payment_failed', 'expired')),
  plan TEXT NOT NULL DEFAULT 'single_letter',
  plan_type TEXT,
  price NUMERIC(10,2) DEFAULT 299.00,
  discount NUMERIC(10,2) DEFAULT 0.00,
  coupon_code TEXT,
  employee_id UUID REFERENCES profiles(id),
  remaining_letters INTEGER DEFAULT 0,
  credits_remaining INTEGER DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ,
  stripe_session_id TEXT,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
```

#### Table: `letters`
```sql
CREATE TABLE letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'generating', 'pending_review', 'under_review', 'approved', 'completed', 'rejected', 'failed')),
  letter_type TEXT,
  recipient_name TEXT,
  recipient_address TEXT,
  subject TEXT,
  content TEXT,
  intake_data JSONB DEFAULT '{}',
  ai_draft_content TEXT,
  final_content TEXT,
  pdf_url TEXT,
  is_attorney_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  draft_metadata JSONB,
  notes TEXT,
  commission_id UUID REFERENCES commissions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `employee_coupons`
```sql
CREATE TABLE employee_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  discount_percent INTEGER DEFAULT 20 CHECK (discount_percent BETWEEN 0 AND 100),
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  max_uses INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `commissions`
```sql
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  subscription_amount NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,4) DEFAULT 0.0500,
  commission_amount NUMERIC(10,2) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'paid', 'cancelled')) DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `letter_audit_trail`
```sql
CREATE TABLE letter_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id UUID REFERENCES letters(id) ON DELETE CASCADE NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `email_queue`
```sql
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "to" TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  error TEXT,
  template_type TEXT,
  provider TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `admin_audit_log`
```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `payout_requests`
```sql
CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) DEFAULT 'bank_transfer',
  payment_details JSONB DEFAULT '{}',
  notes TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'rejected')) DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `fraud_detection_logs`
```sql
CREATE TABLE fraud_detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code TEXT NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  user_id UUID REFERENCES profiles(id),
  risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  action TEXT CHECK (action IN ('allow', 'flag', 'block')),
  reasons TEXT[],
  patterns JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Appendix B: Database RPC Functions

#### Letter Allowance Functions
```sql
-- Check available letter credits for user
CREATE OR REPLACE FUNCTION check_letter_allowance(u_id UUID)
RETURNS INTEGER LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT credits_remaining FROM subscriptions
     WHERE user_id = u_id AND status = 'active'
     ORDER BY created_at DESC LIMIT 1), 0);
$$;

-- Deduct one letter credit atomically
CREATE OR REPLACE FUNCTION deduct_letter_allowance(u_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE subscriptions
  SET credits_remaining = credits_remaining - 1
  WHERE user_id = u_id AND status = 'active' AND credits_remaining > 0;
  RETURN FOUND;
END;
$$;

-- Add credits based on plan type
CREATE OR REPLACE FUNCTION add_letter_allowances(sub_id UUID, plan TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  CASE plan
    WHEN 'single_letter' THEN
      UPDATE subscriptions SET credits_remaining = 1 WHERE id = sub_id;
    WHEN 'monthly' THEN
      UPDATE subscriptions SET credits_remaining = 4 WHERE id = sub_id;
    WHEN 'yearly' THEN
      UPDATE subscriptions SET credits_remaining = 52 WHERE id = sub_id;
  END CASE;
END;
$$;

-- Reset monthly/yearly allowances
CREATE OR REPLACE FUNCTION reset_monthly_allowances()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE subscriptions
  SET credits_remaining = CASE
    WHEN plan = 'monthly' THEN 4
    WHEN plan = 'yearly' THEN 52
    ELSE credits_remaining
  END,
  last_reset_at = NOW()
  WHERE status = 'active' AND plan IN ('monthly', 'yearly');
END;
$$;
```

#### Audit Functions
```sql
-- Log letter state transitions
CREATE OR REPLACE FUNCTION log_letter_audit(
  p_letter_id UUID,
  p_action TEXT,
  p_performed_by UUID DEFAULT NULL,
  p_old_status TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO letter_audit_trail (
    letter_id, action, performed_by, old_status, new_status, notes, metadata
  ) VALUES (
    p_letter_id, p_action, p_performed_by, p_old_status, p_new_status, p_notes, p_metadata
  ) RETURNING id INTO audit_id;
  RETURN audit_id;
END;
$$;

-- Increment total letters generated for user
CREATE OR REPLACE FUNCTION increment_total_letters(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET total_letters_generated = COALESCE(total_letters_generated, 0) + 1
  WHERE id = p_user_id;
END;
$$;
```

#### Commission Functions
```sql
-- Get commission summary for employee
CREATE OR REPLACE FUNCTION get_commission_summary(emp_id UUID)
RETURNS TABLE (
  pending_commissions DECIMAL,
  paid_commissions DECIMAL,
  total_earnings DECIMAL,
  pending_count INTEGER,
  paid_count INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0),
    COALESCE(SUM(commission_amount), 0),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'paid')
  FROM commissions WHERE employee_id = emp_id;
END;
$$;
```

#### Employee Functions
```sql
-- Get employee's coupon code
CREATE OR REPLACE FUNCTION get_employee_coupon(p_employee_id UUID)
RETURNS TABLE (
  id UUID,
  code TEXT,
  discount_percent INTEGER,
  is_active BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT ec.id, ec.code, ec.discount_percent, ec.is_active
  FROM employee_coupons ec
  WHERE ec.employee_id = p_employee_id;
END;
$$;
```

#### Admin Analytics Functions
```sql
-- Dashboard statistics
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE (
  total_users INTEGER,
  total_subscribers INTEGER,
  total_employees INTEGER,
  total_admins INTEGER,
  total_letters INTEGER,
  pending_letters INTEGER,
  approved_letters INTEGER,
  rejected_letters INTEGER,
  total_revenue DECIMAL
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles),
    (SELECT COUNT(*) FROM profiles WHERE role = 'subscriber'),
    (SELECT COUNT(*) FROM profiles WHERE role = 'employee'),
    (SELECT COUNT(*) FROM profiles WHERE role = 'admin'),
    (SELECT COUNT(*) FROM letters),
    (SELECT COUNT(*) FROM letters WHERE status IN ('pending_review', 'under_review')),
    (SELECT COUNT(*) FROM letters WHERE status = 'approved'),
    (SELECT COUNT(*) FROM letters WHERE status = 'rejected'),
    (SELECT COALESCE(SUM(price - discount), 0) FROM subscriptions WHERE status = 'active');
END;
$$;
```

### Appendix G: Error Codes Reference

| Code | HTTP | Description | Retryable | Used In |
|------|------|-------------|-----------|---------|
| `AUTH_REQUIRED` | 401 | Authentication required | No | All protected routes |
| `INVALID_CREDENTIALS` | 401 | Invalid email/password | No | `/api/admin-auth/login` |
| `ADMIN_PORTAL_KEY_INVALID` | 401 | Admin portal key mismatch | No | `/api/admin-auth/login` |
| `INSUFFICIENT_PERMISSIONS` | 403 | Role lacks access | No | Admin/employee routes |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Yes | All rate-limited routes |
| `VALIDATION_ERROR` | 400 | Input validation failed | No | POST/PUT routes |
| `LETTER_ALLOWANCE_EXCEEDED` | 402 | No credits remaining | No | `/api/generate-letter` |
| `INVALID_COUPON` | 400 | Coupon invalid/expired | No | `/api/create-checkout` |
| `EXTERNAL_SERVICE_ERROR` | 502 | OpenAI/Stripe/Email failed | Yes | External service calls |
| `INTERNAL_ERROR` | 500 | Unexpected error | Uncertain | Catch-all |

### Appendix H: Migration Execution Order

Execute in sequence for clean database setup:

1. `scripts/001_setup_schema.sql` - Core tables (profiles, subscriptions, letters)
2. `scripts/002_setup_indexes.sql` - Performance indexes
3. `scripts/003_add_admin_column.sql` - Admin role column
4. `scripts/004_add_stripe_columns.sql` - Stripe integration fields
5. `scripts/005_add_plan_type.sql` - Plan type enumeration
6. `scripts/006_add_commission_status.sql` - Commission status tracking
7. `scripts/007_add_commission_cancelled.sql` - Commission cancellation
8. `scripts/008_add_email_queue.sql` - Email queue tables
9. `scripts/009_add_admin_audit_log.sql` - Admin audit logging
10. `scripts/010_add_payout_requests.sql` - Payout request system
11. `scripts/011_add_fraud_detection_tables.sql` - Fraud detection tables
12. `scripts/012_add_letter_commission_columns.sql` - Letter-commission linkage
13. `scripts/013_add_has_used_free_trial.sql` - Free trial tracking
14. `scripts/014_add_credits_remaining.sql` - Credit allowance system
15. `scripts/015_add_letter_commission_id.sql` - Letter-commission foreign key
16. `scripts/016_update_letter_indexes.sql` - Letter query optimization
17. `scripts/017_add_letter_metadata.sql` - Letter metadata field
18. `scripts/018_add_coupon_uses_fields.sql` - Coupon usage limits
19. `scripts/019_add_letter_commission_link.sql` - Commission tracking
20. `scripts/020_add_profile_totals.sql` - Profile aggregate fields
21. `scripts/021_add_profile_total_letters.sql` - Letter count tracking
22. `scripts/022_add_profile_completed_counts.sql` - Completed letter counts
23. `scripts/023_add_fraud_detection_tables.sql` - Fraud detection tables
24. `supabase/migrations/*.sql` - Supabase CLI migrations (timestamp order)
