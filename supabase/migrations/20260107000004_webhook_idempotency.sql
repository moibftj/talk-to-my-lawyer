-- Webhook Idempotency
-- Fixes duplicate subscription creation on Stripe webhook retries (Issue #4)
-- Tracks processed webhook events and checks before processing

-- Create webhook_events table if not exists
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON public.webhook_events(stripe_event_id);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only service role can manage webhook events
-- Service role (for Stripe webhooks) can insert
CREATE POLICY "webhook_events_service_insert" ON public.webhook_events
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Service role can view all
CREATE POLICY "webhook_events_service_select" ON public.webhook_events
    FOR SELECT
    TO service_role
    USING (true);

-- Super admins can view for monitoring
CREATE POLICY "webhook_events_super_admin_select" ON public.webhook_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.admin_sub_role = 'super_admin'
        )
    );

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.check_and_record_webhook(TEXT, TEXT, JSONB) CASCADE;

-- Create idempotency check function
CREATE OR REPLACE FUNCTION public.check_and_record_webhook(
    p_stripe_event_id TEXT,
    p_event_type TEXT,
    p_metadata JSONB DEFAULT NULL
)
RETURNS TABLE(
    already_processed BOOLEAN,
    event_id UUID
) AS $$
DECLARE
    v_event_id UUID;
    v_already_processed BOOLEAN := FALSE;
BEGIN
    -- Check if event was already processed
    SELECT id, TRUE INTO v_event_id, v_already_processed
    FROM public.webhook_events
    WHERE stripe_event_id = p_stripe_event_id
    LIMIT 1;

    IF v_already_processed THEN
        RETURN QUERY SELECT TRUE, v_event_id;
        RETURN;
    END IF;

    -- Record the new webhook event
    INSERT INTO public.webhook_events(
        stripe_event_id,
        event_type,
        metadata
    ) VALUES (
        p_stripe_event_id,
        p_event_type,
        p_metadata
    )
    ON CONFLICT (stripe_event_id) DO NOTHING
    RETURNING id INTO v_event_id;

    -- Check if it was inserted by another concurrent process
    IF NOT FOUND THEN
        SELECT id, TRUE INTO v_event_id, v_already_processed
        FROM public.webhook_events
        WHERE stripe_event_id = p_stripe_event_id;
    END IF;

    RETURN QUERY SELECT COALESCE(v_already_processed, FALSE), v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to service role (for webhooks)
GRANT EXECUTE ON FUNCTION public.check_and_record_webhook(TEXT, TEXT, JSONB) TO service_role;

-- Grant select permission to authenticated super admins
GRANT SELECT ON TABLE public.webhook_events TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.webhook_events IS
  'Tracks processed Stripe webhook events to prevent duplicate processing on retries. Managed by service role for Stripe webhooks, viewable by super admins for monitoring.';

COMMENT ON FUNCTION public.check_and_record_webhook IS
  'Checks if a Stripe webhook event has already been processed (by stripe_event_id) and records it if not. Returns already_processed=true if the event was already processed, preventing duplicate subscription creation and other idempotency issues.';

-- Cleanup function for old webhook events (to be called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events(
    days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete webhook events older than the specified days
    DELETE FROM public.webhook_events
    WHERE processed_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.cleanup_old_webhook_events(INTEGER) TO service_role;

COMMENT ON FUNCTION public.cleanup_old_webhook_events IS
  'Cleans up old webhook events to prevent table bloat. Called by cron job to delete events older than the specified number of days (default: 30).';
