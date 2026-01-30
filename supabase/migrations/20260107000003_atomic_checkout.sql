-- Atomic Checkout Subscription Creation
-- Fixes race condition and missing transaction atomicity in checkout flow (Issue #3)
-- Wraps subscription, commission, and coupon update in a single atomic transaction

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.create_free_subscription(UUID, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, NUMERIC) CASCADE;

CREATE OR REPLACE FUNCTION public.create_free_subscription(
    p_user_id UUID,
    p_plan_type TEXT,
    p_monthly_allowance INTEGER,
    p_total_letters INTEGER,
    p_final_price NUMERIC,
    p_base_price NUMERIC,
    p_discount_amount NUMERIC,
    p_coupon_code TEXT DEFAULT NULL,
    p_employee_id UUID DEFAULT NULL,
    p_commission_rate NUMERIC DEFAULT 0.05
)
RETURNS TABLE(
    success BOOLEAN,
    subscription_id UUID,
    commission_id UUID,
    error_message TEXT
) AS $$
DECLARE
    v_subscription_id UUID;
    v_commission_id UUID;
    v_commission_amount NUMERIC;
BEGIN
    -- Validate inputs
    IF p_final_price <= 0 THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 'Invalid price: Free subscriptions not allowed';
        RETURN;
    END IF;

    -- Create subscription in a transaction (atomic by default in PostgreSQL)
    INSERT INTO public.subscriptions(
        user_id,
        plan,
        plan_type,
        status,
        price,
        discount,
        coupon_code,
        credits_remaining,
        remaining_letters,
        current_period_start,
        current_period_end
    ) VALUES (
        p_user_id,
        p_plan_type,
        p_plan_type,
        'active',
        p_final_price,
        p_discount_amount,
        p_coupon_code,
        p_monthly_allowance,
        p_total_letters,
        NOW(),
        NOW() + INTERVAL '30 days'
    )
    RETURNING id INTO v_subscription_id;

    -- Create commission if employee referral
    IF p_employee_id IS NOT NULL AND p_final_price > 0 THEN
        v_commission_amount := p_final_price * p_commission_rate;

        INSERT INTO public.commissions(
            employee_id,
            subscription_id,
            subscription_amount,
            commission_rate,
            commission_amount,
            status,
            created_at
        ) VALUES (
            p_employee_id,
            v_subscription_id,
            p_final_price,
            p_commission_rate,
            v_commission_amount,
            'pending',
            NOW()
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_commission_id;

        -- Update coupon usage count atomically
        IF p_coupon_code IS NOT NULL THEN
            UPDATE public.employee_coupons
            SET usage_count = employee_coupons.usage_count + 1,
                updated_at = NOW()
            WHERE code = UPPER(p_coupon_code)
              AND is_active = true;
        END IF;
    END IF;

    -- Record coupon usage
    IF p_coupon_code IS NOT NULL THEN
        INSERT INTO public.coupon_usage(
            user_id,
            coupon_code,
            employee_id,
            subscription_id,
            plan_type,
            discount_percent,
            amount_before,
            amount_after,
            created_at
        ) VALUES (
            p_user_id,
            p_coupon_code,
            p_employee_id,
            v_subscription_id,
            p_plan_type,
            CASE WHEN p_base_price > 0 THEN (p_discount_amount / p_base_price * 100)::INTEGER ELSE 0 END,
            p_base_price,
            p_final_price,
            NOW()
        ) ON CONFLICT DO NOTHING;
    END IF;

    -- Return success
    RETURN QUERY SELECT TRUE, v_subscription_id, v_commission_id, NULL::TEXT;

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction will be automatically rolled back
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users (for test mode checkout)
GRANT EXECUTE ON FUNCTION public.create_free_subscription(UUID, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, NUMERIC) TO authenticated;

-- Also grant to service role for webhook processing
GRANT EXECUTE ON FUNCTION public.create_free_subscription(UUID, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, NUMERIC) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.create_free_subscription IS
  'Atomically creates subscription, commission, and updates coupon usage in a single transaction. Used for test mode checkout and ensures all-or-nothing semantics. If any step fails, the entire transaction is rolled back. Rejects zero or negative prices to prevent free subscription abuse.';

-- Note: verify_and_complete_subscription is created in 20260122000005_verify_payment_race_fix.sql
-- That function handles the production payment flow race conditions
