/*
  # Security and Performance Fixes

  1. Overview
    - Adds missing index for foreign key on commissions.subscription_id
    - Optimizes all RLS policies by wrapping auth.uid() in (select auth.uid())
      to prevent re-evaluation for each row
    - Updates security definer views to use invoker where appropriate

  2. Changes
    - Creates index on commissions.subscription_id for FK performance
    - Recreates RLS policies with optimized auth function calls
    - Converts security definer views to security invoker

  3. Security
    - No changes to access control logic
    - Performance optimization only
    - Maintains existing security model
*/

-- 1. Add missing index for foreign key on commissions.subscription_id
CREATE INDEX IF NOT EXISTS idx_commissions_subscription_id 
ON public.commissions(subscription_id);
-- 2. Optimize RLS policies by using (select auth.uid()) pattern

-- profiles table policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
-- employee_coupons table policies
DROP POLICY IF EXISTS "Employees view own coupons" ON public.employee_coupons;
CREATE POLICY "Employees view own coupons" ON public.employee_coupons
  FOR SELECT TO authenticated
  USING (
    employee_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'employee'
    )
  );
DROP POLICY IF EXISTS "Employees create own coupon" ON public.employee_coupons;
CREATE POLICY "Employees create own coupon" ON public.employee_coupons
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'employee'
    )
  );
-- subscriptions table policies
DROP POLICY IF EXISTS "Users view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users view own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users can create subscriptions" ON public.subscriptions;
CREATE POLICY "Users can create subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
-- commissions table policies
DROP POLICY IF EXISTS "Employees view own commissions" ON public.commissions;
CREATE POLICY "Employees view own commissions" ON public.commissions
  FOR SELECT TO authenticated
  USING (
    employee_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'employee'
    )
  );
-- letters table policies
DROP POLICY IF EXISTS "Subscribers view own letters" ON public.letters;
CREATE POLICY "Subscribers view own letters" ON public.letters
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'subscriber'
    )
  );
DROP POLICY IF EXISTS "Subscribers create own letters" ON public.letters;
CREATE POLICY "Subscribers create own letters" ON public.letters
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'subscriber'
    )
  );
DROP POLICY IF EXISTS "Subscribers update own letters" ON public.letters;
CREATE POLICY "Subscribers update own letters" ON public.letters
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'subscriber'
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'subscriber'
    )
  );
-- letter_audit_trail table policies
DROP POLICY IF EXISTS "Users view own letter audit" ON public.letter_audit_trail;
CREATE POLICY "Users view own letter audit" ON public.letter_audit_trail
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.letters
      WHERE letters.id = letter_audit_trail.letter_id
      AND letters.user_id = (SELECT auth.uid())
    )
  );
-- coupon_usage table policies
DROP POLICY IF EXISTS "Users can view own coupon usage" ON public.coupon_usage;
CREATE POLICY "Users can view own coupon usage" ON public.coupon_usage
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Employees can view their coupon usage" ON public.coupon_usage;
CREATE POLICY "Employees can view their coupon usage" ON public.coupon_usage
  FOR SELECT TO authenticated
  USING (
    employee_id = (SELECT auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'employee'
    )
  );
-- 3. Convert security definer views to security invoker
-- This ensures views respect the caller's RLS policies

DROP VIEW IF EXISTS public.pending_review_letters_view;
CREATE VIEW public.pending_review_letters_view
WITH (security_invoker = true)
AS
SELECT 
  l.id,
  l.title,
  l.status,
  l.created_at,
  l.updated_at,
  l.user_id,
  p.email as user_email,
  p.full_name as user_name
FROM public.letters l
LEFT JOIN public.profiles p ON l.user_id = p.id
WHERE l.status IN ('pending_review', 'under_review')
ORDER BY l.created_at ASC;
DROP VIEW IF EXISTS public.active_subscriptions_view;
CREATE VIEW public.active_subscriptions_view
WITH (security_invoker = true)
AS
SELECT 
  s.id,
  s.user_id,
  s.plan_type,
  s.status,
  s.credits_remaining,
  s.current_period_start,
  s.current_period_end,
  s.created_at,
  p.email as user_email,
  p.full_name as user_name
FROM public.subscriptions s
LEFT JOIN public.profiles p ON s.user_id = p.id
WHERE s.status = 'active'
ORDER BY s.created_at DESC;
-- Grant access to authenticated users
GRANT SELECT ON public.pending_review_letters_view TO authenticated;
GRANT SELECT ON public.active_subscriptions_view TO authenticated;
-- Add comments
COMMENT ON INDEX idx_commissions_subscription_id IS 'Index for foreign key commissions.subscription_id to optimize joins';
COMMENT ON VIEW public.pending_review_letters_view IS 'Security invoker view for pending review letters - respects caller RLS';
COMMENT ON VIEW public.active_subscriptions_view IS 'Security invoker view for active subscriptions - respects caller RLS';
