/*
  # Letter Allowance System

  1. Functions Created
    - `check_letter_allowance()` - Checks if user has available letter credits
    - `deduct_letter_allowance()` - Deducts one letter credit on generation
    - `add_letter_allowances()` - Adds credits when subscription is purchased
    - `reset_monthly_allowances()` - Resets credits for monthly/yearly plans
    - `count_user_letters()` - Counts total letters for free trial check

  2. Plan Types
    - one_time: 1 letter, no reset
    - standard_4_month / monthly: 4 letters per month
    - premium_8_month / yearly: 8 letters per year

  3. Free Trial Logic
    - First letter is free (count_user_letters returns 0)
*/

DROP FUNCTION IF EXISTS public.check_letter_allowance(UUID);
CREATE OR REPLACE FUNCTION public.check_letter_allowance(u_id UUID)
RETURNS TABLE(
    has_allowance BOOLEAN,
    remaining INTEGER,
    plan_name TEXT,
    is_super BOOLEAN
) AS $$
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
        RETURN QUERY SELECT false, 0, NULL::TEXT, false;
        RETURN;
    END IF;

    remaining_count := COALESCE(active_subscription.credits_remaining, active_subscription.remaining_letters, 0);

    RETURN QUERY SELECT
        remaining_count > 0,
        remaining_count,
        active_subscription.plan_type,
        false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.deduct_letter_allowance(UUID);
CREATE OR REPLACE FUNCTION public.deduct_letter_allowance(u_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    sub_record RECORD;
BEGIN
    SELECT * INTO sub_record
    FROM public.subscriptions
    WHERE user_id = u_id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF COALESCE(sub_record.remaining_letters, sub_record.credits_remaining, 0) <= 0 THEN
        RETURN false;
    END IF;

    UPDATE public.subscriptions
    SET remaining_letters = COALESCE(remaining_letters, 0) - 1,
        credits_remaining = COALESCE(credits_remaining, 0) - 1,
        updated_at = NOW()
    WHERE id = sub_record.id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.add_letter_allowances(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.add_letter_allowances(sub_id UUID, plan TEXT)
RETURNS VOID AS $$
DECLARE
    letters_to_add INT;
BEGIN
    IF plan = 'one_time' OR plan = 'single_letter' THEN
        letters_to_add := 1;
    ELSIF plan = 'standard_4_month' OR plan = 'monthly' THEN
        letters_to_add := 4;
    ELSIF plan = 'premium_8_month' OR plan = 'yearly' THEN
        letters_to_add := 8;
    ELSE
        letters_to_add := 1;
    END IF;

    UPDATE public.subscriptions
    SET remaining_letters = letters_to_add,
        credits_remaining = letters_to_add,
        last_reset_at = NOW(),
        updated_at = NOW()
    WHERE id = sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.reset_monthly_allowances();
CREATE OR REPLACE FUNCTION public.reset_monthly_allowances()
RETURNS VOID AS $$
BEGIN
    UPDATE public.subscriptions
    SET remaining_letters = CASE
            WHEN plan_type = 'standard_4_month' OR plan_type = 'monthly' THEN 4
            WHEN plan_type = 'premium_8_month' OR plan_type = 'yearly' THEN 8
            ELSE remaining_letters
        END,
        credits_remaining = CASE
            WHEN plan_type = 'standard_4_month' OR plan_type = 'monthly' THEN 4
            WHEN plan_type = 'premium_8_month' OR plan_type = 'yearly' THEN 8
            ELSE credits_remaining
        END,
        last_reset_at = NOW(),
        updated_at = NOW()
    WHERE status = 'active'
      AND plan_type IN ('standard_4_month', 'premium_8_month', 'monthly', 'yearly')
      AND DATE_TRUNC('month', last_reset_at) < DATE_TRUNC('month', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.count_user_letters(UUID);
CREATE OR REPLACE FUNCTION public.count_user_letters(u_id UUID)
RETURNS INTEGER AS $$
DECLARE
    letter_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO letter_count
    FROM public.letters
    WHERE user_id = u_id;
    
    RETURN letter_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.check_letter_allowance TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_letter_allowance TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_letters TO authenticated;
