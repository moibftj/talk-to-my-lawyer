-- ============================================================================
-- STORAGE BUCKET AND RLS SETUP
-- ============================================================================
-- This migration creates a storage bucket and configures RLS policies
-- for role-based access control.
--
-- Bucket: {{BUCKET_NAME}}
-- Purpose: {{BUCKET_PURPOSE}}
-- ============================================================================

-- 1. Create storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '{{BUCKET_NAME}}',
  '{{BUCKET_NAME}}',
  {{IS_PUBLIC}},  -- true or false
  {{FILE_SIZE_LIMIT}},  -- bytes, or NULL for unlimited
  ARRAY[{{ALLOWED_MIME_TYPES}}]  -- e.g., 'application/pdf', 'image/png'
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;
DROP POLICY IF EXISTS "{{ADMIN_POLICY_NAME}}" ON storage.objects;
DROP POLICY IF EXISTS "{{USER_VIEW_POLICY_NAME}}" ON storage.objects;
DROP POLICY IF EXISTS "{{USER_UPLOAD_POLICY_NAME}}" ON storage.objects;

-- 4. Service Role: Full access (for automated operations)
CREATE POLICY "Service role full access"
ON storage.objects FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Admins: View and download all files
CREATE POLICY "{{ADMIN_POLICY_NAME}}"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = '{{BUCKET_NAME}}'
  AND ({{ADMIN_CHECK_FUNCTION}})  -- e.g., public.is_super_admin() OR public.is_attorney_admin()
);

-- 6. Users: View and download own files
CREATE POLICY "{{USER_VIEW_POLICY_NAME}}"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = '{{BUCKET_NAME}}'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND {{USER_CHECK_FUNCTION}}  -- e.g., public.is_subscriber()
);

-- 7. Users: Upload own files
CREATE POLICY "{{USER_UPLOAD_POLICY_NAME}}"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = '{{BUCKET_NAME}}'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND {{USER_CHECK_FUNCTION}}  -- e.g., public.is_subscriber()
);

-- 8. Add comments for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets for file uploads';
COMMENT ON COLUMN storage.buckets.file_size_limit IS 'Maximum file size in bytes';
COMMENT ON COLUMN storage.buckets.allowed_mime_types IS 'Array of allowed MIME types';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify the setup:
--
-- Check bucket configuration:
-- SELECT * FROM storage.buckets WHERE id = '{{BUCKET_NAME}}';
--
-- Check RLS policies:
-- SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'storage.objects'::regclass;
--
-- Test file upload (as authenticated user):
-- INSERT INTO storage.objects (bucket_id, name, owner, metadata)
-- VALUES ('{{BUCKET_NAME}}', 'test.pdf', auth.uid(), '{}');
-- ============================================================================
