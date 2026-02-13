/*
  # Fix Privilege Escalation in check_and_deduct_allowance
  
  ## Problem
  The current `check_and_deduct_allowance` function accepts a `u_id` parameter
  from the caller. If an API route incorrectly passes a user-provided ID instead
  of the authenticated user's ID, a user could potentially deduct credits from
  another user's account.
  
  ## Solution
  Remove the `u_id` parameter and always use `auth.uid()` internally to ensure
  the function only operates on the authenticated user's account.
  
  ## Changes
  - Drop the existing function
  - Create a new version that uses `auth.uid()` instead of a parameter
  - Update function signature to remove the parameter
*/

-- Drop the existing function with the vulnerable signature
DROP FUNCTION IF EXISTS public.check_and_deduct_allowance(UUID) CASCADE;

-- Create the secure version that uses auth.uid() internally
CREATE OR REPLACE FUNCTION public.check_and_deduct_allowance()
RETURNS TABLE(
    success BOOLEAN,
    remaining INTEGER,
    error_message TEXT,
    is_free_trial BOOLEAN,
    is_super_admin BOOLEAN
) AS $$
DECLARE
    v_subscription RECORD;
    v_remaining INTEGER;
    v_is_free_trial BOOLEAN := FALSE;
    v_is_super_admin BOOLEAN := FALSE;
    v_user_role TEXT;
    v_letters_count INTEGER;
    v_user_id UUID;
BEGIN
    -- SECURITY: Always use auth.uid() to prevent privilege escalation
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 'Authentication required', FALSE, FALSE;
        RETURN;
    END IF;

    -- Check if user is super admin (unlimited access)
    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_role = 'admin' THEN
        -- Check for super_admin sub-role
        SELECT EXISTS(
            SELECT 1 FROM public.profiles
            WHERE id = v_user_id AND admin_sub_role = 'super_admin'
        ) INTO v_is_super_admin;
    END IF;

    IF v_is_super_admin THEN
        RETURN QUERY SELECT TRUE, NULL::INTEGER, NULL::TEXT, FALSE, TRUE;
        RETURN;
    END IF;

    -- Check if user is on free trial (can generate 1 letter)
    SELECT COUNT(*) INTO v_letters_count
    FROM public.letters
    WHERE user_id = v_user_id;

    IF v_letters_count = 0 THEN
        v_is_free_trial := TRUE;
    END IF;

    -- Lock and check allowance
    -- FOR UPDATE SKIP LOCKED prevents deadlocks and ensures only one transaction proceeds
    FOR v_subscription IN
        SELECT id, remaining_letters, credits_remaining, status, plan, last_reset_at
        FROM public.subscriptions
        WHERE user_id = v_user_id
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
    LOOP
        -- Check if subscription has available letters
        v_remaining := COALESCE(v_subscription.remaining_letters, 0) +
                      COALESCE(v_subscription.credits_remaining, 0);

        IF v_remaining > 0 THEN
            -- Deduct one letter
            UPDATE public.subscriptions
            SET remaining_letters = GREATEST(0, v_subscription.remaining_letters - 1),
                updated_at = NOW()
            WHERE id = v_subscription.id;

            RETURN QUERY SELECT TRUE, (v_remaining - 1), NULL::TEXT, v_is_free_trial, FALSE;
            RETURN;
        END IF;
    END LOOP;

    -- No active subscription or no remaining letters
    -- Check free trial
    IF v_is_free_trial THEN
        RETURN QUERY SELECT TRUE, 0, NULL::TEXT, TRUE, FALSE;
        RETURN;
    END IF;

    -- No allowance available
    RETURN QUERY SELECT FALSE, 0, 'No letter credits remaining. Please purchase a subscription.', v_is_free_trial, FALSE;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_and_deduct_allowance() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.check_and_deduct_allowance IS
  'SECURITY HARDENED: Atomically checks eligibility AND deducts letter allowance for the authenticated user only (uses auth.uid() internally). This prevents race conditions and privilege escalation attacks. Returns success=true if deduction succeeded, or error_message if not.';
