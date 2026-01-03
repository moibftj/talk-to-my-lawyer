-- Migration 016: Add missing tables and functions
-- This migration adds the coupon_usage table and missing functions

-- Create coupon_usage table
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES employee_coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    discount_amount DECIMAL(10,2) NOT NULL
);

-- Enable RLS on coupon_usage
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coupon_usage
CREATE POLICY "Users can view their coupon usage" ON coupon_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all coupon usage" ON coupon_usage
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Create indexes for performance
CREATE INDEX idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_user_id ON coupon_usage(user_id);
CREATE INDEX idx_coupon_usage_subscription_id ON coupon_usage(subscription_id);
CREATE INDEX idx_coupon_usage_used_at ON coupon_usage(used_at);

-- Add missing function: add_letter_allowances
CREATE OR REPLACE FUNCTION add_letter_allowances(u_id UUID, amount INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sub_record RECORD;
BEGIN
    -- Find active subscription for user
    SELECT id INTO sub_record
    FROM subscriptions
    WHERE user_id = u_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;

    -- If no active subscription, return false
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Add allowances
    UPDATE subscriptions
    SET
        credits_remaining = credits_remaining + amount,
        remaining_letters = remaining_letters + amount,
        updated_at = NOW()
    WHERE id = sub_record.id;

    -- Log the addition if it's a manual adjustment
    IF amount > 0 THEN
        INSERT INTO letter_audit_trail (letter_id, performed_by, action, notes, metadata)
        VALUES (
            gen_random_uuid(),
            u_id,
            'allowance_added',
            format('Added %s letter credits', amount),
            jsonb_build_object('amount', amount, 'subscription_id', sub_record.id)
        );
    END IF;

    RETURN TRUE;
END;
$$;

-- Add missing function: validate_coupon
CREATE OR REPLACE FUNCTION validate_coupon(code TEXT)
RETURNS TABLE (
    coupon_id UUID,
    employee_id UUID,
    discount_percent INT,
    is_active BOOLEAN,
    usage_count INT,
    employee_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ec.id,
        ec.employee_id,
        ec.discount_percent,
        ec.is_active,
        ec.usage_count,
        p.full_name as employee_name
    FROM employee_coupons ec
    LEFT JOIN profiles p ON ec.employee_id = p.id
    WHERE LOWER(ec.code) = LOWER(validate_coupon.code)
    AND ec.is_active = TRUE;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION add_letter_allowances TO authenticated;
GRANT EXECUTE ON FUNCTION validate_coupon TO authenticated;

-- Create trigger to update coupon usage count
CREATE OR REPLACE FUNCTION update_coupon_usage_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Increment the usage count on the coupon
    UPDATE employee_coupons
    SET usage_count = usage_count + 1
    WHERE id = NEW.coupon_id;

    RETURN NEW;
END;
$$;

-- Create trigger to automatically update usage count
CREATE TRIGGER trigger_update_coupon_usage_count
    AFTER INSERT ON coupon_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_coupon_usage_count();

-- Add function to get coupon usage statistics
CREATE OR REPLACE FUNCTION get_coupon_statistics(p_employee_id UUID DEFAULT NULL)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    total_coupons INT,
    total_usage INT,
    active_coupons INT,
    total_discount_given DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ec.employee_id,
        p.full_name as employee_name,
        COUNT(ec.id) as total_coupons,
        COALESCE(SUM(cu.usage_count), 0) as total_usage,
        COUNT(CASE WHEN ec.is_active = TRUE THEN 1 END) as active_coupons,
        COALESCE(SUM(cu.discount_amount), 0) as total_discount_given
    FROM employee_coupons ec
    LEFT JOIN profiles p ON ec.employee_id = p.id
    LEFT JOIN coupon_usage cu ON ec.id = cu.coupon_id
    WHERE (p_employee_id IS NULL OR ec.employee_id = p_employee_id)
    GROUP BY ec.employee_id, p.full_name
    ORDER BY total_usage DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_coupon_statistics TO authenticated;

-- Add comment documenting the migration
COMMENT ON TABLE coupon_usage IS 'Tracks usage of employee discount coupons';
COMMENT ON FUNCTION add_letter_allowances IS 'Adds letter credits to a users active subscription';
COMMENT ON FUNCTION validate_coupon IS 'Validates an employee coupon code and returns details';
COMMENT ON FUNCTION get_coupon_statistics IS 'Returns coupon usage statistics for employees';