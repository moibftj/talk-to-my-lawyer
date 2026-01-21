-- Add unique constraint on stripe_session_id to prevent duplicate subscriptions
-- This guards against race conditions between verify-payment and webhook

-- First, check for any existing duplicates and keep only the newest one per session_id
DELETE FROM subscriptions s1
WHERE s1.id NOT IN (
  SELECT DISTINCT ON (stripe_session_id) id
  FROM subscriptions
  WHERE stripe_session_id IS NOT NULL
  ORDER BY stripe_session_id, created_at DESC
)
AND s1.stripe_session_id IS NOT NULL;

-- Add unique constraint (only for non-null values, NULL is allowed multiple times)
ALTER TABLE subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_stripe_session_id_unique;

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_stripe_session_id_unique UNIQUE (stripe_session_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_session_id
  ON subscriptions(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT subscriptions_stripe_session_id_unique ON subscriptions IS 
  'Ensures one subscription per Stripe checkout session, preventing duplicates from race conditions between verify-payment and webhook endpoints.';
