/*
  # Single Admin Constraint Migration

  1. Overview
    - Enforces the single-admin architecture at the database level
    - Only ONE user can have role = 'admin' in the entire system
    - The single admin has full access to review, edit, and approve letters

  2. Changes
    - Creates a unique partial index to enforce exactly one admin
    - Creates a trigger function to prevent additional admin role assignments
    - Creates a helper function to check if admin already exists

  3. Security
    - Prevents accidental or malicious creation of multiple admin accounts
    - Maintains data integrity for the single-admin review model
*/

-- Create unique partial index to enforce single admin
-- This ensures only one row can have role = 'admin'
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin') <= 1 THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS one_admin_only ON public.profiles ((TRUE)) WHERE role = ''admin''';
    END IF;
END $$;

-- Function to check if an admin already exists
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles WHERE role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get the current admin user ID
CREATE OR REPLACE FUNCTION public.get_admin_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function to prevent multiple admins
CREATE OR REPLACE FUNCTION public.enforce_single_admin()
RETURNS TRIGGER AS $$
DECLARE
    existing_admin_id UUID;
BEGIN
    -- If trying to set role to admin
    IF NEW.role = 'admin' THEN
        -- Check if an admin already exists (excluding current row for updates)
        SELECT id INTO existing_admin_id 
        FROM public.profiles 
        WHERE role = 'admin' 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        LIMIT 1;
        
        IF existing_admin_id IS NOT NULL THEN
            RAISE EXCEPTION 'Single admin constraint violated: An admin user already exists. Only one admin is allowed in the system.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_single_admin_trigger ON public.profiles;

-- Create trigger to enforce single admin on insert and update (only if safe)
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin') <= 1 THEN
        EXECUTE 'CREATE TRIGGER enforce_single_admin_trigger
            BEFORE INSERT OR UPDATE ON public.profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.enforce_single_admin()';
    END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_exists TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_id TO authenticated;

-- Add comments
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'one_admin_only'
          AND n.nspname = 'public'
    ) THEN
        EXECUTE 'COMMENT ON INDEX public.one_admin_only IS ''Enforces single admin architecture - only one user can have role=admin''';
    END IF;
END $$;
COMMENT ON FUNCTION public.admin_exists IS 'Returns true if an admin user exists in the system';
COMMENT ON FUNCTION public.get_admin_user_id IS 'Returns the UUID of the single admin user';
COMMENT ON FUNCTION public.enforce_single_admin IS 'Trigger function that prevents multiple admin users';
