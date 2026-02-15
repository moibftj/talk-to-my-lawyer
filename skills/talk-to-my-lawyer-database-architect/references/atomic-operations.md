# Atomic Operations

## Table of Contents
- Why Atomic Operations Matter
- Atomic Letter Allowance Deduction
- Atomic Coupon Usage Increment
- Atomic Refund Pattern
- Concurrency Notes

## Why Atomic Operations Matter
Credits, coupon usage, and payment-related counters are vulnerable to race conditions under concurrent requests. Use row locks (`FOR UPDATE`) and single-transaction update logic.

## Atomic Letter Allowance Deduction
```sql
CREATE OR REPLACE FUNCTION atomic_allowance_deduction(
  p_user_id UUID,
  p_letter_count INT DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active subscription');
  END IF;

  IF v_subscription.remaining_letters < p_letter_count THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient letter credits');
  END IF;

  UPDATE subscriptions
  SET remaining_letters = remaining_letters - p_letter_count,
      updated_at = NOW()
  WHERE id = v_subscription.id;

  RETURN jsonb_build_object(
    'success', true,
    'remaining', v_subscription.remaining_letters - p_letter_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Atomic Coupon Usage Increment
```sql
CREATE OR REPLACE FUNCTION atomic_coupon_increment(p_coupon_code TEXT)
RETURNS JSONB AS $$
DECLARE
  v_coupon RECORD;
BEGIN
  SELECT * INTO v_coupon
  FROM employee_coupons
  WHERE code = p_coupon_code
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive coupon');
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.usage_count >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coupon usage limit reached');
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coupon expired');
  END IF;

  UPDATE employee_coupons
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = v_coupon.id;

  RETURN jsonb_build_object('success', true, 'discount_percent', v_coupon.discount_percent);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Atomic Refund Pattern
Use a dedicated refund function that:
1. Locks active subscription row.
2. Adds credits back once per compensation event.
3. Logs refund reason (`generation_failure`, `attorney_rejection`, etc.).
4. Returns new balance for observability.

Recommended guard: store refund idempotency key (`letter_id`, `reason`) in a dedicated table to avoid duplicate refunds on retries.

## Concurrency Notes
- Keep lock scope minimal and deterministic.
- Avoid long-running external calls inside DB transactions.
- Perform network work (n8n/OpenAI/Stripe) before or after atomic DB sections, not during.
- Add integration tests for concurrent deduction and refund requests.
