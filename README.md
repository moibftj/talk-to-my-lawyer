# Talk-To-My-Lawyer

AI-powered legal letter drafting with **mandatory attorney review**. This Next.js (App Router) app uses Supabase for auth + data, Stripe for payments, Resend for email, and Vercel AI SDK (OpenAI) for generation. Subscribers request letters, attorneys approve, and everything is audited.

## Quick links
- Setup & configuration: [`docs/SETUP_AND_CONFIGURATION.md`](docs/SETUP_AND_CONFIGURATION.md)
- Architecture & development guide: [`docs/ARCHITECTURE_AND_DEVELOPMENT.md`](docs/ARCHITECTURE_AND_DEVELOPMENT.md)
- API & integrations: [`docs/API_AND_INTEGRATIONS.md`](docs/API_AND_INTEGRATIONS.md)
- Deployment guide: [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md)
- Email system: [`lib/email/AGENTS.md`](lib/email/AGENTS.md)

## Key features
- AI letter drafting with Vercel AI SDK (OpenAI) and auditable prompts/responses
- Attorney review center (Super Admin & Attorney Admin) with approvals/rejections and audit logs
- Subscription + credit allowance system with Stripe Checkout, coupons, and employee commissions
- Production email stack (Resend primary, queue with cron processor, templated notifications)
- Upstash Redis rate limiting, Supabase RLS, and role-scoped access everywhere
- Admin analytics dashboards and PDF export for approved letters

## Tech stack
- **Frontend/SSR**: Next.js 16 (App Router), React 19, Tailwind + shadcn/ui
- **Backend**: Supabase (Postgres + RLS), Stripe, Resend, Upstash Redis
- **AI**: `ai` + `@ai-sdk/openai` (default model: gpt-4-turbo)
- **Observability**: OpenTelemetry tracing hooks
- **Tooling**: TypeScript, ESLint, Vitest, pnpm (only)

## Getting started (local)
1) Prereqs: Node 20+ and pnpm (`packageManager=pnpm@10.28.0`).
2) Install deps: `pnpm install`
3) Configure env: copy `.env.example` → `.env.local`, fill required keys (Supabase, Stripe, OpenAI, Resend). Validate with `pnpm validate-env`.
4) Run dev server: `pnpm dev` (http://localhost:3000)
5) Optional: apply Supabase migrations to your project before hitting APIs: `pnpm db:migrate`.

## Core workflows (high level)
- **Letter generation**: `/api/generate-letter` enforces rate limit → auth (subscriber) → allowance check/deduct → AI draft → status `pending_review`.
- **Attorney review**: Admin portal (`/secure-admin-gateway`) moves letters through `pending_review` → `under_review` → approve/reject/improve, with audit logging and emails.
- **Payments**: `/api/create-checkout` for Stripe sessions, coupons/commissions, webhooks for fulfillment; allowance resets per subscription period.
- **Email**: templated notifications + queue processor at `/api/cron/process-email-queue`; confirmation emails handled by Supabase Auth SMTP.

## Development scripts
- `pnpm dev` — run locally
- `pnpm lint` — ESLint
- `CI=1 pnpm build` — production build (stricter)
- `pnpm validate-env` — ensure required env vars are set
- `pnpm db:migrate` — apply Supabase SQL migrations
- `pnpm test` — Vitest suite

## Conventions & guardrails
- Use **pnpm only**; no npm/yarn lockfiles.
- Respect Supabase RLS and role checks; do not log secrets.
- Keep admin/auth helpers on API routes; reuse shared error handling in `lib/api/api-error-handler.ts`.
- Run lint and build before delivery; enable test mode only outside production (`ENABLE_TEST_MODE=false` in prod).

## Deployment
- Primary target: Vercel. Ensure all env vars are set in the Vercel dashboard and migrations are applied to the Supabase project before deploy.
- Production readiness checklist lives in [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md) and the implementation plan (`docs/Talk-to-My-Lawyer_Implementation_Plan.md`).

## Troubleshooting
- Email issues: follow the playbook in `lib/email/AGENTS.md` and `docs/EMAIL_*` (SMTP vs. app emails). Run `node check-email-config.js` and `node test-email-send.js` as needed.
- Database/allowance/checkout races: see the P0 fixes in [`docs/Talk-to-My-Lawyer_Implementation_Plan.md`](docs/Talk-to-My-Lawyer_Implementation_Plan.md).
- For more docs, start at [`docs/README.md`](docs/README.md).
