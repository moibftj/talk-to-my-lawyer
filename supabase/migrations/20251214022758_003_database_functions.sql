/*
  # Database Functions

  1. User Management Functions
    - `handle_new_user()` - Auto-creates profile on auth signup
    - `create_employee_coupon()` - Auto-generates coupon for new employees

  2. Coupon Functions
    - `validate_coupon()` - Validates coupon codes at checkout
    - `increment_usage()` - Increments coupon usage count
    - `get_employee_coupon()` - Gets employee's coupon details

  3. Commission Functions
    - `get_commission_summary()` - Returns commission summary for employee

  4. Triggers
    - `on_auth_user_created` - Creates profile when user signs up
    - `trigger_create_employee_coupon` - Creates coupon when employee profile is created
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role_value user_role;
BEGIN
    user_role_value := COALESCE(
        (NEW.raw_user_meta_data->>'role')::user_role,
        'subscriber'::user_role
    );
    
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        NEW.raw_user_meta_data->>'full_name',
        user_role_value
    );
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        INSERT INTO public.profiles (id, email, full_name, role)
        VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'subscriber');
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE OR REPLACE FUNCTION public.create_employee_coupon()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'employee' THEN
        INSERT INTO public.employee_coupons (employee_id, code, discount_percent, is_active)
        VALUES (
            NEW.id,
            'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT), 1, 6)),
            20,
            true
        )
        ON CONFLICT (employee_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP TRIGGER IF EXISTS trigger_create_employee_coupon ON profiles;
CREATE TRIGGER trigger_create_employee_coupon
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_employee_coupon();
CREATE OR REPLACE FUNCTION public.validate_coupon(coupon_code TEXT)
RETURNS TABLE(
    is_valid BOOLEAN,
    discount_percent INTEGER,
    employee_id UUID,
    message TEXT
) AS $$
DECLARE
    coupon_record RECORD;
BEGIN
    SELECT * INTO coupon_record
    FROM public.employee_coupons
    WHERE code = UPPER(coupon_code)
    AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, NULL::UUID, 'Invalid coupon code'::TEXT;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT 
        true, 
        coupon_record.discount_percent, 
        coupon_record.employee_id, 
        'Coupon valid'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE OR REPLACE FUNCTION public.increment_usage(row_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_count INTEGER;
BEGIN
    UPDATE public.employee_coupons
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = row_id
    RETURNING usage_count INTO current_count;
    
    RETURN COALESCE(current_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE OR REPLACE FUNCTION public.get_employee_coupon(p_employee_id UUID)
RETURNS TABLE (
    id UUID,
    code TEXT,
    discount_percent INT,
    is_active BOOLEAN,
    usage_count INT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ec.id,
        ec.code,
        ec.discount_percent,
        ec.is_active,
        ec.usage_count,
        ec.created_at
    FROM public.employee_coupons ec
    WHERE ec.employee_id = p_employee_id
    ORDER BY ec.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE OR REPLACE FUNCTION public.get_commission_summary(emp_id UUID)
RETURNS TABLE(
    total_earned NUMERIC,
    pending_amount NUMERIC,
    paid_amount NUMERIC,
    commission_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(c.commission_amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.commission_amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.commission_amount ELSE 0 END), 0) as paid_amount,
        COUNT(*)::INTEGER as commission_count
    FROM public.commissions c
    WHERE c.employee_id = emp_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION public.validate_coupon TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_coupon TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_commission_summary TO authenticated;
