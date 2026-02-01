---
name: sync-supabase-types
description: Sync Supabase database schema types with the codebase and fix TypeScript type errors after migrations. Use when updating `lib/database.types.ts`, applying migrations in `supabase/migrations`, reconciling DB enums/tables with app types, or resolving lint/tsc/build failures caused by schema drift.
---

# Sync Supabase Types

## Overview
Sync Supabase schema changes into `lib/database.types.ts`, then resolve TypeScript errors caused by schema drift. Use this workflow after migrations or whenever DB-related types break lint, tsc, or build.

See `references/repo-workflow.md` for repo-specific commands and paths.

## Workflow Decision
- Apply migrations first if schema changed.
- Regenerate raw types to a temp file and merge into `lib/database.types.ts`.
- Fix remaining TypeScript errors and re-run checks.

## Step 1: Confirm Scope and Target DB
- Identify the DB environment to sync (local, staging, prod).
- Ensure DB connection env vars exist (do not log secrets).
- Decide if migrations must be applied before generating types.

## Step 2: Apply Migrations (if schema changed)
- Run the repo migration script for the target DB.
- Confirm migrations completed successfully before generating types.

## Step 3: Regenerate and Merge Types
- Generate raw Supabase types to a temp file (do not overwrite `lib/database.types.ts` yet).
- Preferred: run `scripts/gen-supabase-types.sh` (see `references/repo-workflow.md`).
- Diff the temp file against `lib/database.types.ts` and update:
  - enums (union literals)
  - table interfaces (Row/Insert/Update shapes, nullability)
  - `Database` schema: Tables, Views, Functions, Enums, CompositeTypes
- Preserve any custom helper interfaces and additions used across the app.

## Step 4: Align Re-exports and Dependent Types
- Keep `Database` exported and shaped for `lib/supabase/types.ts`.
- Update re-exports if types are added or renamed:
  - `lib/types/index.ts`
  - `lib/types/api.ts`
  - `lib/types/letter.types.ts`

## Step 5: Fix Type Errors and Validate
- Run checks in order (lint, tsc, build).
- Fix errors in code or types; avoid `any` unless unavoidable.
- Re-run checks until clean.

## Common Fix Patterns
- Nullable columns: add `| null` and update UI/logic guards.
- New columns: update interfaces and any select/insert payloads.
- Renamed tables/columns: update imports and query paths.
- Supabase query results: use `Database["public"]["Tables"]["<table>"]["Row"]` for strong typing.

## Resources

### scripts/
- `scripts/gen-supabase-types.sh` generates raw types to a temp file for diffing.

### references/
- `references/repo-workflow.md` contains repo-specific commands and paths.
