/*
  # Add Service Role Refund Function for Cron Jobs

  ## Problem
  The hardened refund_letter_allowance() function uses auth.uid(), which is NULL
  for service role (cron job) callers. This breaks cron jobs that need to refund
  specific users (e.g., check-stuck-letters).

  ## Solution
  Create a separate service-only function that accepts user_id parameter.
  This function is ONLY granted to service_role, not to authenticated users,
  preventing privilege escalation while enabling cron job functionality.

  ## Security
  - Separate function for service role callers (cron jobs, admin scripts)
  - NOT granted to authenticated role (only service_role can call it)
  - Still validates refund amount to prevent abuse
  - Original auth.uid()-based function remains for end-user requests
*/

-- Create service-role version that accepts user_id parameter
CREATE OR REPLACE FUNCTION public.refund_letter_allowance_service(
  p_user_id UUID,
  p_amount INT DEFAULT 1
)
RETURNS TABLE(success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
BEGIN
  -- Validate user_id parameter
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'User ID required'::TEXT;
    RETURN;
  END IF;

  -- Validate refund amount (prevent abuse)
  IF p_amount < 1 OR p_amount > 10 THEN
    RETURN QUERY SELECT false, 'Invalid refund amount (must be 1-10)'::TEXT;
    RETURN;
  END IF;

  -- Find the user's active subscription
  SELECT * INTO v_sub
  FROM subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub IS NULL THEN
    RETURN QUERY SELECT false, 'No active subscription found'::TEXT;
    RETURN;
  END IF;

  -- Refund the credits
  UPDATE subscriptions
  SET remaining_letters = COALESCE(remaining_letters, 0) + p_amount,
      credits_remaining = COALESCE(credits_remaining, 0) + p_amount,
      updated_at = NOW()
  WHERE id = v_sub.id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

-- SECURITY: Only grant to service_role, NOT to authenticated
-- This prevents privilege escalation attacks
GRANT EXECUTE ON FUNCTION public.refund_letter_allowance_service(UUID, INT) TO service_role;

-- Add documentation
COMMENT ON FUNCTION public.refund_letter_allowance_service IS
  'SERVICE ROLE ONLY: Refunds letter allowance for a specific user. Only callable by service role (cron jobs, admin scripts). For end-user requests, use refund_letter_allowance() which uses auth.uid() internally.';
