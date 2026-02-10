-- ============================================================================
-- FIX MISSING TABLES, COLUMNS, AND FUNCTIONS
-- This migration addresses all gaps found during the full audit:
--   1. GDPR tables (empty migration 20251217000000)
--   2. Missing email_queue_logs table
--   3. Missing profile columns
--   4. Missing letter columns (claimed_by, claimed_at, etc.)
--   5. Missing refund_letter_allowance function
--   6. Missing GDPR functions (record_privacy_acceptance, etc.)
-- Safe to re-run: all operations use IF NOT EXISTS / OR REPLACE.
-- ============================================================================

-- ============================================================================
-- 1. GDPR TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.privacy_policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  policy_version TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  marketing_consent BOOLEAN DEFAULT false,
  analytics_consent BOOLEAN DEFAULT false,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  export_data JSONB,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accessed_by TEXT NOT NULL,
  access_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_queue_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_queue_id UUID REFERENCES public.email_queue(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. RLS POLICIES FOR GDPR TABLES
-- ============================================================================

ALTER TABLE public.privacy_policy_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue_logs ENABLE ROW LEVEL SECURITY;

-- Privacy policy acceptances: users can view/insert their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'privacy_policy_users_select' AND tablename = 'privacy_policy_acceptances') THEN
    CREATE POLICY privacy_policy_users_select ON public.privacy_policy_acceptances FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'privacy_policy_users_insert' AND tablename = 'privacy_policy_acceptances') THEN
    CREATE POLICY privacy_policy_users_insert ON public.privacy_policy_acceptances FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Data export requests: users can view/insert their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'data_export_users_select' AND tablename = 'data_export_requests') THEN
    CREATE POLICY data_export_users_select ON public.data_export_requests FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'data_export_users_insert' AND tablename = 'data_export_requests') THEN
    CREATE POLICY data_export_users_insert ON public.data_export_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Data deletion requests: users can view/insert their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'data_deletion_users_select' AND tablename = 'data_deletion_requests') THEN
    CREATE POLICY data_deletion_users_select ON public.data_deletion_requests FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'data_deletion_users_insert' AND tablename = 'data_deletion_requests') THEN
    CREATE POLICY data_deletion_users_insert ON public.data_deletion_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Data access logs: users can view their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'data_access_logs_users_select' AND tablename = 'data_access_logs') THEN
    CREATE POLICY data_access_logs_users_select ON public.data_access_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Email queue logs: service role only (no user-facing RLS needed)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'email_queue_logs_service_only' AND tablename = 'email_queue_logs') THEN
    CREATE POLICY email_queue_logs_service_only ON public.email_queue_logs FOR ALL USING (false);
  END IF;
END $$;

-- ============================================================================
-- 3. INDEXES FOR GDPR TABLES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_privacy_policy_user_id ON public.privacy_policy_acceptances (user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_user_id ON public.data_export_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_user_id ON public.data_deletion_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_user_id ON public.data_access_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_logs_email_id ON public.email_queue_logs (email_queue_id);

-- ============================================================================
-- 4. MISSING COLUMNS ON PROFILES TABLE
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_letters_generated INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_licensed_attorney BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- ============================================================================
-- 5. MISSING COLUMNS ON LETTERS TABLE
-- ============================================================================

ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS statutes_cited TEXT[];
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS legal_basis TEXT;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS next_steps TEXT;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.letters ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- ============================================================================
-- 6. MISSING COLUMN ON COUPON_USAGE TABLE
-- ============================================================================

ALTER TABLE public.coupon_usage ADD COLUMN IF NOT EXISTS plan_type TEXT;

-- ============================================================================
-- 7. MISSING FUNCTION: refund_letter_allowance
-- Called by allowance-service.ts and check-stuck-letters cron
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refund_letter_allowance(
  u_id UUID,
  amount INT DEFAULT 1
)
RETURNS TABLE(success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
BEGIN
  -- Find the user's active subscription
  SELECT * INTO v_sub
  FROM subscriptions
  WHERE user_id = u_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub IS NULL THEN
    RETURN QUERY SELECT false, 'No active subscription found'::TEXT;
    RETURN;
  END IF;

  -- Refund the credits
  UPDATE subscriptions
  SET remaining_letters = COALESCE(remaining_letters, 0) + amount,
      credits_remaining = COALESCE(credits_remaining, 0) + amount,
      updated_at = NOW()
  WHERE id = v_sub.id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

-- ============================================================================
-- 8. GDPR FUNCTIONS (from supabase-missing-functions.sql, never migrated)
-- ============================================================================

-- 8a. Record privacy policy acceptance
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
SET search_path = public
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

-- 8b. Check if user has accepted privacy policy version
CREATE OR REPLACE FUNCTION public.has_accepted_privacy_policy(
  p_user_id UUID,
  p_required_version TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 8c. Export user data (GDPR)
CREATE OR REPLACE FUNCTION public.export_user_data(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 8d. Log data access (GDPR)
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
SET search_path = public
AS $$
BEGIN
  INSERT INTO data_access_logs (
    user_id, accessed_by, access_type, resource_type, resource_id,
    ip_address, user_agent, details, accessed_at
  ) VALUES (
    p_user_id, p_accessed_by, p_access_type, p_resource_type, p_resource_id,
    p_ip_address, p_user_agent,
    CASE WHEN p_details IS NOT NULL THEN p_details::jsonb ELSE NULL END,
    NOW()
  );
END;
$$;
