/*
  # Analytics and Database Optimization Migration

  1. New Functions
    - `get_admin_dashboard_stats()` - Returns key metrics for admin dashboard
    - `get_letter_statistics()` - Returns letter generation statistics
    - `get_subscription_analytics()` - Returns subscription metrics
    - `get_revenue_summary()` - Returns revenue and commission data
    - `cleanup_failed_letters()` - Cleans up old failed letter records
    - `get_user_activity_summary()` - Returns user activity metrics

  2. Performance Indexes
    - Composite indexes for common query patterns
    - Partial indexes for active records

  3. Views
    - `active_subscriptions_view` - For quick subscription queries
    - `pending_review_letters_view` - For admin review queue
*/

DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE(
    total_users INTEGER,
    total_subscribers INTEGER,
    total_employees INTEGER,
    pending_letters INTEGER,
    approved_letters_today INTEGER,
    total_revenue NUMERIC,
    pending_commissions NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM public.profiles)::INTEGER as total_users,
        (SELECT COUNT(*)::INTEGER FROM public.profiles WHERE role = 'subscriber')::INTEGER as total_subscribers,
        (SELECT COUNT(*)::INTEGER FROM public.profiles WHERE role = 'employee')::INTEGER as total_employees,
        (SELECT COUNT(*)::INTEGER FROM public.letters WHERE status IN ('pending_review', 'under_review'))::INTEGER as pending_letters,
        (SELECT COUNT(*)::INTEGER FROM public.letters WHERE status = 'approved' AND approved_at::DATE = CURRENT_DATE)::INTEGER as approved_letters_today,
        COALESCE((SELECT SUM(price - COALESCE(discount, 0)) FROM public.subscriptions WHERE status = 'active'), 0)::NUMERIC as total_revenue,
        COALESCE((SELECT SUM(commission_amount) FROM public.commissions WHERE status = 'pending'), 0)::NUMERIC as pending_commissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.get_letter_statistics(INTEGER);
CREATE OR REPLACE FUNCTION public.get_letter_statistics(days_back INTEGER DEFAULT 30)
RETURNS TABLE(
    total_letters INTEGER,
    pending_count INTEGER,
    approved_count INTEGER,
    rejected_count INTEGER,
    failed_count INTEGER,
    avg_review_time_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM public.letters WHERE created_at > NOW() - (days_back || ' days')::INTERVAL)::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM public.letters WHERE status IN ('pending_review', 'under_review') AND created_at > NOW() - (days_back || ' days')::INTERVAL)::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM public.letters WHERE status = 'approved' AND created_at > NOW() - (days_back || ' days')::INTERVAL)::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM public.letters WHERE status = 'rejected' AND created_at > NOW() - (days_back || ' days')::INTERVAL)::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM public.letters WHERE status = 'failed' AND created_at > NOW() - (days_back || ' days')::INTERVAL)::INTEGER,
        COALESCE((
            SELECT AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 3600)::NUMERIC(10,2)
            FROM public.letters
            WHERE status = 'approved'
            AND approved_at IS NOT NULL
            AND created_at > NOW() - (days_back || ' days')::INTERVAL
        ), 0)::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.get_subscription_analytics();
CREATE OR REPLACE FUNCTION public.get_subscription_analytics()
RETURNS TABLE(
    active_subscriptions INTEGER,
    monthly_subscriptions INTEGER,
    yearly_subscriptions INTEGER,
    one_time_purchases INTEGER,
    total_credits_remaining INTEGER,
    avg_credits_per_user NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM public.subscriptions WHERE status = 'active')::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM public.subscriptions WHERE status = 'active' AND plan_type IN ('standard_4_month', 'monthly'))::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM public.subscriptions WHERE status = 'active' AND plan_type IN ('premium_8_month', 'yearly'))::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM public.subscriptions WHERE status = 'active' AND plan_type IN ('one_time', 'single_letter'))::INTEGER,
        COALESCE((SELECT SUM(COALESCE(credits_remaining, remaining_letters, 0))::INTEGER FROM public.subscriptions WHERE status = 'active'), 0)::INTEGER,
        COALESCE((SELECT AVG(COALESCE(credits_remaining, remaining_letters, 0))::NUMERIC(10,2) FROM public.subscriptions WHERE status = 'active'), 0)::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.get_revenue_summary(INTEGER);
CREATE OR REPLACE FUNCTION public.get_revenue_summary(months_back INTEGER DEFAULT 12)
RETURNS TABLE(
    month_year TEXT,
    subscription_revenue NUMERIC,
    commission_paid NUMERIC,
    net_revenue NUMERIC,
    new_subscriptions INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH months AS (
        SELECT generate_series(
            DATE_TRUNC('month', NOW() - (months_back || ' months')::INTERVAL),
            DATE_TRUNC('month', NOW()),
            '1 month'::INTERVAL
        ) as month_start
    )
    SELECT
        TO_CHAR(m.month_start, 'YYYY-MM') as month_year,
        COALESCE(SUM(s.price - COALESCE(s.discount, 0)), 0)::NUMERIC as subscription_revenue,
        COALESCE(SUM(c.commission_amount) FILTER (WHERE c.status = 'paid'), 0)::NUMERIC as commission_paid,
        COALESCE(SUM(s.price - COALESCE(s.discount, 0)), 0) - COALESCE(SUM(c.commission_amount) FILTER (WHERE c.status = 'paid'), 0) as net_revenue,
        COUNT(DISTINCT s.id)::INTEGER as new_subscriptions
    FROM months m
    LEFT JOIN public.subscriptions s ON DATE_TRUNC('month', s.created_at) = m.month_start
    LEFT JOIN public.commissions c ON c.subscription_id = s.id
    GROUP BY m.month_start
    ORDER BY m.month_start DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.cleanup_failed_letters(INTEGER);
CREATE OR REPLACE FUNCTION public.cleanup_failed_letters(older_than_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.letters
    WHERE status = 'failed'
    AND created_at < NOW() - (older_than_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP FUNCTION IF EXISTS public.get_user_activity_summary(UUID);
CREATE OR REPLACE FUNCTION public.get_user_activity_summary(u_id UUID)
RETURNS TABLE(
    total_letters INTEGER,
    approved_letters INTEGER,
    pending_letters INTEGER,
    subscription_status TEXT,
    credits_remaining INTEGER,
    member_since TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM public.letters WHERE user_id = u_id)::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM public.letters WHERE user_id = u_id AND status IN ('approved', 'completed'))::INTEGER,
        (SELECT COUNT(*)::INTEGER FROM public.letters WHERE user_id = u_id AND status IN ('pending_review', 'under_review', 'generating'))::INTEGER,
        COALESCE((SELECT s.status::TEXT FROM public.subscriptions s WHERE s.user_id = u_id AND s.status = 'active' ORDER BY s.created_at DESC LIMIT 1), 'none')::TEXT,
        COALESCE((SELECT COALESCE(s.credits_remaining, s.remaining_letters, 0)::INTEGER FROM public.subscriptions s WHERE s.user_id = u_id AND s.status = 'active' ORDER BY s.created_at DESC LIMIT 1), 0)::INTEGER,
        (SELECT p.created_at FROM public.profiles p WHERE p.id = u_id)::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE INDEX IF NOT EXISTS idx_letters_user_status ON public.letters(user_id, status);
CREATE INDEX IF NOT EXISTS idx_letters_created_status ON public.letters(created_at DESC, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_commissions_employee_status ON public.commissions(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_letters_pending ON public.letters(created_at DESC) WHERE status IN ('pending_review', 'under_review');
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON public.subscriptions(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_commissions_pending ON public.commissions(employee_id) WHERE status = 'pending';
CREATE OR REPLACE VIEW public.active_subscriptions_view AS
SELECT 
    s.id,
    s.user_id,
    p.email,
    p.full_name,
    s.plan_type,
    s.status,
    s.credits_remaining,
    s.remaining_letters,
    s.current_period_start,
    s.current_period_end,
    s.created_at
FROM public.subscriptions s
JOIN public.profiles p ON s.user_id = p.id
WHERE s.status = 'active';
CREATE OR REPLACE VIEW public.pending_review_letters_view AS
SELECT 
    l.id,
    l.title,
    l.status,
    l.letter_type,
    l.created_at,
    l.updated_at,
    p.id as user_id,
    p.email as user_email,
    p.full_name as user_name,
    EXTRACT(EPOCH FROM (NOW() - l.created_at)) / 3600 as hours_pending
FROM public.letters l
JOIN public.profiles p ON l.user_id = p.id
WHERE l.status IN ('pending_review', 'under_review')
ORDER BY l.created_at ASC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_letter_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_revenue_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_activity_summary TO authenticated;
COMMENT ON FUNCTION public.get_admin_dashboard_stats IS 'Returns key metrics for the admin dashboard including user counts, pending letters, and revenue';
COMMENT ON FUNCTION public.get_letter_statistics IS 'Returns letter generation statistics for the specified time period';
COMMENT ON FUNCTION public.get_subscription_analytics IS 'Returns subscription metrics including active plans and credit utilization';
COMMENT ON FUNCTION public.get_revenue_summary IS 'Returns monthly revenue breakdown including commissions';
COMMENT ON FUNCTION public.cleanup_failed_letters IS 'Removes failed letter records older than specified days to maintain database hygiene';
COMMENT ON FUNCTION public.get_user_activity_summary IS 'Returns activity summary for a specific user';
