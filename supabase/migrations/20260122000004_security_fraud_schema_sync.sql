-- Schema sync: security + fraud tables and coupon_usage columns

-- Extend coupon_usage with fraud-related fields used by the codebase
ALTER TABLE coupon_usage
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS fraud_risk_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_detection_data JSONB;

-- Security configuration table
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

-- Security audit log
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

GRANT EXECUTE ON FUNCTION public.log_security_event(UUID, TEXT, INET, TEXT, JSONB) TO authenticated;

-- Fraud detection configuration
CREATE TABLE IF NOT EXISTS fraud_detection_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fraud_detection_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins only access fraud detection config" ON fraud_detection_config;
CREATE POLICY "Admins only access fraud detection config"
  ON fraud_detection_config FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- Fraud detection logs
CREATE TABLE IF NOT EXISTS fraud_detection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_code TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  user_id UUID REFERENCES profiles(id),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  action TEXT NOT NULL CHECK (action IN ('allow', 'flag', 'block')),
  reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  patterns JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_detection_logs_code ON fraud_detection_logs(coupon_code);
CREATE INDEX IF NOT EXISTS idx_fraud_detection_logs_user ON fraud_detection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_detection_logs_created ON fraud_detection_logs(created_at DESC);

ALTER TABLE fraud_detection_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view fraud detection logs" ON fraud_detection_logs;
CREATE POLICY "Admins view fraud detection logs"
  ON fraud_detection_logs FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "System can insert fraud detection logs" ON fraud_detection_logs;
CREATE POLICY "System can insert fraud detection logs"
  ON fraud_detection_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Suspicious patterns (admin-managed)
CREATE TABLE IF NOT EXISTS suspicious_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('velocity', 'distribution', 'timing', 'behavior', 'technical')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  evidence JSONB,
  threshold_value NUMERIC,
  actual_value NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suspicious_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins only access suspicious patterns" ON suspicious_patterns;
CREATE POLICY "Admins only access suspicious patterns"
  ON suspicious_patterns FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- Promotional code usage (separate from employee coupons)
CREATE TABLE IF NOT EXISTS promotional_code_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  plan_id TEXT,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotional_code_usage_user ON promotional_code_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promotional_code_usage_code ON promotional_code_usage(code);

ALTER TABLE promotional_code_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own promo usage" ON promotional_code_usage;
CREATE POLICY "Users can view own promo usage"
  ON promotional_code_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all promo usage" ON promotional_code_usage;
CREATE POLICY "Admins can view all promo usage"
  ON promotional_code_usage FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "System can insert promo usage" ON promotional_code_usage;
CREATE POLICY "System can insert promo usage"
  ON promotional_code_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.get_user_role() = 'admin');

-- Admin analytics view for coupons
CREATE OR REPLACE VIEW admin_coupon_analytics AS
SELECT
  cu.coupon_code,
  COUNT(*)::INTEGER AS total_uses,
  COALESCE(SUM(cu.amount_before - cu.amount_after), 0)::NUMERIC AS total_discount_given,
  COALESCE(SUM(cu.amount_after), 0)::NUMERIC AS total_revenue,
  MAX(cu.created_at) AS last_used,
  ec.employee_id,
  p.full_name AS employee_name
FROM coupon_usage cu
LEFT JOIN employee_coupons ec ON ec.code = cu.coupon_code
LEFT JOIN profiles p ON p.id = ec.employee_id
GROUP BY cu.coupon_code, ec.employee_id, p.full_name;
