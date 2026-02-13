/*
  # Fix Privilege Escalation in refund_letter_allowance

  ## Problem
  The `refund_letter_allowance` function accepts a `u_id` parameter from the caller,
  making it vulnerable to privilege escalation attacks. If combined with the bug in
  `/app/api/generate-letter/route.ts:306` (where letterId was passed instead of userId),
  or if misused elsewhere, an attacker could refund credits to arbitrary user accounts.

  ## Solution
  Update the function to use `auth.uid()` internally instead of accepting a parameter.
  This ensures the function ONLY refunds credits to the authenticated user.

  ## Changes
  - Drop the existing function with vulnerable signature
  - Create a new version that uses `auth.uid()` instead of a parameter
  - Add security documentation
*/

-- Drop the existing vulnerable function
DROP FUNCTION IF EXISTS public.refund_letter_allowance(UUID, INT) CASCADE;

-- Create the secure version that uses auth.uid() internally
CREATE OR REPLACE FUNCTION public.refund_letter_allowance(amount INT DEFAULT 1)
RETURNS TABLE(success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_user_id UUID;
BEGIN
  -- SECURITY: Always use auth.uid() to prevent privilege escalation
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Authentication required'::TEXT;
    RETURN;
  END IF;

  -- Validate refund amount (prevent abuse)
  IF amount < 1 OR amount > 10 THEN
    RETURN QUERY SELECT false, 'Invalid refund amount (must be 1-10)'::TEXT;
    RETURN;
  END IF;

  -- Find the user's active subscription
  SELECT * INTO v_sub
  FROM subscriptions
  WHERE user_id = v_user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub IS NULL THEN
    RETURN QUERY SELECT false, 'No active subscription found'::TEXT;
    RETURN;
  END IF;

  -- Refund the credits
  UPDATE subscriptions
  SET remaining_letters = COALESCE(remaining_letters, 0) + amount,
      credits_remaining = COALESCE(credits_remaining, 0) + amount,
      updated_at = NOW()
  WHERE id = v_sub.id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.refund_letter_allowance(INT) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.refund_letter_allowance IS
  'SECURITY HARDENED: Refunds letter allowance for the authenticated user only (uses auth.uid() internally). This prevents privilege escalation attacks where malicious code could refund arbitrary user accounts. Called by letter generation error handlers and cron jobs.';
