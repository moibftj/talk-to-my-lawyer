/*
  Migration: Rename system_admin to super_admin
  
  This migration renames the admin_sub_role enum value from 'system_admin' to 'super_admin'
  to match the requirement naming convention.
  
  Steps:
  1. Add new enum value 'super_admin'
  2. Update existing rows
  3. We cannot drop old enum value while it's in use, so we keep both for now
     (old value will be removed after all code is updated)
*/

-- Add the new enum value
ALTER TYPE admin_sub_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Update all existing rows using 'system_admin' to 'super_admin'
UPDATE public.profiles
SET admin_sub_role = 'super_admin'
WHERE admin_sub_role = 'system_admin';

-- Rename the function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid()
    AND role = 'admin'
    AND admin_sub_role = 'super_admin'::admin_sub_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;
COMMENT ON FUNCTION public.is_super_admin IS 'Returns true if current user is a Super Admin with full access';
