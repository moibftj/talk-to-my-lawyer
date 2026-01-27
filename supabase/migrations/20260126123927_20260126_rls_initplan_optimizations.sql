-- Replace auth.role() with select auth.role() to avoid per-row evaluation
DROP POLICY IF EXISTS admin_audit_log_service_insert ON public.admin_audit_log;
CREATE POLICY admin_audit_log_service_insert
  ON public.admin_audit_log
  FOR INSERT
  TO public
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS coupon_usage_service_insert ON public.coupon_usage;
CREATE POLICY coupon_usage_service_insert
  ON public.coupon_usage
  FOR INSERT
  TO public
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS data_access_logs_service_insert ON public.data_access_logs;
CREATE POLICY data_access_logs_service_insert
  ON public.data_access_logs
  FOR INSERT
  TO public
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS email_delivery_log_service_all ON public.email_delivery_log;
CREATE POLICY email_delivery_log_service_all
  ON public.email_delivery_log
  FOR ALL
  TO public
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS email_queue_service_all ON public.email_queue;
CREATE POLICY email_queue_service_all
  ON public.email_queue
  FOR ALL
  TO public
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS email_queue_logs_service_all ON public.email_queue_logs;
CREATE POLICY email_queue_logs_service_all
  ON public.email_queue_logs
  FOR ALL
  TO public
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "System can insert fraud detection logs" ON public.fraud_detection_logs;
CREATE POLICY "System can insert fraud detection logs"
  ON public.fraud_detection_logs
  FOR INSERT
  TO public
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS letter_audit_trail_service_insert ON public.letter_audit_trail;
CREATE POLICY letter_audit_trail_service_insert
  ON public.letter_audit_trail
  FOR INSERT
  TO public
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "System can insert security events" ON public.security_audit_log;
CREATE POLICY "System can insert security events"
  ON public.security_audit_log
  FOR INSERT
  TO public
  WITH CHECK ((SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS webhook_events_service_all ON public.webhook_events;
CREATE POLICY webhook_events_service_all
  ON public.webhook_events
  FOR ALL
  TO public
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');
;
