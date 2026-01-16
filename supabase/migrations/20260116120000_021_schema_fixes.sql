/*
  Migration: 021_schema_fixes
  Description: Fixes identified during database audit - adds missing columns, 
               enables RLS on email_queue_logs, and adds missing index.
  
  Issues Fixed:
  1. coupon_usage missing subscription_id and plan_type columns
  2. subscriptions missing stripe_session_id column  
  3. letters missing is_attorney_reviewed column
  4. email_queue_logs missing RLS and policies
  5. Missing index on coupon_usage.subscription_id
*/

-- 1. Add missing columns to coupon_usage table
ALTER TABLE coupon_usage
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;

ALTER TABLE coupon_usage
ADD COLUMN IF NOT EXISTS plan_type TEXT;

-- Add index for subscription_id lookups
CREATE INDEX IF NOT EXISTS idx_coupon_usage_subscription_id 
    ON coupon_usage(subscription_id) 
    WHERE subscription_id IS NOT NULL;

COMMENT ON COLUMN coupon_usage.subscription_id IS 'Reference to the subscription created with this coupon';
COMMENT ON COLUMN coupon_usage.plan_type IS 'Type of plan purchased with this coupon';

-- 2. Add stripe_session_id to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

COMMENT ON COLUMN subscriptions.stripe_session_id IS 'Stripe checkout session ID for tracking payment flow';

-- 3. Add is_attorney_reviewed to letters table
ALTER TABLE letters
ADD COLUMN IF NOT EXISTS is_attorney_reviewed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN letters.is_attorney_reviewed IS 'Flag indicating if letter has been reviewed by a licensed attorney';

-- 4. Enable RLS on email_queue_logs table and add policy
ALTER TABLE email_queue_logs ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists then create (idempotent)
DROP POLICY IF EXISTS "Service role can manage email queue logs" ON email_queue_logs;

CREATE POLICY "Service role can manage email queue logs"
    ON email_queue_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE email_queue_logs IS 'Audit log for email queue processing with service-role-only access';
