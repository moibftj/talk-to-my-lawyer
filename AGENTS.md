# Agent Handbook for Talk-To-My-Lawyer

This repository is a Next.js 16 (React 19, TypeScript, Tailwind) SaaS for AI-assisted legal letter generation with attorney review, Supabase auth/DB, Stripe billing, and Upstash rate limiting. Use **pnpm** (packageManager=pnpm@10.25.0). Prefer functional React components with server actions and API routes under `app/api`.

## Required workflows
- Always run **`pnpm lint`** and **`CI=1 pnpm build`** before delivery; use Turbopack build output to validate route generation and type checks.
- Keep Supabase auth + rate limit helpers (`@/lib/auth/*`, `@/lib/rate-limit[-redis]`) and shared error handling patterns when touching API routes.
- Avoid adding new package-locks; keep `pnpm-lock.yaml` canonical.
- Environment validation relies on `scripts/validate-env.js`; production starts via `npm run start:prod` (runs validation then `next start`).

## Directory map and responsibilities
- **app/**: Next.js App Router UI + API routes.
  - **Root marketing**: `app/page.tsx` (landing), layout at `app/layout.tsx`.
  - **Auth flows**: `app/auth/login|signup|check-email|reset-password|forgot-password/page.tsx` with Supabase client helpers.
  - **Customer dashboard** (`app/dashboard`): layout + pages for home, letters (list/new/detail), coupons, referrals, employee settings, subscription, billing, commissions, payouts, settings.
  - **Admin gateway** (`app/secure-admin-gateway`): login + portal key screen; dashboard pages for analytics, email queue, letters (all/review), coupons, users, commissions; review detail page (`review/[id]`).
  - **API routes** (`app/api`): Next.js Route Handlers (see full list below) using shared auth/rate limit/error logging utilities.
- **components/**: UI + feature widgets.
  - Feature components: `dashboard-layout.tsx`, `letter-actions.tsx`, `generate-button.tsx`, `generation-tracker-modal.tsx`, `subscription-card.tsx`, `subscription-modal.tsx`, `coupon-card.tsx`, `coupon-insights-card.tsx`, `payment-verifier.tsx`, `review-letter-modal.tsx`, `review-status-modal.tsx`, `pay-commission-button.tsx`, `success-message.tsx`, `theme-provider.tsx`.
  - Admin UI: `admin-logout-button.tsx`, `admin/admin-header.tsx`, `admin/admin-nav.tsx`, `admin/admin-sidebar.tsx`, `admin/letter-review-interface.tsx`, `admin/review-letter-actions.tsx`.
  - UI kit (Radix/shadcn/Tailwind primitives + hooks): accordion, alert(-dialog), animated-button, aspect-ratio, avatar, badge, breadcrumb, buttons (`button.tsx`, `button-2.tsx`, `button-group.tsx`), calendar, canvas, card, carousel/chart, checkbox, collapsible, command, context-menu, dialog/drawer, dropdown-menu, empty state, enhanced hero, field/form, generate-letter-button, hero, hover-card, input (+ group/otp), item/kbd/label, menubar, navigation-menu, pagination, popover, pricing-section, progress, radio-group, resizable, rich-text-editor, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner/toast/toaster, spinner, switch, table, tabs, text-morph, textarea, timeline-animation, toggle(+group), tooltip, use-mobile/use-toast hooks.
- **hooks/**: lightweight wrappers (`use-mobile.ts`, `use-toast.ts`).
- **lib/**: server utilities and domain logic.
  - Auth: `auth/admin-guard.ts`, `auth/admin-session.ts`, `auth/authenticate-user.ts`, `auth/get-user.ts`, Supabase clients (`supabase/client.ts`, `server.ts`, `config.ts`, middleware).
  - Rate limiting: `rate-limit-redis.ts`, `rate-limit.ts` with shared limiters.
  - Admin: `admin/config-validator.ts`, `admin/init.ts`, `admin/letter-actions.ts`.
  - AI: `ai/openai-retry.ts` retry wrapper.
  - Email: providers (`brevo`, `resend`, `sendgrid`, `smtp`, `console`), queue + service + templates + types + provider verifier.
  - Errors/logging: `errors/*`, `logging/*`, monitoring health check.
  - PDF: `pdf/generator.ts` + `index.ts` + `types.ts`.
  - Security: CSRF (`security/csrf.ts`), input sanitizer, utils/retry, constants/design tokens.
  - Fraud detection: `fraud-detection/coupon-fraud.ts`.
  - Validation: `validation/letter-schema.ts` schemas.
- **types/**: shared domain types (`types/index.ts`); Supabase types live at `lib/database.types.ts`.
- **supabase/**: SQL migrations under `supabase/migrations`; configuration in `supabase` dir and scripts under `scripts/` (`run-migrations.js`, `validate-env.js`, `health-check.js`, etc.).
- **styles/**: Tailwind/global styles.
- **public/**: static assets.
- **config**: Next config (`next.config.mjs`), ESLint (`eslint.config.mjs`), PostCSS/Tailwind setup, Vercel config (`vercel.json`), instrumentation (`instrumentation.ts`), type config (`tsconfig.json`).

## API route catalogue and duties
All routes live under `app/api` and use structured JSON responses, Supabase auth, and Upstash/in-memory rate limiters:
- **Auth**: `auth/reset-password`, `auth/update-password` handle Supabase password resets.
- **Profiles**: `create-profile` provisions user profiles with optional employee coupon bootstrap and welcome email.
- **Admin auth**: `admin-auth/login`, `admin-auth/logout` manage admin sessions with portal key + rate limiting.
- **Letters lifecycle**: `generate-letter`, `letters/drafts`, `letters/improve`, `letters/[id]/submit|improve|approve|reject|complete|delete|resubmit|start-review|send-email|pdf|audit` cover creation, AI generation, review state transitions, audit retrieval, PDF export, and messaging.
- **Admin letters batch/analytics**: `admin/letters`, `admin/letters/batch`, `admin/analytics` supply dashboards.
- **Coupons**: `admin/coupons` list; `admin/coupons/create` mutates.
- **Subscriptions & billing**: `create-checkout`, `verify-payment`, `subscriptions/activate`, `subscriptions/billing-history`, `subscriptions/check-allowance`, `subscriptions/reset-monthly` manage Stripe checkout, allowance tracking, and status resets.
- **Employee**: `employee/referral-link`, `employee/payouts` handle referral codes and payouts; `admin/email-queue` lists queued emails.
- **GDPR**: `gdpr/accept-privacy-policy`, `gdpr/delete-account`, `gdpr/export-data` support privacy workflows.
- **Health**: `health`, `health/detailed` operational checks; `cron/process-email-queue` processes email backlog.
- **Stripe webhook**: `stripe/webhook` receives events with signature verification.

## Data and workflows
- **Auth & roles**: Supabase Auth with profiles keyed by user ID; roles `subscriber`, `employee`, `admin`. Admin portal additionally checks `ADMIN_PORTAL_KEY` and CSRF tokens for write actions.
- **Letters**: `letters` table tracks lifecycle from draft → generating → pending_review → under_review → approved/rejected/completed/failed; audit trail stored separately. AI drafts via OpenAI (fallback to Google AI defined in `lib/ai/openai-retry.ts`). Admin review routes update status, notes, and trigger emails.
- **Subscriptions & coupons**: Stripe checkout sessions attach plan metadata; coupons validated with fraud detection; allowances deducted during generation; employee referrals create commission records.
- **Email**: Provider-agnostic service with queueing; templates for welcome, letter updates, subscription confirmation, etc.; queue processor route handles retries.
- **PDF**: `lib/pdf/generator.ts` builds letter PDFs for download/email.
- **Rate limiting & security**: Upstash Redis-backed limiters with in-memory fallback; CSRF tokens for admin review actions; input sanitization before storage.

## Coding conventions
- Prefer TypeScript/ES modules; never wrap imports in try/catch. Keep error handling in route handlers using existing helpers. Maintain consistent `NextResponse.json` payloads and logging tags. Ensure client components declare `'use client'` where required. Keep styles with Tailwind/shadcn patterns and avoid mixing package managers.

