-- Create missing is_system_admin function as alias to is_super_admin for backward compatibility
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Alias to is_super_admin for consistency
  RETURN public.is_super_admin();
END;
$$;

-- Update check_and_deduct_allowance function to use admin role correctly
CREATE OR REPLACE FUNCTION public.check_and_deduct_allowance(u_id UUID)
RETURNS TABLE(
    success BOOLEAN,
    remaining INTEGER,
    error_message TEXT,
    is_free_trial BOOLEAN,
    is_super_admin BOOLEAN
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
    user_record RECORD;
    sub_record RECORD;
    v_has_allowance BOOLEAN := FALSE;
    v_remaining INTEGER := 0;
    v_is_free_trial BOOLEAN := FALSE;
    v_is_super_admin BOOLEAN := FALSE;
    v_total_generated INTEGER := 0;
    letters_to_deduct INTEGER := 1;
BEGIN
    -- Lock the user's profile row to prevent concurrent modifications
    SELECT p.role, p.admin_sub_role, p.total_letters_generated
    INTO user_record
    FROM public.profiles p
    WHERE p.id = u_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'User not found'::TEXT, FALSE, FALSE;
        RETURN;
    END IF;

    v_total_generated := COALESCE(user_record.total_letters_generated, 0);

    -- Check if user is super admin (unlimited letters, no deduction needed)
    IF user_record.role = 'admin' AND user_record.admin_sub_role = 'super_admin' THEN
        v_is_super_admin := TRUE;
        RETURN QUERY SELECT TRUE, NULL::INTEGER, NULL::TEXT, FALSE, TRUE;
        RETURN;
    END IF;

    -- Lock and check the user's active subscription
    SELECT s.id, s.credits_remaining, s.remaining_letters
    INTO sub_record
    FROM public.subscriptions s
    WHERE s.user_id = u_id
      AND s.status = 'active'
    FOR UPDATE;

    -- Check free trial eligibility (first letter)
    IF v_total_generated = 0 AND sub_record IS NULL THEN
        v_is_free_trial := TRUE;
        -- Increment total letters generated for free trial
        UPDATE public.profiles
        SET total_letters_generated = total_letters_generated + 1,
            updated_at = NOW()
        WHERE id = u_id;

        RETURN QUERY SELECT TRUE, 1::INTEGER, NULL::TEXT, TRUE, FALSE;
        RETURN;
    END IF;

    -- Check if user has an active subscription with remaining letters
    IF sub_record IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'No active subscription found'::TEXT, FALSE, FALSE;
        RETURN;
    END IF;

    -- Use credits_remaining if available, otherwise use remaining_letters
    v_remaining := COALESCE(sub_record.credits_remaining, 0);
    IF v_remaining = 0 THEN
        v_remaining := COALESCE(sub_record.remaining_letters, 0);
    END IF;

    IF v_remaining <= 0 THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'No letter credits remaining'::TEXT, FALSE, FALSE;
        RETURN;
    END IF;

    -- Deduct from credits_remaining first, then remaining_letters
    IF sub_record.credits_remaining IS NOT NULL AND sub_record.credits_remaining > 0 THEN
        UPDATE public.subscriptions
        SET credits_remaining = GREATEST(0, credits_remaining - letters_to_deduct),
            remaining_letters = GREATEST(0, COALESCE(remaining_letters, 0) -
                CASE WHEN credits_remaining >= letters_to_deduct THEN 0
                     ELSE letters_to_deduct - credits_remaining END),
            updated_at = NOW()
        WHERE id = sub_record.id;
    ELSE
        UPDATE public.subscriptions
        SET remaining_letters = GREATEST(0, COALESCE(remaining_letters, 0) - letters_to_deduct),
            updated_at = NOW()
        WHERE id = sub_record.id;
    END IF;

    -- Increment total letters generated
    UPDATE public.profiles
    SET total_letters_generated = total_letters_generated + 1,
        updated_at = NOW()
    WHERE id = u_id;

    -- Return remaining count
    v_remaining := v_remaining - letters_to_deduct;

    RETURN QUERY SELECT TRUE, v_remaining::INTEGER, NULL::TEXT, FALSE, FALSE;
END;
$$;