# Migration Troubleshooting

Use this guide when MCP migration or storage operations fail.

## Migration Fails With SQL Syntax Error
- Validate raw SQL first in a SQL editor.
- Escape double quotes before embedding SQL into JSON payloads.
- Collapse newlines if your MCP wrapper requires one-line input.
- Retry with a minimal statement to isolate bad segments.

## Migration Appears Applied Locally But Not Remotely
- Confirm the exact `project_id`.
- Re-run `list_migrations` and search for the migration name.
- Query expected schema changes directly with `execute_sql`.
- Check Postgres logs (`get_logs`, service `postgres`) for runtime errors.

## Migration Fails Because Objects Already Exist
- Update migration to be idempotent:
  - `CREATE TABLE IF NOT EXISTS`
  - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
  - `CREATE OR REPLACE FUNCTION`
  - `DROP POLICY IF EXISTS` before `CREATE POLICY`

## Storage Policies Not Visible After Apply
- Apply storage statements through `execute_sql` rather than `apply_migration`.
- Ensure storage RLS is enabled:
  - `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`
- Query `pg_policy` for `storage.objects` directly.

## Permission Denied During Runtime
- Verify policy coverage for the exact role (`authenticated`, `anon`, service role).
- Test policy predicates in SQL with explicit sample values.
- Verify helper functions referenced by policies (for example `is_admin()`) exist and return expected values.

## RLS Performance Advisory (InitPlan)
- Replace direct `auth.uid()` references:
  - Slow: `user_id = auth.uid()`
  - Better: `user_id = (SELECT auth.uid())`
- Re-check advisors after policy updates.

## Partial Apply / Mid-Run Failure
- Stop further applies.
- Determine last confirmed applied migration.
- Fix the failed migration SQL.
- Re-run from the failed migration onward only.
- Document remediation in the sync report.

## Lock Contention or Timeouts
- Retry during lower traffic window.
- Keep migrations scoped and short where possible.
- Break very large DDL changes into smaller migrations if safe.

## Useful Diagnostic Queries
```sql
-- Verify a table/column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'your_table';

-- Verify storage bucket exists
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'bucket-name';

-- Verify policies
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass
ORDER BY polname;
```
