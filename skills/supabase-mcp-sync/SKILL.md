---
name: supabase-mcp-sync
description: Synchronize repository Supabase migrations with a target Supabase project through the MCP connector. Use when checking pending migrations, applying migrations in strict order, configuring storage buckets and RLS policies, validating role-based access, troubleshooting migration failures, and generating auditable sync reports.
---

# Supabase MCP Sync

## Overview
Synchronize local SQL migrations to Supabase safely and deterministically. Apply pending migrations sequentially, handle storage/RLS setup with idempotent SQL, verify final state, and produce a sync report for auditability.

## Core Workflow
1. List projects and select the target `project_id`.
2. Fetch applied migrations from Supabase.
3. Compare local files with applied migrations.
4. Apply pending migrations in chronological order.
5. Configure storage bucket and storage RLS policies (if required).
6. Verify bucket/policies and run performance advisors.
7. Generate a sync report from template.

## 1) List Available Projects
```bash
manus-mcp-cli tool call list_projects --server supabase
```
Record the target `project_id` for all subsequent steps.

## 2) Check Pending Migrations
```bash
# Export applied migrations from Supabase
manus-mcp-cli tool call list_migrations --server supabase \
  --input '{"project_id":"PROJECT_ID"}' > /tmp/applied_migrations.json

# Compare against local repository migrations
python3 skills/supabase-mcp-sync/scripts/check_pending_migrations.py \
  supabase/migrations \
  /tmp/applied_migrations.json \
  --pending-out /tmp/pending_migrations.txt
```

The script prints a summary and writes pending filenames to `/tmp/pending_migrations.txt` when requested.

## 3) Apply Pending Migrations
Apply one migration at a time in filename order. Never run in parallel.

```bash
while IFS= read -r file; do
  [ -z "$file" ] && continue
  name="${file%.sql}"
  query="$(sed 's/\"/\\\"/g' "supabase/migrations/$file" | tr '\n' ' ')"
  manus-mcp-cli tool call apply_migration --server supabase \
    --input "{\"project_id\":\"PROJECT_ID\",\"name\":\"$name\",\"query\":\"$query\"}"
done < /tmp/pending_migrations.txt
```

Important:
- Escape double quotes in SQL before embedding JSON input.
- Collapse newlines if the MCP wrapper expects one-line SQL payloads.
- Stop immediately on the first failed migration and troubleshoot before continuing.

## 4) Configure Storage Buckets and Policies
Storage setup is usually safer through `execute_sql` than `apply_migration`.

### Create bucket idempotently
```bash
manus-mcp-cli tool call execute_sql --server supabase \
  --input '{
    "project_id":"PROJECT_ID",
    "query":"INSERT INTO storage.buckets (id, name, public) VALUES ('\''bucket-name'\'', '\''bucket-name'\'', false) ON CONFLICT (id) DO NOTHING;"
  }'
```

### Recreate storage RLS policies safely
`storage.objects` policies do not support `IF NOT EXISTS`. Use `DROP POLICY IF EXISTS` followed by `CREATE POLICY`.

```bash
manus-mcp-cli tool call execute_sql --server supabase \
  --input '{
    "project_id":"PROJECT_ID",
    "query":"DROP POLICY IF EXISTS \"Policy name\" ON storage.objects; CREATE POLICY \"Policy name\" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = '\''bucket-name'\'');"
  }'
```

Read `references/storage-rls-patterns.md` for reusable policy patterns.

## 5) Verify Configuration
Run targeted checks after migration and storage changes.

```bash
# Verify bucket
manus-mcp-cli tool call execute_sql --server supabase \
  --input '{
    "project_id":"PROJECT_ID",
    "query":"SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = '\''bucket-name'\'';"
  }'

# Verify storage policies
manus-mcp-cli tool call execute_sql --server supabase \
  --input '{
    "project_id":"PROJECT_ID",
    "query":"SELECT polname, polcmd FROM pg_policy WHERE polrelid = '\''storage.objects'\''::regclass ORDER BY polname;"
  }'
```

## 6) Check Performance Advisories
```bash
manus-mcp-cli tool call get_advisors --server supabase \
  --input '{"project_id":"PROJECT_ID","type":"performance"}'
```

Prioritize fixes for RLS performance warnings (especially direct `auth.uid()` calls not wrapped in subqueries).

## 7) Generate Sync Report
Use `assets/templates/sync_report_template.md` as the report skeleton and fill it with:
- target project and timestamp
- applied/pending migration details
- storage bucket and policy outcomes
- advisor findings
- follow-up actions

## Common Patterns

### Full repository sync
1. List projects.
2. Fetch applied migrations.
3. Compute pending migrations.
4. Apply pending migrations sequentially.
5. Verify storage/RLS.
6. Check advisors and finalize report.

### Storage-only setup
1. Create bucket.
2. Drop/recreate storage policies.
3. Verify policies and bucket settings.
4. Document results.

### RLS policy-only update
1. Drop existing policy.
2. Create revised policy.
3. Test role behavior.
4. Verify in `pg_policy` and document changes.

## Safety Rules
- Apply migrations sequentially only.
- Use idempotent SQL (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP ... IF EXISTS`).
- Keep buckets private by default (`public = false`) unless explicitly required.
- Enforce folder/user isolation in storage RLS.
- Wrap `auth.uid()` in a subquery for better performance: `(SELECT auth.uid())`.
- Never expose service role credentials to client code.

## Resources
- Script for migration diffing: `scripts/check_pending_migrations.py`
- Storage policy patterns: `references/storage-rls-patterns.md`
- Troubleshooting guide: `references/migration-troubleshooting.md`
- Storage migration template: `assets/templates/storage_migration_template.sql`
- Sync report template: `assets/templates/sync_report_template.md`
