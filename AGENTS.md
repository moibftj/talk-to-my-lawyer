# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds the Next.js App Router pages and API routes (e.g., `app/api/*/route.ts`).
- `components/` contains shared React UI; `components/ui/` hosts shadcn/ui primitives.
- `lib/` is for shared utilities, API helpers, and design tokens (`lib/design-tokens.ts`).
- `styles/` and `app/globals.css` manage Tailwind and global styling.
- `public/` stores static assets; `supabase/` contains migrations and SQL.
- `scripts/` includes automation (health checks, migrations, security scans).
- `docs/` is the source of truth for setup, architecture, testing, and operations.

## Build, Test, and Development Commands
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
- This project relies on manual testing (see `docs/TESTING.md`).
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
