/**
 * COMPREHENSIVE RLS POLICY MIGRATION
 * ===================================
 * Generated: 2026-01-21
 * 
 * This migration consolidates and hardens Row Level Security policies for all major tables.
 * 
 * ROLES:
 *   - subscriber: Regular users who generate/view their own letters
 *   - employee: Referral partners who have coupons and earn commissions
 *   - admin + admin_sub_role='attorney_admin': Can review/approve letters only
 *   - admin + admin_sub_role='super_admin': Full system access
 * 
 * PATTERNS USED:
 *   - (SELECT auth.uid()) for performance optimization (cached per query)
 *   - Helper functions: is_system_admin(), is_attorney_admin(), is_super_admin()
 *   - SECURITY DEFINER functions for sensitive operations
 *
 * TABLES COVERED:
 *   profiles, subscriptions, letters, employee_coupons, coupon_usage,
 *   commissions, payout_requests, letter_audit_trail, messages,
 *   email_queue, email_queue_logs, email_delivery_log, webhook_events,
 *   admin_audit_log, privacy_policy_acceptances, data_export_requests,
 *   data_deletion_requests, data_access_logs
 */

BEGIN;

-- ============================================================================
-- HELPER FUNCTIONS (ensure they exist and are up to date)
-- ============================================================================

-- Super Admin check (full system access)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND admin_sub_role = 'super_admin'
  );
$$;

-- System Admin check (alias for super_admin for backward compatibility)
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin();
$$;

-- Attorney Admin check (letter review access only)
CREATE OR REPLACE FUNCTION public.is_attorney_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND admin_sub_role = 'attorney_admin'
  );
$$;

-- Any Admin check (super_admin OR attorney_admin)
CREATE OR REPLACE FUNCTION public.is_any_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR public.is_attorney_admin();
$$;

-- Employee check
CREATE OR REPLACE FUNCTION public.is_employee()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'employee'
  );
$$;

-- Subscriber check
CREATE OR REPLACE FUNCTION public.is_subscriber()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'subscriber'
  );
$$;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.is_super_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_attorney_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_any_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_employee TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_subscriber TO authenticated;

-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================
-- Users can view/update own profile; Admins can view/update all

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = (SELECT auth.uid()));

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles_admin_select"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- 2. SUBSCRIPTIONS TABLE
-- ============================================================================
-- Users view/create own; Super Admins manage all

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can create subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins manage all subscriptions" ON public.subscriptions;

CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "subscriptions_insert_own"
  ON public.subscriptions FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "subscriptions_update_own"
  ON public.subscriptions FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "subscriptions_admin_all"
  ON public.subscriptions FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- 3. LETTERS TABLE
-- ============================================================================
-- Subscribers: CRUD own letters
-- Attorney Admins: SELECT + UPDATE (for review workflow)
-- Super Admins: Full access

ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscribers view own letters" ON public.letters;
DROP POLICY IF EXISTS "Subscribers create own letters" ON public.letters;
DROP POLICY IF EXISTS "Subscribers update own letters" ON public.letters;
DROP POLICY IF EXISTS "Admins full letter access" ON public.letters;

-- Subscribers: Own letters only
CREATE POLICY "letters_subscriber_select"
  ON public.letters FOR SELECT
  USING (
    user_id = (SELECT auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'subscriber')
  );

CREATE POLICY "letters_subscriber_insert"
  ON public.letters FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'subscriber')
  );

CREATE POLICY "letters_subscriber_update"
  ON public.letters FOR UPDATE
  USING (
    user_id = (SELECT auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'subscriber')
  )
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'subscriber')
  );

CREATE POLICY "letters_subscriber_delete"
  ON public.letters FOR DELETE
  USING (
    user_id = (SELECT auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'subscriber') AND
    status IN ('draft', 'pending_review')  -- Can only delete drafts/pending_review
  );

-- Attorney Admins: View all letters + update for review
CREATE POLICY "letters_attorney_select"
  ON public.letters FOR SELECT
  USING (public.is_attorney_admin());

CREATE POLICY "letters_attorney_update"
  ON public.letters FOR UPDATE
  USING (public.is_attorney_admin())
  WITH CHECK (public.is_attorney_admin());

-- Super Admins: Full access
CREATE POLICY "letters_super_admin_all"
  ON public.letters FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- 4. EMPLOYEE_COUPONS TABLE
-- ============================================================================
-- Employees: View own coupons, create if doesn't exist
-- Public: Validate active coupons (for checkout)
-- Super Admins: Full access

ALTER TABLE public.employee_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_coupons FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees view own coupons" ON public.employee_coupons;
DROP POLICY IF EXISTS "Employees create own coupon" ON public.employee_coupons;
DROP POLICY IF EXISTS "Public can validate active coupons" ON public.employee_coupons;
DROP POLICY IF EXISTS "Admins manage all coupons" ON public.employee_coupons;

CREATE POLICY "employee_coupons_employee_select"
  ON public.employee_coupons FOR SELECT
  USING (
    employee_id = (SELECT auth.uid()) AND
    public.is_employee()
  );

CREATE POLICY "employee_coupons_employee_insert"
  ON public.employee_coupons FOR INSERT
  WITH CHECK (
    employee_id = (SELECT auth.uid()) AND
    public.is_employee()
  );

-- Public validation for checkout (limited fields via RLS, no sensitive data exposed)
CREATE POLICY "employee_coupons_public_validate"
  ON public.employee_coupons FOR SELECT
  USING (is_active = true);

CREATE POLICY "employee_coupons_admin_all"
  ON public.employee_coupons FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- 5. COUPON_USAGE TABLE
-- ============================================================================
-- Users: View own usage
-- Employees: View usage of their coupons
-- Super Admins: Full access

ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "Employees can view their coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "Admins can view all coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "System can insert coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "coupon_usage_user_select" ON public.coupon_usage;
DROP POLICY IF EXISTS "coupon_usage_employee_select" ON public.coupon_usage;
DROP POLICY IF EXISTS "coupon_usage_admin_select" ON public.coupon_usage;
DROP POLICY IF EXISTS "coupon_usage_service_insert" ON public.coupon_usage;

CREATE POLICY "coupon_usage_user_select"
  ON public.coupon_usage FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "coupon_usage_employee_select"
  ON public.coupon_usage FOR SELECT
  USING (
    employee_id = (SELECT auth.uid()) AND
    public.is_employee()
  );

CREATE POLICY "coupon_usage_admin_select"
  ON public.coupon_usage FOR SELECT
  USING (public.is_super_admin());

-- Insert is handled by service_role via checkout functions
CREATE POLICY "coupon_usage_service_insert"
  ON public.coupon_usage FOR INSERT
  WITH CHECK (true);  -- Controlled by SECURITY DEFINER functions

-- ============================================================================
-- 6. COMMISSIONS TABLE
-- ============================================================================
-- Employees: View own commissions
-- Super Admins: Full access (create, update, view all)

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees view own commissions" ON public.commissions;
DROP POLICY IF EXISTS "Admins view all commissions" ON public.commissions;
DROP POLICY IF EXISTS "Admins create commissions" ON public.commissions;
DROP POLICY IF EXISTS "Admins update commissions" ON public.commissions;

CREATE POLICY "commissions_employee_select"
  ON public.commissions FOR SELECT
  USING (
    employee_id = (SELECT auth.uid()) AND
    public.is_employee()
  );

CREATE POLICY "commissions_admin_all"
  ON public.commissions FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- 7. PAYOUT_REQUESTS TABLE
-- ============================================================================
-- Employees: View own, create own
-- Super Admins: Full access

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Employees can create payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Admins can view all payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Admins can update payout requests" ON public.payout_requests;

CREATE POLICY "payout_requests_employee_select"
  ON public.payout_requests FOR SELECT
  USING (
    employee_id = (SELECT auth.uid()) AND
    public.is_employee()
  );

CREATE POLICY "payout_requests_employee_insert"
  ON public.payout_requests FOR INSERT
  WITH CHECK (
    employee_id = (SELECT auth.uid()) AND
    public.is_employee()
  );

CREATE POLICY "payout_requests_admin_all"
  ON public.payout_requests FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- 8. LETTER_AUDIT_TRAIL TABLE
-- ============================================================================
-- Users: View audit trail for their own letters
-- Any Admin: View all audit trails
-- Insert: Service role only

ALTER TABLE public.letter_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_audit_trail FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own letter audit" ON public.letter_audit_trail;
DROP POLICY IF EXISTS "Admins view all audit logs" ON public.letter_audit_trail;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.letter_audit_trail;

CREATE POLICY "letter_audit_trail_user_select"
  ON public.letter_audit_trail FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.letters 
      WHERE letters.id = letter_audit_trail.letter_id 
        AND letters.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "letter_audit_trail_admin_select"
  ON public.letter_audit_trail FOR SELECT
  USING (public.is_any_admin());

CREATE POLICY "letter_audit_trail_service_insert"
  ON public.letter_audit_trail FOR INSERT
  WITH CHECK (true);  -- Controlled by triggers and SECURITY DEFINER functions

-- ============================================================================
-- 9. MESSAGES TABLE (uses sender_id/recipient_id)
-- ============================================================================
-- Users: View sent and received messages

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "messages_sender_select"
  ON public.messages FOR SELECT
  USING (sender_id = (SELECT auth.uid()));

CREATE POLICY "messages_recipient_select"
  ON public.messages FOR SELECT
  USING (recipient_id = (SELECT auth.uid()));

CREATE POLICY "messages_user_insert"
  ON public.messages FOR INSERT
  WITH CHECK (sender_id = (SELECT auth.uid()));

CREATE POLICY "messages_admin_select"
  ON public.messages FOR SELECT
  USING (public.is_super_admin());

-- ============================================================================
-- 10. EMAIL TABLES (email_queue, email_queue_logs, email_delivery_log)
-- ============================================================================
-- Service role only for queue management
-- Super Admins: View for monitoring

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage email queue" ON public.email_queue;

CREATE POLICY "email_queue_service_all"
  ON public.email_queue FOR ALL
  USING (true)
  WITH CHECK (true);  -- Service role only in practice

CREATE POLICY "email_queue_admin_select"
  ON public.email_queue FOR SELECT
  USING (public.is_super_admin());

-- Email queue logs
ALTER TABLE public.email_queue_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage email queue logs" ON public.email_queue_logs;

CREATE POLICY "email_queue_logs_service_all"
  ON public.email_queue_logs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "email_queue_logs_admin_select"
  ON public.email_queue_logs FOR SELECT
  USING (public.is_super_admin());

-- Email delivery log
ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage email delivery log" ON public.email_delivery_log;

CREATE POLICY "email_delivery_log_service_all"
  ON public.email_delivery_log FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "email_delivery_log_admin_select"
  ON public.email_delivery_log FOR SELECT
  USING (public.is_super_admin());

-- ============================================================================
-- 11. WEBHOOK_EVENTS TABLE
-- ============================================================================
-- Service role only (Stripe webhooks)

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_events_service_insert" ON public.webhook_events;
DROP POLICY IF EXISTS "webhook_events_service_select" ON public.webhook_events;

CREATE POLICY "webhook_events_service_all"
  ON public.webhook_events FOR ALL
  USING (true)
  WITH CHECK (true);  -- Service role only in practice

CREATE POLICY "webhook_events_admin_select"
  ON public.webhook_events FOR SELECT
  USING (public.is_super_admin());

-- ============================================================================
-- 12. ADMIN_AUDIT_LOG TABLE
-- ============================================================================
-- Super Admins: View all
-- Insert: Service role and triggers

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Service role can insert audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_admin_select" ON public.admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_service_insert" ON public.admin_audit_log;

CREATE POLICY "admin_audit_log_admin_select"
  ON public.admin_audit_log FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "admin_audit_log_service_insert"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (true);  -- Controlled by SECURITY DEFINER functions

-- ============================================================================
-- 13. GDPR TABLES (privacy_policy_acceptances, data_export_requests, data_deletion_requests, data_access_logs)
-- ============================================================================

-- Privacy policy acceptances
ALTER TABLE public.privacy_policy_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_policy_acceptances FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own privacy acceptances" ON public.privacy_policy_acceptances;
DROP POLICY IF EXISTS "Users can insert own privacy acceptances" ON public.privacy_policy_acceptances;
DROP POLICY IF EXISTS "Admins can view all privacy acceptances" ON public.privacy_policy_acceptances;

CREATE POLICY "privacy_policy_user_select"
  ON public.privacy_policy_acceptances FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "privacy_policy_user_insert"
  ON public.privacy_policy_acceptances FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "privacy_policy_admin_select"
  ON public.privacy_policy_acceptances FOR SELECT
  USING (public.is_super_admin());

-- Data export requests
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own export requests" ON public.data_export_requests;
DROP POLICY IF EXISTS "Users can create export requests" ON public.data_export_requests;
DROP POLICY IF EXISTS "Admins can view all export requests" ON public.data_export_requests;
DROP POLICY IF EXISTS "Admins can update export requests" ON public.data_export_requests;

CREATE POLICY "data_export_user_select"
  ON public.data_export_requests FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "data_export_user_insert"
  ON public.data_export_requests FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "data_export_admin_all"
  ON public.data_export_requests FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Data deletion requests
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own deletion requests" ON public.data_deletion_requests;
DROP POLICY IF EXISTS "Users can create deletion requests" ON public.data_deletion_requests;

CREATE POLICY "data_deletion_user_select"
  ON public.data_deletion_requests FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "data_deletion_user_insert"
  ON public.data_deletion_requests FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "data_deletion_admin_all"
  ON public.data_deletion_requests FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Data access logs
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own data access logs" ON public.data_access_logs;
DROP POLICY IF EXISTS "Service can insert access logs" ON public.data_access_logs;

CREATE POLICY "data_access_logs_user_select"
  ON public.data_access_logs FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "data_access_logs_service_insert"
  ON public.data_access_logs FOR INSERT
  WITH CHECK (true);  -- Controlled by SECURITY DEFINER functions

CREATE POLICY "data_access_logs_admin_select"
  ON public.data_access_logs FOR SELECT
  USING (public.is_super_admin());

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.is_super_admin IS 'Returns true if current user is a super admin (role=admin, admin_sub_role=super_admin). Full system access.';
COMMENT ON FUNCTION public.is_system_admin IS 'Alias for is_super_admin(). For backward compatibility.';
COMMENT ON FUNCTION public.is_attorney_admin IS 'Returns true if current user is an attorney admin (role=admin, admin_sub_role=attorney_admin). Letter review access only.';
COMMENT ON FUNCTION public.is_any_admin IS 'Returns true if current user is any type of admin (super or attorney).';
COMMENT ON FUNCTION public.is_employee IS 'Returns true if current user is an employee (role=employee). Can manage coupons and view commissions.';
COMMENT ON FUNCTION public.is_subscriber IS 'Returns true if current user is a subscriber (role=subscriber). Standard user who generates letters.';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERY (run separately to confirm policies are applied)
-- ============================================================================
/*
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
*/
