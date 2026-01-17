-- GDPR Compliance Features
-- This migration adds tables and functions for GDPR compliance:
-- 1. Privacy policy acceptance tracking
-- 2. Data export request logging
-- 3. Data deletion request logging
-- 4. Data access audit trail

-- =====================================================
-- 1. Privacy Policy Acceptance Tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS privacy_policy_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_version TEXT NOT NULL DEFAULT '1.0',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  -- Optional: specific consents
  marketing_consent BOOLEAN DEFAULT false,
  analytics_consent BOOLEAN DEFAULT false,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_privacy_acceptances_user_id ON privacy_policy_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_privacy_acceptances_version ON privacy_policy_acceptances(policy_version);

-- Enable RLS
ALTER TABLE privacy_policy_acceptances ENABLE ROW LEVEL SECURITY;

-- Users can view their own acceptances
DROP POLICY IF EXISTS "Users can view own privacy acceptances" ON privacy_policy_acceptances;
CREATE POLICY "Users can view own privacy acceptances"
  ON privacy_policy_acceptances
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own acceptances
DROP POLICY IF EXISTS "Users can insert own privacy acceptances" ON privacy_policy_acceptances;
CREATE POLICY "Users can insert own privacy acceptances"
  ON privacy_policy_acceptances
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 2. Data Export Requests
-- =====================================================

CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  completed_at TIMESTAMPTZ,
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for user and status lookups
CREATE INDEX IF NOT EXISTS idx_data_exports_user_id ON data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON data_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_exports_expires ON data_export_requests(expires_at);

-- Enable RLS
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own export requests
DROP POLICY IF EXISTS "Users can view own export requests" ON data_export_requests;
CREATE POLICY "Users can view own export requests"
  ON data_export_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create export requests
DROP POLICY IF EXISTS "Users can create export requests" ON data_export_requests;
CREATE POLICY "Users can create export requests"
  ON data_export_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 3. Data Deletion Requests
-- =====================================================

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for user and status lookups
CREATE INDEX IF NOT EXISTS idx_data_deletions_user_id ON data_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_deletions_status ON data_deletion_requests(status);

-- Enable RLS
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own deletion requests
DROP POLICY IF EXISTS "Users can view own deletion requests" ON data_deletion_requests;
CREATE POLICY "Users can view own deletion requests"
  ON data_deletion_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create deletion requests
DROP POLICY IF EXISTS "Users can create deletion requests" ON data_deletion_requests;
CREATE POLICY "Users can create deletion requests"
  ON data_deletion_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. Data Access Audit Trail
-- =====================================================

CREATE TABLE IF NOT EXISTS data_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessed_by UUID REFERENCES auth.users(id),
  access_type TEXT NOT NULL CHECK (access_type IN ('view', 'export', 'edit', 'delete')),
  resource_type TEXT NOT NULL,
  resource_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_data_access_user_id ON data_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_accessed_by ON data_access_logs(accessed_by);
CREATE INDEX IF NOT EXISTS idx_data_access_type ON data_access_logs(access_type);
CREATE INDEX IF NOT EXISTS idx_data_access_resource ON data_access_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_data_access_timestamp ON data_access_logs(accessed_at DESC);

-- Enable RLS
ALTER TABLE data_access_logs ENABLE ROW LEVEL SECURITY;

-- Users can view access logs for their own data
DROP POLICY IF EXISTS "Users can view own data access logs" ON data_access_logs;
CREATE POLICY "Users can view own data access logs"
  ON data_access_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service can insert access logs
DROP POLICY IF EXISTS "Service can insert access logs" ON data_access_logs;
CREATE POLICY "Service can insert access logs"
  ON data_access_logs
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 5. Helper Functions
-- =====================================================

-- Function to record privacy policy acceptance
CREATE OR REPLACE FUNCTION record_privacy_acceptance(
  p_user_id UUID,
  p_policy_version TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_marketing_consent BOOLEAN DEFAULT false,
  p_analytics_consent BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acceptance_id UUID;
BEGIN
  INSERT INTO privacy_policy_acceptances (
    user_id,
    policy_version,
    ip_address,
    user_agent,
    marketing_consent,
    analytics_consent
  ) VALUES (
    p_user_id,
    p_policy_version,
    p_ip_address,
    p_user_agent,
    p_marketing_consent,
    p_analytics_consent
  )
  RETURNING id INTO v_acceptance_id;

  RETURN v_acceptance_id;
END;
$$;

-- Function to check if user has accepted latest privacy policy
CREATE OR REPLACE FUNCTION has_accepted_privacy_policy(
  p_user_id UUID,
  p_required_version TEXT DEFAULT '1.0'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_accepted BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM privacy_policy_acceptances
    WHERE user_id = p_user_id
      AND policy_version = p_required_version
  ) INTO v_has_accepted;

  RETURN v_has_accepted;
END;
$$;

-- Function to log data access
CREATE OR REPLACE FUNCTION log_data_access(
  p_user_id UUID,
  p_accessed_by UUID,
  p_access_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO data_access_logs (
    user_id,
    accessed_by,
    access_type,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    details
  ) VALUES (
    p_user_id,
    p_accessed_by,
    p_access_type,
    p_resource_type,
    p_resource_id,
    p_ip_address,
    p_user_agent,
    p_details
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Function to export user data (returns JSONB with all user data)
CREATE OR REPLACE FUNCTION export_user_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data JSONB;
  v_profile JSONB;
  v_letters JSONB;
  v_subscriptions JSONB;
  v_commissions JSONB;
  v_coupons JSONB;
BEGIN
  -- Get profile data
  SELECT to_jsonb(p.*) INTO v_profile
  FROM profiles p
  WHERE p.id = p_user_id;

  -- Get letters data
  SELECT json_agg(to_jsonb(l.*)) INTO v_letters
  FROM letters l
  WHERE l.user_id = p_user_id;

  -- Get subscriptions data
  SELECT json_agg(to_jsonb(s.*)) INTO v_subscriptions
  FROM subscriptions s
  WHERE s.user_id = p_user_id;

  -- Get commissions data (if employee)
  SELECT json_agg(to_jsonb(c.*)) INTO v_commissions
  FROM commissions c
  WHERE c.employee_id = p_user_id;

  -- Get employee coupons data (if employee)
  SELECT json_agg(to_jsonb(ec.*)) INTO v_coupons
  FROM employee_coupons ec
  WHERE ec.employee_id = p_user_id;

  -- Combine all data
  v_data := jsonb_build_object(
    'user_id', p_user_id,
    'exported_at', NOW(),
    'profile', v_profile,
    'letters', COALESCE(v_letters, '[]'::jsonb),
    'subscriptions', COALESCE(v_subscriptions, '[]'::jsonb),
    'commissions', COALESCE(v_commissions, '[]'::jsonb),
    'employee_coupons', COALESCE(v_coupons, '[]'::jsonb)
  );

  RETURN v_data;
END;
$$;

-- =====================================================
-- 6. Comments for Documentation
-- =====================================================

COMMENT ON TABLE privacy_policy_acceptances IS 'Tracks user acceptance of privacy policy versions for GDPR compliance';
COMMENT ON TABLE data_export_requests IS 'Tracks user requests to export their data (GDPR Article 20)';
COMMENT ON TABLE data_deletion_requests IS 'Tracks user requests to delete their data (GDPR Article 17)';
COMMENT ON TABLE data_access_logs IS 'Audit trail of who accessed what user data (GDPR Article 15)';

COMMENT ON FUNCTION record_privacy_acceptance IS 'Records user acceptance of privacy policy with consent tracking';
COMMENT ON FUNCTION has_accepted_privacy_policy IS 'Checks if user has accepted the required privacy policy version';
COMMENT ON FUNCTION log_data_access IS 'Logs data access events for audit trail';
COMMENT ON FUNCTION export_user_data IS 'Exports all user data in JSON format for GDPR compliance';
