/*
  Migration: 015_function_updates
  Description: Updates core functions to use atomic operations, remove deprecated column references,
               and ensure consistent search_path for security.
*/

-- 1. Atomic Letter Deduction (Optimized from Script 022)
-- Removes is_super_user check and uses FOR UPDATE for race condition prevention
DROP FUNCTION IF EXISTS public.deduct_letter_allowance(UUID);
CREATE OR REPLACE FUNCTION public.deduct_letter_allowance(u_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    sub_record RECORD;
BEGIN
    -- Get active subscription with LOCK to prevent race conditions
    SELECT * INTO sub_record
    FROM public.subscriptions
    WHERE user_id = u_id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false; -- No active subscription
    END IF;

    -- Check both columns for compatibility
    IF COALESCE(sub_record.remaining_letters, sub_record.credits_remaining, 0) <= 0 THEN
        RETURN false; -- No letters remaining
    END IF;

    -- Deduct 1 letter from both columns to maintain consistency
    UPDATE public.subscriptions
    SET remaining_letters = COALESCE(remaining_letters, 0) - 1,
        credits_remaining = COALESCE(credits_remaining, 0) - 1,
        updated_at = NOW()
    WHERE id = sub_record.id;

    -- Increment total letters generated in profile
    UPDATE public.profiles
    SET total_letters_generated = COALESCE(total_letters_generated, 0) + 1
    WHERE id = u_id;

    RETURN true;
END;
$$;

-- 2. Secure Letter Allowance Check
-- Standardizes the check to use remaining_letters/credits_remaining
DROP FUNCTION IF EXISTS public.check_letter_allowance(UUID);
CREATE OR REPLACE FUNCTION public.check_letter_allowance(u_id UUID)
RETURNS TABLE(
    has_allowance BOOLEAN,
    remaining INTEGER,
    plan_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    active_subscription RECORD;
    remaining_count INTEGER;
BEGIN
    SELECT * INTO active_subscription
    FROM public.subscriptions
    WHERE user_id = u_id
    AND status = 'active'
    AND (current_period_end IS NULL OR current_period_end > NOW())
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, NULL::TEXT;
        RETURN;
    END IF;

    remaining_count := COALESCE(active_subscription.remaining_letters, active_subscription.credits_remaining, 0);
    
    RETURN QUERY SELECT
        remaining_count > 0,
        remaining_count,
        active_subscription.plan_type;
END;
$$;

-- 3. Atomic Credit Decrement (from Script 020)
DROP FUNCTION IF EXISTS public.decrement_credits_atomic(UUID, INT);
CREATE OR REPLACE FUNCTION public.decrement_credits_atomic(p_user_id UUID, p_amount INT)
RETURNS INT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  current_credits INT;
BEGIN
  -- Lock the subscription row for update
  -- Note: This function now targets the subscriptions table for consistency
  UPDATE public.subscriptions
  SET credits_remaining = credits_remaining - p_amount,
      remaining_letters = remaining_letters - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id 
    AND status = 'active'
  RETURNING credits_remaining INTO current_credits;
  
  IF NOT FOUND THEN
    RETURN -2; -- No active subscription
  END IF;

  IF current_credits < 0 THEN
    -- Rollback if credits would go negative
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  RETURN current_credits;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.deduct_letter_allowance TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_letter_allowance TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_credits_atomic TO authenticated;
