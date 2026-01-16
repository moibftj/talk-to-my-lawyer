/*
  P0-3: Fix Transaction Atomicity in Checkout Flow

  This migration creates an atomic transaction function that handles
  subscription creation with commission and coupon tracking in a single
  all-or-nothing transaction.

  Problem: The previous implementation had multiple separate operations:
  1. Create subscription
  2. Create commission (could fail)
  3. Update coupon usage (could fail)

  If step 2 or 3 failed, the subscription was still created but the
  employee lost their commission or usage wasn't tracked.

  Solution: Wrap all operations in a single database transaction where
  either all succeed or all fail together.
*/

-- Create atomic subscription completion function
-- This is called after Stripe payment succeeds to finalize the subscription
CREATE OR REPLACE FUNCTION public.complete_subscription_with_commission(
    p_user_id UUID,
    p_subscription_id UUID,
    p_stripe_session_id TEXT,
    p_stripe_customer_id TEXT,
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
    coupon_usage_count INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_commission_id UUID;
    v_coupon_usage_count INTEGER;
    v_commission_amount NUMERIC;
BEGIN
    -- Begin explicit transaction (implicit in PostgreSQL function)
    -- Lock the subscription row
    UPDATE public.subscriptions
    SET status = 'active',
        credits_remaining = p_monthly_allowance,
        remaining_letters = p_total_letters,
        stripe_session_id = p_stripe_session_id,
        stripe_customer_id = p_stripe_customer_id,
        updated_at = NOW()
    WHERE id = p_subscription_id
      AND user_id = p_user_id
      AND status = 'pending'
    RETURNING id INTO subscription_id;

    -- Check if subscription was found and updated
    IF subscription_id IS NULL THEN
        RAISE EXCEPTION 'Subscription not found or already processed';
    END IF;

    -- Create commission if employee referral and final price > 0
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
            subscription_id,
            p_final_price,
            p_commission_rate,
            v_commission_amount,
            'pending',
            NOW()
        )
        RETURNING id INTO v_commission_id;

        -- Increment coupon usage count atomically
        IF p_coupon_code IS NOT NULL THEN
            UPDATE public.employee_coupons
            SET usage_count = employee_coupons.usage_count + 1,
                updated_at = NOW()
            WHERE code = UPPER(p_coupon_code)
              AND is_active = true
            RETURNING usage_count INTO v_coupon_usage_count;
        END IF;
    END IF;

    -- Record coupon usage for tracking
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
            subscription_id,
            p_plan_type,
            CASE WHEN p_base_price > 0 THEN (p_discount_amount / p_base_price * 100)::INTEGER ELSE 0 END,
            p_base_price,
            p_final_price,
            NOW()
        ) ON CONFLICT DO NOTHING;
    END IF;

    -- Return success
    RETURN QUERY SELECT TRUE, subscription_id, v_commission_id, v_coupon_usage_count, NULL::TEXT;

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction will be automatically rolled back
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::INTEGER, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create atomic subscription creation function for 100% discount/free cases
CREATE OR REPLACE FUNCTION public.create_free_subscription(
    p_user_id UUID,
    p_plan_type TEXT,
    p_monthly_allowance INTEGER,
    p_total_letters INTEGER,
    p_final_price NUMERIC DEFAULT 0,
    p_base_price NUMERIC DEFAULT 0,
    p_discount_amount NUMERIC DEFAULT 0,
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
    -- Insert subscription with active status
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
        current_period_end,
        created_at,
        updated_at
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
        NOW() + INTERVAL '30 days',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_subscription_id;

    -- Create commission if employee referral and final price > 0
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
        RETURNING id INTO v_commission_id;

        -- Increment coupon usage count
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.complete_subscription_with_commission TO service_role;
GRANT EXECUTE ON FUNCTION public.create_free_subscription TO authenticated, service_role;

-- Add comments for documentation
COMMENT ON FUNCTION public.complete_subscription_with_commission IS 'Atomically completes subscription activation after Stripe payment, creating commission and tracking coupon usage in a single transaction. Prevents partial subscription creation.';
COMMENT ON FUNCTION public.create_free_subscription IS 'Atomically creates a free/100% discount subscription with commission tracking. All operations succeed or fail together.';
