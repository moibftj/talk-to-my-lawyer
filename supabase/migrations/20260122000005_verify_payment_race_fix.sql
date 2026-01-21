-- Fix verify-payment race condition
-- Makes the verification atomic with proper handling of webhook race conditions

-- Enhanced version of complete_subscription_with_commission that handles race conditions better
CREATE OR REPLACE FUNCTION public.verify_and_complete_subscription(
    p_user_id UUID,
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
    error_message TEXT,
    already_completed BOOLEAN
) AS $$
DECLARE
    v_subscription_id UUID;
    v_commission_id UUID;
    v_coupon_usage_count INTEGER;
    v_commission_amount NUMERIC;
    v_rows_updated INTEGER;
BEGIN
    -- First, check if subscription already exists for this session (webhook completed it)
    SELECT id INTO v_subscription_id
    FROM public.subscriptions
    WHERE stripe_session_id = p_stripe_session_id
      AND status = 'active';

    IF v_subscription_id IS NOT NULL THEN
        -- Already completed by webhook, return success
        RETURN QUERY SELECT TRUE, v_subscription_id, NULL::UUID, NULL::INTEGER, NULL::TEXT, TRUE;
        RETURN;
    END IF;

    -- Atomically update pending subscription with session_id
    -- This prevents both verify-payment and webhook from processing the same subscription
    UPDATE public.subscriptions
    SET status = 'active',
        credits_remaining = p_monthly_allowance,
        remaining_letters = p_total_letters,
        stripe_session_id = p_stripe_session_id,
        stripe_customer_id = p_stripe_customer_id,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND status = 'pending'
      AND stripe_session_id IS NULL -- Only update if not already claimed
      AND id = (
          -- Get the most recent pending subscription
          SELECT id FROM public.subscriptions
          WHERE user_id = p_user_id
            AND status = 'pending'
            AND stripe_session_id IS NULL
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE SKIP LOCKED -- Skip if webhook is processing
      )
    RETURNING id INTO v_subscription_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    -- Check if we got the subscription
    IF v_rows_updated = 0 OR v_subscription_id IS NULL THEN
        -- No pending subscription found or it was claimed by webhook
        -- Check again if webhook completed it
        SELECT id INTO v_subscription_id
        FROM public.subscriptions
        WHERE stripe_session_id = p_stripe_session_id
          AND status = 'active';

        IF v_subscription_id IS NOT NULL THEN
            RETURN QUERY SELECT TRUE, v_subscription_id, NULL::UUID, NULL::INTEGER, NULL::TEXT, TRUE;
        ELSE
            RAISE EXCEPTION 'No pending subscription found or already processed';
        END IF;
        RETURN;
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
            v_subscription_id,
            p_final_price,
            p_commission_rate,
            v_commission_amount,
            'pending',
            NOW()
        )
        ON CONFLICT DO NOTHING -- Handle duplicate commission creation
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
            v_subscription_id,
            p_plan_type,
            CASE WHEN p_base_price > 0 THEN (p_discount_amount / p_base_price * 100)::INTEGER ELSE 0 END,
            p_base_price,
            p_final_price,
            NOW()
        ) ON CONFLICT DO NOTHING;
    END IF;

    -- Return success
    RETURN QUERY SELECT TRUE, v_subscription_id, v_commission_id, v_coupon_usage_count, NULL::TEXT, FALSE;

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction will be automatically rolled back
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::INTEGER, SQLERRM::TEXT, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.verify_and_complete_subscription TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.verify_and_complete_subscription IS 
  'Atomically verifies and completes subscription activation. Handles race conditions between verify-payment endpoint and Stripe webhook by using FOR UPDATE SKIP LOCKED and checking for existing active subscriptions. Returns already_completed=true if webhook completed the subscription first.';
