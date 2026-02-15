# Storage RLS Patterns

Use this file when creating or updating storage bucket policies in Supabase.

## Checklist
- Keep buckets private by default.
- Enable RLS on `storage.objects`.
- Drop/recreate policies instead of relying on `IF NOT EXISTS`.
- Scope object access to `bucket_id` and caller identity.
- Use `(SELECT auth.uid())` instead of direct `auth.uid()` calls in policy expressions.

## Bucket Creation Pattern
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private-documents',
  'private-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
```

## Ensure RLS Enabled
```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## Policy: Read Own Folder
```sql
DROP POLICY IF EXISTS "read_own_objects" ON storage.objects;
CREATE POLICY "read_own_objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'private-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
```

## Policy: Upload Own Folder
```sql
DROP POLICY IF EXISTS "insert_own_objects" ON storage.objects;
CREATE POLICY "insert_own_objects"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'private-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
```

## Policy: Update Own Folder
```sql
DROP POLICY IF EXISTS "update_own_objects" ON storage.objects;
CREATE POLICY "update_own_objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'private-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'private-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
```

## Policy: Delete Own Folder
```sql
DROP POLICY IF EXISTS "delete_own_objects" ON storage.objects;
CREATE POLICY "delete_own_objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'private-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
```

## Policy: Admin Full Access
Use your project helper function name (for example `is_admin()`).

```sql
DROP POLICY IF EXISTS "admin_all_storage_objects" ON storage.objects;
CREATE POLICY "admin_all_storage_objects"
ON storage.objects
FOR ALL
TO authenticated
USING ((SELECT is_admin()))
WITH CHECK ((SELECT is_admin()));
```

## Verification Query
```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass
ORDER BY polname;
```
