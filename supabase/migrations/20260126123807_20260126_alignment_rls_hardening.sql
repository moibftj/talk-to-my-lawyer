-- Fix security definer view
ALTER VIEW public.admin_coupon_analytics SET (security_invoker = true);

-- Tighten permissive RLS policies to service_role only
DROP POLICY IF EXISTS admin_audit_log_service_insert ON public.admin_audit_log;
CREATE POLICY admin_audit_log_service_insert
  ON public.admin_audit_log
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS coupon_usage_service_insert ON public.coupon_usage;
CREATE POLICY coupon_usage_service_insert
  ON public.coupon_usage
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS data_access_logs_service_insert ON public.data_access_logs;
CREATE POLICY data_access_logs_service_insert
  ON public.data_access_logs
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS email_delivery_log_service_all ON public.email_delivery_log;
CREATE POLICY email_delivery_log_service_all
  ON public.email_delivery_log
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS email_queue_service_all ON public.email_queue;
CREATE POLICY email_queue_service_all
  ON public.email_queue
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS email_queue_logs_service_all ON public.email_queue_logs;
CREATE POLICY email_queue_logs_service_all
  ON public.email_queue_logs
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "System can insert fraud detection logs" ON public.fraud_detection_logs;
CREATE POLICY "System can insert fraud detection logs"
  ON public.fraud_detection_logs
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS letter_audit_trail_service_insert ON public.letter_audit_trail;
CREATE POLICY letter_audit_trail_service_insert
  ON public.letter_audit_trail
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "System can insert security events" ON public.security_audit_log;
CREATE POLICY "System can insert security events"
  ON public.security_audit_log
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS webhook_events_service_all ON public.webhook_events;
CREATE POLICY webhook_events_service_all
  ON public.webhook_events
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Set search_path on security-sensitive functions
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_pending_emails(p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, "to" text, subject text, html text, text text, attempts integer, max_retries integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  -- Use CTE to SELECT ... FOR UPDATE SKIP LOCKED
  -- This claims rows exclusively so other workers skip them
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
$function$;

CREATE OR REPLACE FUNCTION public.claim_pending_emails(p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, "to" text, subject text, html text, text text, attempts integer, max_retries integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  -- Atomically claim and return emails by setting status to 'processing'
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
$function$;

CREATE OR REPLACE FUNCTION public.mark_email_sent(p_email_id uuid, p_provider text DEFAULT 'resend'::text, p_response_time_ms integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  UPDATE email_queue
  SET
    status = 'sent',
    sent_at = NOW(),
    updated_at = NOW(),
    attempts = attempts + 1
  WHERE id = p_email_id
    AND status IN ('pending', 'processing'); -- Allow both statuses

  -- Log the success
  INSERT INTO email_queue_logs (email_id, status, provider, response_time_ms, created_at)
  VALUES (p_email_id, 'sent', p_provider, p_response_time_ms, NOW());
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_email_failed(p_email_id uuid, p_error_message text, p_provider text DEFAULT 'resend'::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  v_current_attempts INTEGER;
  v_max_retries INTEGER;
BEGIN
  -- Get current attempts and max retries
  SELECT attempts, max_retries INTO v_current_attempts, v_max_retries
  FROM email_queue
  WHERE id = p_email_id;

  -- Increment attempts
  v_current_attempts := COALESCE(v_current_attempts, 0) + 1;
  v_max_retries := COALESCE(v_max_retries, 3);

  IF v_current_attempts >= v_max_retries THEN
    -- Max retries reached, mark as permanently failed
    UPDATE email_queue
    SET
      status = 'failed',
      error = p_error_message,
      attempts = v_current_attempts,
      updated_at = NOW()
    WHERE id = p_email_id;
  ELSE
    -- Schedule retry with exponential backoff
    UPDATE email_queue
    SET
      status = 'pending',  -- Back to pending for retry
      error = p_error_message,
      attempts = v_current_attempts,
      next_retry_at = NOW() + (POWER(2, v_current_attempts) * INTERVAL '1 minute'),
      updated_at = NOW()
    WHERE id = p_email_id;
  END IF;

  -- Log the failure
  INSERT INTO email_queue_logs (email_id, status, error_message, provider, created_at)
  VALUES (p_email_id, 'failed', p_error_message, p_provider, NOW());
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_stuck_processing_emails(p_timeout_minutes integer DEFAULT 15)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_email_queue()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.email_queue
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND status != 'pending';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.admin_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_payout(p_payout_id uuid, p_admin_id uuid, p_action character varying, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_payout RECORD;
  v_result JSONB;
BEGIN
  -- Get payout request
  SELECT * INTO v_payout FROM payout_requests WHERE id = p_payout_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
  END IF;

  IF v_payout.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout already processed');
  END IF;

  IF p_action = 'approve' THEN
    -- Mark as processing/completed
    UPDATE payout_requests
    SET status = 'completed',
        processed_at = NOW(),
        processed_by = p_admin_id,
        updated_at = NOW()
    WHERE id = p_payout_id;

    -- Mark related commissions as paid
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
$function$;
;
