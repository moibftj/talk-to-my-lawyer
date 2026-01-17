````markdown
# Repository Guidelines

## Email System Quick Reference

**IMPORTANT**: Email issues are common. Follow these nested protocols:

### Email Debugging Protocol (All User Types)

When emails aren't working for subscribers, employees, attorneys, or admins:

1. **Check Environment Variables**:

   ```bash
   node check-email-config.js
   ```

   Required: `RESEND_API_KEY`, `EMAIL_FROM`, Supabase keys

2. **Check Supabase Auth Emails** (Confirmation emails):
   - These are NOT sent by our app
   - Configure in Supabase Dashboard → Authentication → Email
   - Must set SMTP settings or disable confirmation
   - See [docs/SUPABASE_EMAIL_SETUP.md](docs/SUPABASE_EMAIL_SETUP.md) (create if missing)

3. **Check Application Emails** (Welcome, notifications):
   - See [lib/email/AGENTS.md](lib/email/AGENTS.md) for detailed diagnostics
   - Test: `node test-email-send.js`
   - Check queue: Query `email_queue` table

4. **Verify Vercel Environment**:
   - All email env vars must be in Vercel Dashboard
   - Redeploy after adding variables

### Email System Structure

- `lib/email/` - Core email service → See [lib/email/AGENTS.md](lib/email/AGENTS.md)
- `lib/email/templates.ts` - 18 email templates → See [lib/email/templates/AGENTS.md](lib/email/templates/AGENTS.md)
- `lib/email/queue.ts` - Retry logic → See [lib/email/queue/AGENTS.md](lib/email/queue/AGENTS.md)
- `app/api/cron/process-email-queue/` - Queue processor → See [app/api/cron/AGENTS.md](app/api/cron/AGENTS.md)

### Email Flow by User Type

**Subscribers**:

- Confirmation email → Supabase Auth (needs SMTP config)
- Welcome email → `/api/create-profile` (immediate send)
- Letter notifications → Attorney actions (queued)

**Employees**:

- Same as subscribers + commission emails

**Attorneys/Admins**:

- Confirmation → Supabase Auth
- Admin alerts → Queued notifications

## Letter Generation Flow (overview)

This repo implements an end-to-end supervised letter generation workflow where AI drafts are always subject to attorney/admin review before being released to subscribers.

- UI: Subscribers fill the letter request form in the dashboard and click `Generate`. The client validates input and calls `POST /api/generate-letter` with the user's auth session.
- API: The `POST /api/generate-letter` endpoint applies rate-limiting, authenticates the user, validates the request, and checks allowance/credits. The server builds a constrained, auditable prompt from sanitized input and profile data.
- AI: The server invokes the model (ChatGPT-4 Turbo) via the provider client and stores prompts + responses for auditability. The returned draft is persisted with status `draft` or `awaiting_review`.
- Review: Both System Admin and Attorney Admin may review drafts via `/secure-admin-gateway` or `/attorney-portal`. Reviewers can edit, approve, or reject (with reason). All edits and review actions are logged in `admin_audit_log` and letter audit tables.
- Post-approval (subscriber): Once approved the letter is visible in the subscriber's "My Letters" area. Subscribers can:
  - Preview the approved letter in-app (preview modal).
  - Download the approved letter as a PDF via `GET /api/letters/[id]/pdf`.
  - Request sending the letter to a recipient via the application's attorney/system email using `POST /api/letters/[id]/send-email` (queued and auditable).

Security & audit: prompts, model outputs, and review actions are retained for compliance; RLS and role checks ensure drafts are not exposed to unauthorized employees.

### Common Email Issues

| Issue                  | Solution                              | Where to Look                                                  |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------- |
| No confirmation emails | Configure Supabase Auth SMTP          | [docs/AGENTS.md#supabase-emails](docs/AGENTS.md)               |
| No welcome emails      | Check `/api/create-profile` is called | [app/api/AGENTS.md](app/api/AGENTS.md)                         |
| Emails stuck in queue  | Check cron job running                | [lib/email/queue/AGENTS.md](lib/email/queue/AGENTS.md)         |
| Template errors        | Check template data                   | [lib/email/templates/AGENTS.md](lib/email/templates/AGENTS.md) |
| Resend errors          | Check API key & domain                | [lib/email/AGENTS.md#resend-config](lib/email/AGENTS.md)       |

## Project Structure & Module Organization

- `app/` holds the Next.js App Router pages and API routes (e.g., `app/api/*/route.ts`).
- `components/` contains shared React UI; `components/ui/` hosts shadcn/ui primitives.
- `lib/` is for shared utilities, API helpers, and design tokens (`lib/design-tokens.ts`).
- `styles/` and `app/globals.css` manage Tailwind and global styling.
- `public/` stores static assets; `supabase/` contains migrations and SQL.
- `scripts/` includes automation (health checks, migrations, security scans).
- `docs/` is the source of truth for setup, architecture, testing, and operations.
- `proxy.ts` is the Next.js request proxy.

## Build and Development Commands

- `pnpm dev` starts the local development server.
- `pnpm lint` (or `pnpm lint:fix`) runs ESLint; required before delivery.
- `CI=1 pnpm build` runs a stricter production build.
- `pnpm validate-env` validates environment variables.
- `pnpm db:migrate` applies Supabase migrations.
- `pnpm precommit` runs lint + audit; `pnpm security:scan` checks for secrets.

## Coding Style & Naming Conventions

- TypeScript + React functional components; prefer hooks and keep `'use client'` only where interactivity is needed.
- Follow existing file style (commonly 2-space indentation and mixed quotes); keep edits consistent within the file.
- Tailwind CSS is the primary styling method; reuse tokens in `lib/design-tokens.ts`.
- Naming: components in PascalCase, hooks in `useX` form, route handlers as `route.ts`.

## Testing Guidelines

- Manual testing is the primary validation method (see `docs/TESTING.md`).
- Enable test mode via `ENABLE_TEST_MODE="true"` and `NEXT_PUBLIC_TEST_MODE="true"`.
- Use Stripe test card `4242 4242 4242 4242` and emails like `test+{type}@example.com`.
- Helpful scripts: `node test-email-send.js`, `node scripts/test-supabase-connection.js`.

## Commit & Pull Request Guidelines

- Commit messages follow conventional prefixes seen in history: `feat:`, `fix:`, `docs:` (keep them specific and imperative).
- Before opening a PR, run `pnpm lint`, `CI=1 pnpm build`, and `pnpm security:scan`.
- PRs should include a clear summary, test plan/results, linked issue(s), and screenshots for UI changes; call out migrations or env changes.

## Security & Configuration Tips

- Never commit secrets; use `.env.local` and GitHub Secrets for production.
- Restart the dev server after env changes; validate with `pnpm validate-env`.
````
