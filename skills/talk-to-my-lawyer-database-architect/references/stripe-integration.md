# Stripe Integration Patterns

## Table of Contents
- Subscription Billing Model
- Webhook Idempotency
- Commission Linkage
- Safety Checks

## Subscription Billing Model
- `subscriptions` table stores billing status and credit balances.
- Stripe customer/subscription IDs map to app identities.
- Coupon usage may influence discount and commission attribution.

Recommended columns:
- `subscriptions.stripe_subscription_id`
- `profiles.stripe_customer_id`
- `subscriptions.status`, `remaining_letters`, `price`, `discount`, `coupon_code`

## Webhook Idempotency
Never process the same Stripe event twice.

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION process_stripe_webhook(
  p_event_id TEXT,
  p_event_type TEXT,
  p_event_data JSONB
)
RETURNS JSONB AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM webhook_events WHERE event_id = p_event_id) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Event already processed');
  END IF;

  INSERT INTO webhook_events (event_id, event_type)
  VALUES (p_event_id, p_event_type);

  -- Apply event-specific subscription/payment logic here

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Commission Linkage
Commission events should tie to successful subscription/payment events.

Pattern:
1. Validate webhook idempotency.
2. Resolve `subscription` and `coupon_code`.
3. Resolve `employee_coupons.employee_id` by coupon code.
4. Insert commission record with rate and amount snapshot.
5. Keep payout state independent (`pending` until payout processing).

## Safety Checks
- Validate event signature before database writes.
- Reject malformed/unknown event types with structured logs.
- Keep a dead-letter path for failed webhook processing.
- Alert on repeated webhook failures and queue backlog.
