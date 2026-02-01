# Repo-specific commands and paths

## Paths
- `lib/database.types.ts` (canonical DB types)
- `supabase/migrations/` (SQL migrations)
- `scripts/run-migrations.js` (used by `pnpm db:migrate`)
- `deploy-migrations.sh` (remote migration runner)
- `lib/supabase/types.ts` (expects `Database` type)
- `lib/types/index.ts`, `lib/types/api.ts`, `lib/types/letter.types.ts` (re-exports)

## Migrations
- Local/target DB: `pnpm db:migrate` (requires `DATABASE_URL` or `POSTGRES_URL`)
- Remote: `./deploy-migrations.sh` (reads `.env.local` and `SUPABASE_DB_*`)

## Generate raw Supabase types (temp file)
Preferred helper:
- `skills/sync-supabase-types/scripts/gen-supabase-types.sh --out /tmp/supabase.types.ts`
- `skills/sync-supabase-types/scripts/gen-supabase-types.sh --dry-run`

Preferred (uses DB URL):
- `pnpm exec supabase gen types typescript --db-url "$DATABASE_URL" --schema public > /tmp/supabase.types.ts`

If using `POSTGRES_URL`:
- `pnpm exec supabase gen types typescript --db-url "$POSTGRES_URL" --schema public > /tmp/supabase.types.ts`

Fallback (project id from docs/DATABASE.md):
- `pnpm exec supabase gen types typescript --project-id nomiiqzxaxyxnxndvkbe --schema public > /tmp/supabase.types.ts`
- Requires `supabase login` and access to the project.

## Validation checks
- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm build`
