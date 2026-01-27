/*
  # Coupon Usage and Security Tables

  1. New Tables
    - `coupon_usage` - Tracks coupon redemptions during checkout
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `coupon_code` (text)
      - `employee_id` (uuid, references profiles, nullable for special codes)
      - `subscription_id` (uuid, references subscriptions)
      - `discount_percent` (int)
      - `amount_before` (numeric)
      - `amount_after` (numeric)
      - timestamps

    - `security_config` - Application security settings
      - `id` (uuid, primary key)
      - `key` (text, unique)
      - `value` (text)
      - `description` (text)
      - timestamps

    - `security_audit_log` - Security event logging
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `event_type` (text)
      - `ip_address` (inet)
      - `user_agent` (text)
      - `details` (jsonb)
      - timestamps

  2. Security
    - RLS enabled on all tables
    - Appropriate policies for each role

  3. Functions
    - `log_security_event()` - Logs security events
    - `detect_suspicious_activity()` - Checks for suspicious patterns
*/

CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    coupon_code TEXT NOT NULL,
    employee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    discount_percent INT CHECK (discount_percent >= 0 AND discount_percent <= 100),
    amount_before NUMERIC(10,2) CHECK (amount_before >= 0),
    amount_after NUMERIC(10,2) CHECK (amount_after >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_code ON coupon_usage(coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_employee ON coupon_usage(employee_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_subscription ON coupon_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_created_at ON coupon_usage(created_at DESC);
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own coupon usage" ON coupon_usage;
CREATE POLICY "Users can view own coupon usage"
    ON coupon_usage FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Employees can view their coupon usage" ON coupon_usage;
CREATE POLICY "Employees can view their coupon usage"
    ON coupon_usage FOR SELECT
    TO authenticated
    USING (auth.uid() = employee_id);
DROP POLICY IF EXISTS "Admins can view all coupon usage" ON coupon_usage;
CREATE POLICY "Admins can view all coupon usage"
    ON coupon_usage FOR SELECT
    TO authenticated
    USING (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "System can insert coupon usage" ON coupon_usage;
CREATE POLICY "System can insert coupon usage"
    ON coupon_usage FOR INSERT
    TO authenticated
    WITH CHECK (true);
COMMENT ON TABLE coupon_usage IS 'Tracks coupon code redemptions during checkout for analytics and commission calculation';
COMMENT ON COLUMN coupon_usage.user_id IS 'User who used the coupon';
COMMENT ON COLUMN coupon_usage.coupon_code IS 'Coupon code that was applied (e.g., TALK3, employee codes)';
COMMENT ON COLUMN coupon_usage.employee_id IS 'Employee who owns the coupon (NULL for special codes like TALK3)';
COMMENT ON COLUMN coupon_usage.subscription_id IS 'Subscription created with this coupon';
COMMENT ON COLUMN coupon_usage.discount_percent IS 'Discount percentage applied (0-100)';
COMMENT ON COLUMN coupon_usage.amount_before IS 'Original price before discount';
COMMENT ON COLUMN coupon_usage.amount_after IS 'Final price after discount';
CREATE TABLE IF NOT EXISTS security_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE security_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins only access security config" ON security_config;
CREATE POLICY "Admins only access security config"
    ON security_config FOR ALL
    TO authenticated
    USING (public.get_user_role() = 'admin');
INSERT INTO security_config (key, value, description) VALUES
    ('max_letter_generation_per_hour', '10', 'Maximum letters a user can generate per hour'),
    ('max_ai_improvements_per_letter', '5', 'Maximum AI improvement requests per letter'),
    ('session_timeout_minutes', '60', 'Session timeout in minutes'),
    ('require_email_verification', 'false', 'Require email verification before account activation')
ON CONFLICT (key) DO NOTHING;
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    event_type TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_event ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_log(created_at DESC);
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view security audit log" ON security_audit_log;
CREATE POLICY "Admins view security audit log"
    ON security_audit_log FOR SELECT
    TO authenticated
    USING (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "System can insert security events" ON security_audit_log;
CREATE POLICY "System can insert security events"
    ON security_audit_log FOR INSERT
    TO authenticated
    WITH CHECK (true);
DROP FUNCTION IF EXISTS public.log_security_event(UUID, TEXT, INET, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.security_audit_log (
        user_id,
        event_type,
        ip_address,
        user_agent,
        details
    ) VALUES (
        p_user_id,
        p_event_type,
        p_ip_address,
        p_user_agent,
        p_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.detect_suspicious_activity(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(p_user_id UUID, action_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    action_count INTEGER;
    time_window INTERVAL := '1 hour';
BEGIN
    SELECT COUNT(*) INTO action_count
    FROM public.letter_audit_trail
    WHERE performed_by = p_user_id
    AND created_at > NOW() - time_window
    AND action = action_type;

    RETURN action_count > 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.log_security_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_activity TO authenticated;
