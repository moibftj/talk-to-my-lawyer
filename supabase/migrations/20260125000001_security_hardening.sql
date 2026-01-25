/**
 * SECURITY HARDENING MIGRATION
 * ============================
 * Generated: 2026-01-25
 * 
 * This migration addresses security advisor findings:
 * 
 * 1. FUNCTIONS: Add explicit SET search_path to all functions lacking it
 * 2. RLS: Tighten overly permissive policies (USING true / WITH CHECK true)
 * 3. VIEW: Convert SECURITY DEFINER view to SECURITY INVOKER pattern
 * 
 * AFFECTED FUNCTIONS:
 *   - get_pending_emails
 *   - claim_pending_emails
 *   - mark_email_sent
 *   - mark_email_failed
 *   - reset_stuck_processing_emails
 *   - cleanup_old_email_queue
 *   - cleanup_old_audit_logs
 *   - process_payout
 * 
 * AFFECTED TABLES (RLS tightening):
 *   - email_queue
 *   - email_queue_logs
 *   - email_delivery_log
 *   - webhook_events
 *   - admin_audit_log
 *   - data_access_logs
 *   - coupon_usage (INSERT policy)
 *   - letter_audit_trail (INSERT policy)
 *   - fraud_detection_logs
 *   - security_audit_log
 */

BEGIN;

-- ============================================================================
-- 1. RECREATE FUNCTIONS WITH FIXED search_path
-- ============================================================================

-- 1.1 get_pending_emails
DROP FUNCTION IF EXISTS get_pending_emails(INTEGER);
CREATE FUNCTION get_pending_emails(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  "to" TEXT,
  subject TEXT,
  html TEXT,
  text TEXT,
  attempts INTEGER,
  max_retries INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH pending AS (
    SELECT eq.id AS email_id
    FROM email_queue eq
    WHERE eq.status = 'pending'
      AND (eq.next_retry_at IS NULL OR eq.next_retry_at <= NOW())
    ORDER BY eq.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  SELECT
    eq.id,
    eq."to",
    eq.subject,
    eq.html,
    eq.text,
    eq.attempts,
    eq.max_retries,
    eq.created_at
  FROM email_queue eq
  INNER JOIN pending p ON p.email_id = eq.id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_emails(INTEGER) TO service_role;
COMMENT ON FUNCTION get_pending_emails IS 
  'Retrieves and locks pending emails for processing. Uses FOR UPDATE SKIP LOCKED to prevent race conditions.';

-- 1.2 claim_pending_emails
DROP FUNCTION IF EXISTS claim_pending_emails(INTEGER);
CREATE FUNCTION claim_pending_emails(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  "to" TEXT,
  subject TEXT,
  html TEXT,
  text TEXT,
  attempts INTEGER,
  max_retries INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE email_queue eq
    SET status = 'processing',
        updated_at = NOW()
    WHERE eq.id IN (
      SELECT eq2.id
      FROM email_queue eq2
      WHERE eq2.status = 'pending'
        AND (eq2.next_retry_at IS NULL OR eq2.next_retry_at <= NOW())
      ORDER BY eq2.created_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING eq.id, eq."to", eq.subject, eq.html, eq.text, eq.attempts, eq.max_retries, eq.created_at
  )
  SELECT * FROM claimed;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_pending_emails(INTEGER) TO service_role;
COMMENT ON FUNCTION claim_pending_emails IS 
  'Atomically claims pending emails by setting status to processing and returning them.';

-- 1.3 mark_email_sent
DROP FUNCTION IF EXISTS mark_email_sent(UUID, TEXT, INTEGER);
CREATE FUNCTION mark_email_sent(
  p_email_id UUID,
  p_provider TEXT DEFAULT 'resend',
  p_response_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE email_queue
  SET
    status = 'sent',
    sent_at = NOW(),
    updated_at = NOW(),
    attempts = attempts + 1
  WHERE id = p_email_id
    AND status IN ('pending', 'processing');

  INSERT INTO email_queue_logs (email_id, status, provider, response_time_ms, created_at)
  VALUES (p_email_id, 'sent', p_provider, p_response_time_ms, NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION mark_email_sent(UUID, TEXT, INTEGER) TO service_role;

-- 1.4 mark_email_failed
DROP FUNCTION IF EXISTS mark_email_failed(UUID, TEXT, TEXT);
CREATE FUNCTION mark_email_failed(
  p_email_id UUID,
  p_error_message TEXT,
  p_provider TEXT DEFAULT 'resend'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_attempts INTEGER;
  v_max_retries INTEGER;
BEGIN
  SELECT attempts, max_retries INTO v_current_attempts, v_max_retries
  FROM email_queue
  WHERE id = p_email_id;

  v_current_attempts := COALESCE(v_current_attempts, 0) + 1;
  v_max_retries := COALESCE(v_max_retries, 3);

  IF v_current_attempts >= v_max_retries THEN
    UPDATE email_queue
    SET
      status = 'failed',
      error_message = p_error_message,
      attempts = v_current_attempts,
      updated_at = NOW()
    WHERE id = p_email_id;
  ELSE
    UPDATE email_queue
    SET
      status = 'pending',
      error_message = p_error_message,
      attempts = v_current_attempts,
      next_retry_at = NOW() + (POWER(2, v_current_attempts) * INTERVAL '1 minute'),
      updated_at = NOW()
    WHERE id = p_email_id;
  END IF;

  INSERT INTO email_queue_logs (email_id, status, error_message, provider, created_at)
  VALUES (p_email_id, 'failed', p_error_message, p_provider, NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION mark_email_failed(UUID, TEXT, TEXT) TO service_role;

-- 1.5 reset_stuck_processing_emails
DROP FUNCTION IF EXISTS reset_stuck_processing_emails(INTEGER);
CREATE FUNCTION reset_stuck_processing_emails(p_timeout_minutes INTEGER DEFAULT 15)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  UPDATE email_queue
  SET status = 'pending',
      updated_at = NOW()
  WHERE status = 'processing'
    AND updated_at < NOW() - (p_timeout_minutes * INTERVAL '1 minute');
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  RETURN v_reset_count;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_stuck_processing_emails(INTEGER) TO service_role;
COMMENT ON FUNCTION reset_stuck_processing_emails IS 
  'Resets emails stuck in processing status for more than the specified timeout back to pending.';

-- 1.6 cleanup_old_email_queue
DROP FUNCTION IF EXISTS cleanup_old_email_queue();
CREATE FUNCTION cleanup_old_email_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM email_queue
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND status != 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_email_queue() TO service_role;

-- 1.7 cleanup_old_audit_logs
DROP FUNCTION IF EXISTS cleanup_old_audit_logs();
CREATE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM admin_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs() TO service_role;

-- 1.8 process_payout
DROP FUNCTION IF EXISTS process_payout(UUID, UUID, VARCHAR, TEXT);
CREATE FUNCTION process_payout(
  p_payout_id UUID,
  p_admin_id UUID,
  p_action VARCHAR(20),
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payout RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
  END IF;
  
  IF v_payout.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout already processed');
  END IF;
  
  IF p_action = 'approve' THEN
    UPDATE payout_requests
    SET status = 'completed',
        processed_at = NOW(),
        processed_by = p_admin_id,
        updated_at = NOW()
    WHERE id = p_payout_id;
    
    UPDATE commissions
    SET status = 'paid', updated_at = NOW()
    WHERE employee_id = v_payout.employee_id
      AND status = 'pending';
    
    v_result := jsonb_build_object('success', true, 'message', 'Payout approved and processed');
    
  ELSIF p_action = 'reject' THEN
    UPDATE payout_requests
    SET status = 'rejected',
        processed_at = NOW(),
        processed_by = p_admin_id,
        rejection_reason = p_rejection_reason,
        updated_at = NOW()
    WHERE id = p_payout_id;
    
    v_result := jsonb_build_object('success', true, 'message', 'Payout rejected');
    
  ELSE
    v_result := jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION process_payout(UUID, UUID, VARCHAR, TEXT) TO service_role;
COMMENT ON FUNCTION process_payout IS 'Process a payout request (approve or reject). Service role only.';

-- ============================================================================
-- 2. TIGHTEN OVERLY PERMISSIVE RLS POLICIES
-- ============================================================================
-- Replace "USING true" / "WITH CHECK true" with proper role-based checks.
-- These tables should only be writable via service_role (server-side).
-- Super admins can SELECT for monitoring.

-- 2.1 email_queue - service_role for writes, super_admin for reads
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_queue_service_all" ON public.email_queue;
DROP POLICY IF EXISTS "email_queue_admin_select" ON public.email_queue;
DROP POLICY IF EXISTS "Service role can manage email queue" ON public.email_queue;

-- No permissive policies for authenticated role on writes
-- Service role bypasses RLS, so no policy needed for it
-- Super admins can view via helper function
CREATE POLICY "email_queue_super_admin_select"
  ON public.email_queue FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- 2.2 email_queue_logs - same pattern
ALTER TABLE public.email_queue_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_queue_logs_service_all" ON public.email_queue_logs;
DROP POLICY IF EXISTS "email_queue_logs_admin_select" ON public.email_queue_logs;
DROP POLICY IF EXISTS "Service role can manage email queue logs" ON public.email_queue_logs;

CREATE POLICY "email_queue_logs_super_admin_select"
  ON public.email_queue_logs FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- 2.3 email_delivery_log - same pattern
ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_delivery_log_service_all" ON public.email_delivery_log;
DROP POLICY IF EXISTS "email_delivery_log_admin_select" ON public.email_delivery_log;
DROP POLICY IF EXISTS "Service role can manage email delivery log" ON public.email_delivery_log;

CREATE POLICY "email_delivery_log_super_admin_select"
  ON public.email_delivery_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- 2.4 webhook_events - service_role only, super_admin reads
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_events_service_all" ON public.webhook_events;
DROP POLICY IF EXISTS "webhook_events_admin_select" ON public.webhook_events;
DROP POLICY IF EXISTS "webhook_events_service_insert" ON public.webhook_events;
DROP POLICY IF EXISTS "webhook_events_service_select" ON public.webhook_events;

CREATE POLICY "webhook_events_super_admin_select"
  ON public.webhook_events FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- 2.5 admin_audit_log - service_role inserts, super_admin reads
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_log_admin_select" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_service_insert" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Service role can insert audit log" ON public.admin_audit_log;

CREATE POLICY "admin_audit_log_super_admin_select"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- 2.6 data_access_logs - service_role inserts, user sees own, super_admin sees all
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_access_logs_user_select" ON public.data_access_logs;
DROP POLICY IF EXISTS "data_access_logs_service_insert" ON public.data_access_logs;
DROP POLICY IF EXISTS "data_access_logs_admin_select" ON public.data_access_logs;

CREATE POLICY "data_access_logs_own_select"
  ON public.data_access_logs FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "data_access_logs_super_admin_select"
  ON public.data_access_logs FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- No INSERT policy for authenticated (service_role bypasses RLS)

-- 2.7 coupon_usage - tighten INSERT policy
DROP POLICY IF EXISTS "coupon_usage_service_insert" ON public.coupon_usage;
-- INSERT is done via service_role only, no permissive policy needed

-- 2.8 letter_audit_trail - tighten INSERT policy
DROP POLICY IF EXISTS "letter_audit_trail_service_insert" ON public.letter_audit_trail;
-- INSERT is done via triggers and service_role, no permissive policy needed

-- 2.9 fraud_detection_logs (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fraud_detection_logs' AND table_schema = 'public') THEN
    ALTER TABLE public.fraud_detection_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.fraud_detection_logs FORCE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "fraud_detection_logs_service_insert" ON public.fraud_detection_logs;
    DROP POLICY IF EXISTS "fraud_detection_logs_admin_select" ON public.fraud_detection_logs;
    
    EXECUTE 'CREATE POLICY "fraud_detection_logs_super_admin_select" ON public.fraud_detection_logs FOR SELECT TO authenticated USING (public.is_super_admin())';
  END IF;
END $$;

-- 2.10 security_audit_log (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_audit_log' AND table_schema = 'public') THEN
    ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.security_audit_log FORCE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "security_audit_log_service_insert" ON public.security_audit_log;
    DROP POLICY IF EXISTS "security_audit_log_admin_select" ON public.security_audit_log;
    
    EXECUTE 'CREATE POLICY "security_audit_log_super_admin_select" ON public.security_audit_log FOR SELECT TO authenticated USING (public.is_super_admin())';
  END IF;
END $$;

-- ============================================================================
-- 3. FIX admin_coupon_analytics VIEW
-- ============================================================================
-- Convert from implicit SECURITY DEFINER to explicit SECURITY INVOKER
-- Views without SECURITY INVOKER keyword default to SECURITY INVOKER in PG 15+,
-- but some older migrations may have created it differently.
-- Recreate with explicit SECURITY INVOKER for clarity.

DROP VIEW IF EXISTS public.admin_coupon_analytics;

CREATE VIEW public.admin_coupon_analytics
WITH (security_invoker = true)
AS
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

-- Grant access only to super admins (view inherits RLS from underlying tables)
GRANT SELECT ON public.admin_coupon_analytics TO authenticated;

COMMENT ON VIEW public.admin_coupon_analytics IS 
  'Analytics view for coupon usage. Only accessible to super admins due to underlying RLS on coupon_usage table.';

-- ============================================================================
-- 4. VERIFY RLS IS ENABLED ON ALL SECURITY-SENSITIVE TABLES
-- ============================================================================

-- These should already be enabled, but ensure they are
ALTER TABLE public.email_queue FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage FORCE ROW LEVEL SECURITY;
ALTER TABLE public.letter_audit_trail FORCE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run separately to confirm)
-- ============================================================================
/*
-- Check all functions have search_path set
SELECT n.nspname AS schema, p.proname AS function_name, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_pending_emails', 'claim_pending_emails', 'mark_email_sent',
    'mark_email_failed', 'reset_stuck_processing_emails',
    'cleanup_old_email_queue', 'cleanup_old_audit_logs', 'process_payout'
  );

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN (
    'email_queue', 'email_queue_logs', 'email_delivery_log',
    'webhook_events', 'admin_audit_log', 'data_access_logs'
  )
ORDER BY tablename, policyname;

-- Check view security
SELECT schemaname, viewname, definition
FROM pg_views
WHERE viewname = 'admin_coupon_analytics';
*/
