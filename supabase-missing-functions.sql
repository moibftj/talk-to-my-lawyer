-- ============================================================================
-- MISSING DATABASE FUNCTIONS FOR TALK-TO-MY-LAWYER
-- Run this entire script in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- 1. LOG LETTER AUDIT
-- Used across letter workflow for tracking status changes and actions
CREATE OR REPLACE FUNCTION public.log_letter_audit(
  p_letter_id UUID,
  p_action TEXT,
  p_admin_id TEXT DEFAULT NULL,
  p_old_status TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO letter_audit_trail (letter_id, action, performed_by, old_status, new_status, notes, metadata)
  VALUES (
    p_letter_id,
    p_action,
    p_admin_id,
    p_old_status,
    p_new_status,
    p_notes,
    COALESCE(p_metadata, p_details)
  );
END;
$$;

-- 2. VERIFY AND COMPLETE SUBSCRIPTION
-- Called by Stripe webhook and verify-payment to atomically create/update subscription
CREATE OR REPLACE FUNCTION public.verify_and_complete_subscription(
  p_user_id UUID,
  p_stripe_session_id TEXT,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_plan_type TEXT DEFAULT 'unknown',
  p_monthly_allowance INT DEFAULT 0,
  p_total_letters INT DEFAULT 0,
  p_final_price NUMERIC DEFAULT 0,
  p_base_price NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_coupon_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_sub RECORD;
  v_sub_id UUID;
  v_result JSONB;
BEGIN
  SELECT * INTO v_existing_sub
  FROM subscriptions
  WHERE stripe_session_id = p_stripe_session_id
  LIMIT 1;

  IF v_existing_sub IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'subscription_id', v_existing_sub.id,
      'already_exists', true
    );
  END IF;

  INSERT INTO subscriptions (
    user_id, status, plan_type, price, discount, coupon_code,
    remaining_letters, credits_remaining, stripe_customer_id,
    stripe_session_id, current_period_start, current_period_end,
    created_at, updated_at
  ) VALUES (
    p_user_id, 'active', p_plan_type, p_final_price, p_discount_amount, p_coupon_code,
    p_monthly_allowance, p_total_letters, p_stripe_customer_id,
    p_stripe_session_id, NOW(), NOW() + INTERVAL '30 days',
    NOW(), NOW()
  )
  RETURNING id INTO v_sub_id;

  UPDATE profiles
  SET stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      updated_at = NOW()
  WHERE id = p_user_id;

  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    UPDATE employee_coupons
    SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = NOW()
    WHERE code = p_coupon_code AND is_active = true;

    INSERT INTO coupon_usage (
      user_id, coupon_code, discount_percent, amount_before, amount_after,
      subscription_id, plan_type, created_at
    ) VALUES (
      p_user_id, p_coupon_code,
      CASE WHEN p_base_price > 0 THEN ROUND((p_discount_amount / p_base_price) * 100) ELSE 0 END,
      p_base_price, p_final_price,
      v_sub_id, p_plan_type, NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id,
    'already_exists', false
  );
END;
$$;

-- 3. CREATE FREE SUBSCRIPTION
-- Called when coupon gives 100% discount
CREATE OR REPLACE FUNCTION public.create_free_subscription(
  p_user_id UUID,
  p_plan_type TEXT DEFAULT 'unknown',
  p_monthly_allowance INT DEFAULT 0,
  p_total_letters INT DEFAULT 0,
  p_final_price NUMERIC DEFAULT 0,
  p_base_price NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_coupon_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  INSERT INTO subscriptions (
    user_id, status, plan_type, price, discount, coupon_code,
    remaining_letters, credits_remaining,
    current_period_start, current_period_end,
    created_at, updated_at
  ) VALUES (
    p_user_id, 'active', p_plan_type, p_final_price, p_discount_amount, p_coupon_code,
    p_monthly_allowance, p_total_letters,
    NOW(), NOW() + INTERVAL '30 days',
    NOW(), NOW()
  )
  RETURNING id INTO v_sub_id;

  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    UPDATE employee_coupons
    SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = NOW()
    WHERE code = p_coupon_code AND is_active = true;

    INSERT INTO coupon_usage (
      user_id, coupon_code, discount_percent, amount_before, amount_after,
      subscription_id, plan_type, created_at
    ) VALUES (
      p_user_id, p_coupon_code,
      CASE WHEN p_base_price > 0 THEN ROUND((p_discount_amount / p_base_price) * 100) ELSE 0 END,
      p_base_price, p_final_price,
      v_sub_id, p_plan_type, NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_sub_id
  );
END;
$$;

-- 4. CHECK AND RECORD WEBHOOK (Stripe idempotency)
-- Prevents duplicate processing of the same Stripe event
DROP FUNCTION IF EXISTS public.check_and_record_webhook(text, text, jsonb);
CREATE OR REPLACE FUNCTION public.check_and_record_webhook(
  p_stripe_event_id TEXT,
  p_event_type TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing RECORD;
BEGIN
  SELECT * INTO v_existing
  FROM webhook_events
  WHERE stripe_event_id = p_stripe_event_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'already_processed', true,
      'event_id', v_existing.id,
      'processed_at', v_existing.processed_at
    );
  END IF;

  INSERT INTO webhook_events (stripe_event_id, event_type, processed_at, metadata, created_at)
  VALUES (p_stripe_event_id, p_event_type, NOW(), p_metadata, NOW());

  RETURN jsonb_build_object(
    'already_processed', false
  );
END;
$$;

-- 5. MARK EMAIL SENT
-- Updates email queue entry after successful send
CREATE OR REPLACE FUNCTION public.mark_email_sent(
  p_email_id UUID,
  p_provider TEXT DEFAULT NULL,
  p_response_time_ms INT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE email_queue
  SET status = 'sent', sent_at = NOW(), updated_at = NOW()
  WHERE id = p_email_id;

  INSERT INTO email_delivery_log (recipient_email, subject, provider, status, response_time_ms, created_at)
  SELECT eq.to, eq.subject, p_provider, 'sent', p_response_time_ms, NOW()
  FROM email_queue eq
  WHERE eq.id = p_email_id;
END;
$$;

-- 6. MARK EMAIL FAILED
-- Updates email queue entry after failed send
CREATE OR REPLACE FUNCTION public.mark_email_failed(
  p_email_id UUID,
  p_error_message TEXT,
  p_provider TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE email_queue
  SET status = CASE
        WHEN attempts + 1 >= max_retries THEN 'failed'
        ELSE 'pending'
      END,
      attempts = attempts + 1,
      error = p_error_message,
      next_retry_at = CASE
        WHEN attempts + 1 < max_retries THEN NOW() + (INTERVAL '1 minute' * POWER(2, attempts + 1))
        ELSE NULL
      END,
      updated_at = NOW()
  WHERE id = p_email_id;

  INSERT INTO email_delivery_log (recipient_email, subject, provider, status, error_message, created_at)
  SELECT eq.to, eq.subject, p_provider, 'failed', p_error_message, NOW()
  FROM email_queue eq
  WHERE eq.id = p_email_id;
END;
$$;

-- 7. GET EMAIL QUEUE STATS
-- Returns statistics about the email queue
CREATE OR REPLACE FUNCTION public.get_email_queue_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'processing', COUNT(*) FILTER (WHERE status = 'processing'),
    'sent', COUNT(*) FILTER (WHERE status = 'sent'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'oldest_pending', MIN(created_at) FILTER (WHERE status = 'pending')
  ) INTO v_result
  FROM email_queue;

  RETURN v_result;
END;
$$;

-- 8. RECORD PRIVACY ACCEPTANCE
-- Records user's acceptance of privacy policy
CREATE OR REPLACE FUNCTION public.record_privacy_acceptance(
  p_user_id UUID,
  p_policy_version TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_marketing_consent BOOLEAN DEFAULT false,
  p_analytics_consent BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO privacy_policy_acceptances (
    user_id, policy_version, ip_address, user_agent,
    marketing_consent, analytics_consent, accepted_at
  ) VALUES (
    p_user_id, p_policy_version, p_ip_address, p_user_agent,
    p_marketing_consent, p_analytics_consent, NOW()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'acceptance_id', v_id
  );
END;
$$;

-- 9. HAS ACCEPTED PRIVACY POLICY
-- Checks if user has accepted a specific policy version
CREATE OR REPLACE FUNCTION public.has_accepted_privacy_policy(
  p_user_id UUID,
  p_required_version TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accepted BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM privacy_policy_acceptances
    WHERE user_id = p_user_id AND policy_version = p_required_version
  ) INTO v_accepted;

  RETURN v_accepted;
END;
$$;

-- 10. EXPORT USER DATA (GDPR)
-- Exports all user data for GDPR compliance
CREATE OR REPLACE FUNCTION public.export_user_data(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile JSONB;
  v_letters JSONB;
  v_subscriptions JSONB;
  v_privacy JSONB;
BEGIN
  SELECT to_jsonb(p.*) INTO v_profile
  FROM profiles p WHERE p.id = p_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(l.*)), '[]'::jsonb) INTO v_letters
  FROM letters l WHERE l.user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(s.*)), '[]'::jsonb) INTO v_subscriptions
  FROM subscriptions s WHERE s.user_id = p_user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(pp.*)), '[]'::jsonb) INTO v_privacy
  FROM privacy_policy_acceptances pp WHERE pp.user_id = p_user_id;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'letters', v_letters,
    'subscriptions', v_subscriptions,
    'privacy_acceptances', v_privacy,
    'exported_at', NOW()
  );
END;
$$;

-- 11. LOG DATA ACCESS (GDPR)
-- Logs access to user data for GDPR audit trail
CREATE OR REPLACE FUNCTION public.log_data_access(
  p_user_id UUID,
  p_accessed_by TEXT,
  p_access_type TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_details TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO data_access_logs (
    user_id, accessed_by, access_type, resource_type, resource_id,
    ip_address, user_agent, details, accessed_at
  ) VALUES (
    p_user_id, p_accessed_by, p_access_type, p_resource_type, p_resource_id,
    p_ip_address, p_user_agent, p_details::jsonb, NOW()
  );
END;
$$;
