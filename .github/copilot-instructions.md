# Copilot Instructions for Talk-To-My-Lawyer

AI legal letter drafting platform. **Every AI-generated letter must pass attorney/admin review before subscriber access.** See [AGENTS.md](../AGENTS.md) for the API routes list (“API Routes (detailed)”), types reference (“Types (centralized)”), and email debugging protocols (“Email Debugging Protocol (All User Types)”).

## Architecture Overview

Next.js 16 App Router + React 19 | Supabase (Postgres + RLS) | Stripe payments | Resend email | OpenAI SDK | Upstash Redis rate limiting | Tailwind v4 + shadcn/ui (new-york style). Deployed on Vercel (region `iad1`). Use **pnpm only**.

**4 roles**: Subscriber (generates letters), Employee (coupons/commissions, never sees letter content), Attorney Admin (reviews/edits/approves letters), Super Admin (full platform access). Role checks happen at the API route level, not in middleware.

**Letter lifecycle**: `draft` → `pending_review` → `under_review` → `approved` | `rejected` | `needs_changes` → `completed` (terminal). The status machine is defined in `lib/constants/statuses.ts`.

## Key Conventions

### API Routes (`app/api/*/route.ts`)

Standard flow: **rate-limit → auth → validate → business logic → response**. Errors are caught via shared `handleApiError()` from `lib/api/api-error-handler.ts`. Use the custom error classes (`AuthenticationError`, `AuthorizationError`, `ValidationError`, `NotFoundError`, `RateLimitError`) — they auto-map to correct HTTP status codes. Auth is enforced with throw-based `require*()` functions from `lib/auth/`:

```ts
const user = await requireAuth(request); // any authenticated user
const user = await requireSubscriber(request); // subscriber role
const session = await requireAdminSession(request); // admin portal session
```

### Supabase Clients

- **Server** (per-request, respects RLS): `createClient()` from `lib/supabase/server.ts` — use in server components and API routes
- **Browser** (singleton): `createClient()` from `lib/supabase/client.ts` — use in `'use client'` components
- **Admin/service-role** (bypasses RLS): only for system-level operations — never for user-facing queries

### Component Patterns

- **Pages** are server components (async, fetch data with server Supabase client)
- **Layouts and interactive shells** (e.g., `components/dashboard-layout.tsx`) are `'use client'`
- Use `@/` path alias (maps to project root): `import { Button } from '@/components/ui/button'`
- Styling: use design tokens from `lib/design-tokens.ts` (`statusColors`, `roleColors`) instead of hardcoding Tailwind color classes
- Add shadcn components via: `pnpm dlx shadcn@latest add <component>`

### Types

- Database types: auto-generated in `lib/database.types.ts`
- API/letter/AI types: `lib/types/` (re-exported from `types/index.ts`)
- Use `LETTER_STATUSES` and `USER_ROLES` constants from `lib/types/api.ts` — no magic strings

### Environment Variables

`lib/env.ts` validates only Supabase keys at startup. Other vars (`OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, etc.) are accessed directly via `process.env`. Always add new vars to both `.env.local` and Vercel Dashboard. Validate with `pnpm validate-env`.

## Development Commands

```
pnpm dev              # local dev server (localhost:3000)
pnpm lint             # ESLint — run before every PR
CI=1 pnpm build       # strict production build — must pass before merge
pnpm test             # Vitest (happy-dom env, @testing-library)
pnpm validate-env     # check required env vars
pnpm db:migrate       # apply Supabase SQL migrations
pnpm security:scan    # audit for vulnerabilities
```

## Critical Rules

- **Never disable Supabase RLS** — all user-facing queries go through RLS-enabled clients
- **Never log secrets or PII** — prompts and model outputs are stored for audit, not logged to console
- **Employees must never see letter content** — enforce in both API and UI layers
- **Letter approval requires attorney/admin review** — no auto-approval paths
- **Email**: confirmation emails come from Supabase Auth (SMTP config); app emails use Resend + queue. Debug with [lib/email/AGENTS.md](../lib/email/AGENTS.md) (“Quick Diagnostic Checklist”).
- **Cron jobs** are configured in `vercel.json` (5 jobs: email queue, session cleanup, health check, analytics, weekly cleanup)
