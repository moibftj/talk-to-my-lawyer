/*
  # Service-Role Refund Function for Cron Jobs

  ## Problem
  The refund_letter_allowance function now uses auth.uid() internally,
  which means it only works when called by an authenticated user.
  Cron jobs and background processes cannot authenticate as users,
  so they need a separate function that uses service role privileges.

  ## Solution
  Create a new RPC function specifically for cron/background operations
  that accepts a user_id parameter and uses SERVICE ROLE to perform
  the refund without requiring user authentication.
*/

-- Service role only refund function for cron/background operations
CREATE OR REPLACE FUNCTION public.refund_letter_allowance_for_user(
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
  -- SECURITY: This function requires super_admin override in application code
  -- It is NOT granted to authenticated users, only to service role

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
    RETURN QUERY SELECT false, 'No active subscription found for user'::TEXT;
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

-- DO NOT GRANT to authenticated users - this is for service role only
-- The service role will use this via the Supabase client with service key

-- Add documentation
COMMENT ON FUNCTION public.refund_letter_allowance_for_user IS
  'SERVICE ROLE ONLY: Refunds letter allowance for a specific user. Used by cron jobs and background operations that cannot authenticate as users. Takes user_id as parameter. Do not grant to authenticated users.';
