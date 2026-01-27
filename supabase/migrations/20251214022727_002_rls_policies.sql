/*
  # Row Level Security Policies

  1. Security Overview
    - Subscribers can only access their own data
    - Employees can access their coupons and commissions only
    - Employees are BLOCKED from accessing letters (critical security requirement)
    - Admin has full access to all data

  2. Policies Created
    - profiles: Users view/update own, admins view all
    - employee_coupons: Employees view own, public can validate active coupons
    - subscriptions: Users view own, admins view all
    - commissions: Employees view own, admins manage all
    - letters: Subscribers view/create/update own, employees blocked, admins full access

  3. Helper Function
    - get_user_role() - Returns current user's role for policy checks
*/

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT role::TEXT FROM public.profiles WHERE id = auth.uid()),
        'subscriber'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    TO authenticated
    USING (public.get_user_role() = 'admin')
    WITH CHECK (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "Employees view own coupons" ON employee_coupons;
CREATE POLICY "Employees view own coupons"
    ON employee_coupons FOR SELECT
    TO authenticated
    USING (employee_id = auth.uid());
DROP POLICY IF EXISTS "Employees create own coupon" ON employee_coupons;
CREATE POLICY "Employees create own coupon"
    ON employee_coupons FOR INSERT
    TO authenticated
    WITH CHECK (employee_id = auth.uid());
DROP POLICY IF EXISTS "Public can validate active coupons" ON employee_coupons;
CREATE POLICY "Public can validate active coupons"
    ON employee_coupons FOR SELECT
    TO authenticated
    USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage all coupons" ON employee_coupons;
CREATE POLICY "Admins manage all coupons"
    ON employee_coupons FOR ALL
    TO authenticated
    USING (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "Users view own subscriptions" ON subscriptions;
CREATE POLICY "Users view own subscriptions"
    ON subscriptions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can create subscriptions" ON subscriptions;
CREATE POLICY "Users can create subscriptions"
    ON subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins view all subscriptions" ON subscriptions;
CREATE POLICY "Admins view all subscriptions"
    ON subscriptions FOR SELECT
    TO authenticated
    USING (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "Admins manage all subscriptions" ON subscriptions;
CREATE POLICY "Admins manage all subscriptions"
    ON subscriptions FOR ALL
    TO authenticated
    USING (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "Employees view own commissions" ON commissions;
CREATE POLICY "Employees view own commissions"
    ON commissions FOR SELECT
    TO authenticated
    USING (employee_id = auth.uid());
DROP POLICY IF EXISTS "Admins view all commissions" ON commissions;
CREATE POLICY "Admins view all commissions"
    ON commissions FOR SELECT
    TO authenticated
    USING (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "Admins create commissions" ON commissions;
CREATE POLICY "Admins create commissions"
    ON commissions FOR INSERT
    TO authenticated
    WITH CHECK (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "Admins update commissions" ON commissions;
CREATE POLICY "Admins update commissions"
    ON commissions FOR UPDATE
    TO authenticated
    USING (public.get_user_role() = 'admin')
    WITH CHECK (public.get_user_role() = 'admin');
DROP POLICY IF EXISTS "Subscribers view own letters" ON letters;
CREATE POLICY "Subscribers view own letters"
    ON letters FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() AND 
        public.get_user_role() = 'subscriber'
    );
DROP POLICY IF EXISTS "Subscribers create own letters" ON letters;
CREATE POLICY "Subscribers create own letters"
    ON letters FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid() AND 
        public.get_user_role() = 'subscriber'
    );
DROP POLICY IF EXISTS "Subscribers update own letters" ON letters;
CREATE POLICY "Subscribers update own letters"
    ON letters FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid() AND 
        public.get_user_role() = 'subscriber'
    )
    WITH CHECK (
        user_id = auth.uid() AND 
        public.get_user_role() = 'subscriber'
    );
DROP POLICY IF EXISTS "Admins full letter access" ON letters;
CREATE POLICY "Admins full letter access"
    ON letters FOR ALL
    TO authenticated
    USING (public.get_user_role() = 'admin');
