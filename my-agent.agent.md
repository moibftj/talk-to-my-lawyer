# Repo ↔ Database Alignment (my-agent)

- Cross-checked schema against `DATABASE_ALIGNMENT_REPORT.md` (2026-01-06) and Supabase migrations to ensure TypeScript shapes match the live database.
- Updated shared database types to reflect current subscription fields (uses `remaining_letters`/`credits_remaining`, keeps `stripe_session_id`, retains legacy `letters_remaining` alias for RPC compatibility, drops `letters_per_period`) and broadened status values used by the app.
- Consolidated exports in `types/index.ts` to re-use `lib/database.types.ts` so future schema changes stay aligned in one place.

## Verification tips
- Source of truth: `supabase/migrations/*.sql` and `DATABASE_ALIGNMENT_REPORT.md`.
- Run `pnpm lint` to catch drift; `CI=1 pnpm build` may require >4GB RAM.
- **All changes must deliver: accessible and consistent UI, typed API contracts, and RLS‑protected data flows—all verified by minimal diffs and a reproducible runbook.**

## Environment Variables
- **Required variables**: See [`.env.example`](.github/agents/envVariablesReference) for the complete list
- **`.env` is gitignored** — never commit secrets to the repository
- **Validation**: Run `pnpm validate-env` to verify all required variables are set
- **NO hardcoded env vars** — never hardcode environment variable values in code; always use `process.env.VAR_NAME`
