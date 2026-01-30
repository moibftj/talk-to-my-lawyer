-- Atomic Allowance Deduction
-- Fixes race condition in letter allowance system (Issue #1)
-- Combines check and deduct into a single atomic operation using SELECT FOR UPDATE

-- Drop existing function if it exists (in case of partial implementation)
DROP FUNCTION IF EXISTS public.check_and_deduct_allowance(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.check_and_deduct_allowance(
    u_id UUID
)
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
BEGIN
    -- Check if user is super admin (unlimited access)
    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE id = u_id;

    IF v_user_role = 'admin' THEN
        -- Check for super_admin sub-role
        SELECT EXISTS(
            SELECT 1 FROM public.profiles
            WHERE id = u_id AND admin_sub_role = 'super_admin'
        ) INTO v_is_super_admin;
    END IF;

    IF v_is_super_admin THEN
        RETURN QUERY SELECT TRUE, NULL::INTEGER, NULL::TEXT, FALSE, TRUE;
        RETURN;
    END IF;

    -- Check if user is on free trial (can generate 1 letter)
    SELECT COUNT(*) INTO v_letters_count
    FROM public.letters
    WHERE user_id = u_id;

    IF v_letters_count = 0 THEN
        v_is_free_trial := TRUE;
    END IF;

    -- Lock and check allowance
    -- FOR UPDATE SKIP LOCKED prevents deadlocks and ensures only one transaction proceeds
    FOR v_subscription IN
        SELECT id, remaining_letters, credits_remaining, status, plan, last_reset_at
        FROM public.subscriptions
        WHERE user_id = u_id
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
GRANT EXECUTE ON FUNCTION public.check_and_deduct_allowance(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.check_and_deduct_allowance IS
  'Atomically checks eligibility AND deducts letter allowance in a single operation using SELECT FOR UPDATE lock. This prevents race conditions where concurrent requests could pass the check and all deduct, resulting in over-generation. Returns success=true if deduction succeeded, or error_message if not.';
