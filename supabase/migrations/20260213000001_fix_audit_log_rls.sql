/*
  # Fix RLS Policy Bypass for Audit Logs
  
  ## Problem
  The current INSERT policy on `letter_audit_trail` allows any authenticated user
  to insert audit logs for any letter, potentially flooding the audit trail with
  fake entries or obscuring real admin actions.
  
  ## Solution
  Restrict the INSERT policy to only allow:
  1. Service role (for system operations)
  2. Authenticated users inserting audit logs for their own letters
  
  ## Changes
  - Drop the overly permissive "System can insert audit logs" policy
  - Create a new policy that validates letter ownership
  - Add a helper function to check if a letter belongs to the authenticated user
*/

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert audit logs" ON letter_audit_trail;

-- Create helper function to check letter ownership
CREATE OR REPLACE FUNCTION public.is_letter_owner(p_letter_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.letters
    WHERE id = p_letter_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_letter_owner TO authenticated;

-- Create new restrictive INSERT policy
-- Only allow inserts for letters owned by the authenticated user
CREATE POLICY "Users can insert audit logs for own letters"
  ON letter_audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Either the user owns the letter
    public.is_letter_owner(letter_id)
    -- OR the user is an admin (admins can audit any letter)
    OR public.get_user_role() = 'admin'
  );

-- Add comment for documentation
COMMENT ON POLICY "Users can insert audit logs for own letters" ON letter_audit_trail IS
  'Restricts audit log insertion to letter owners and admins only. Prevents unauthorized users from flooding the audit trail.';
