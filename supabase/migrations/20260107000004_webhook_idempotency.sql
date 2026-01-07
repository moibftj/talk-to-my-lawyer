/*
  P0-4: Fix Stripe Webhook Idempotency Gap

  This migration adds webhook event tracking to prevent duplicate processing
  when Stripe retries webhook delivery.

  Problem: When Stripe webhooks are retried due to timeout or network issues,
  the same event can be processed multiple times, creating duplicate
  subscriptions, commissions, and coupon usage records.

  Solution: Track processed webhook event IDs in a dedicated table and
  check before processing. Use database constraints to ensure uniqueness.
*/

-- Create webhook_events table to track processed Stripe webhooks
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id
    ON public.webhook_events(stripe_event_id);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
    ON public.webhook_events(processed_at);

-- Create index for event type queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type
    ON public.webhook_events(event_type);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can insert and read
CREATE POLICY webhook_events_service_insert
    ON public.webhook_events
    FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY webhook_events_service_select
    ON public.webhook_events
    FOR SELECT
    TO service_role
    USING (true);

-- Create function to check and record webhook event atomically
CREATE OR REPLACE FUNCTION public.check_and_record_webhook(
    p_stripe_event_id TEXT,
    p_event_type TEXT,
    p_metadata JSONB DEFAULT NULL
)
RETURNS TABLE(
    already_processed BOOLEAN,
    event_id UUID,
    should_process BOOLEAN
) AS $$
DECLARE
    v_event_id UUID;
    v_already_processed BOOLEAN := FALSE;
BEGIN
    -- Try to insert the new webhook event record
    -- If it already exists (UNIQUE constraint violation), we'll catch it
    BEGIN
        INSERT INTO public.webhook_events(
            stripe_event_id,
            event_type,
            metadata
        ) VALUES (
            p_stripe_event_id,
            p_event_type,
            p_metadata
        )
        RETURNING id INTO v_event_id;

        -- Successfully inserted - this is a new event
        v_already_processed := FALSE;

    EXCEPTION
        WHEN unique_violation THEN
            -- Event already processed
            SELECT id, processed_at INTO v_event_id, v_already_processed
            FROM public.webhook_events
            WHERE stripe_event_id = p_stripe_event_id;
    END;

    RETURN QUERY SELECT v_already_processed, v_event_id, (NOT v_already_processed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_and_record_webhook TO service_role;

-- Create cleanup function for old webhook events (to be called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events(
    days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.webhook_events
    WHERE processed_at < NOW() - (days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add comments for documentation
COMMENT ON TABLE public.webhook_events IS 'Tracks processed Stripe webhook events to prevent duplicate processing on retry.';
COMMENT ON FUNCTION public.check_and_record_webhook IS 'Atomically checks if a webhook event was already processed and records it. Returns already_processed=true if the event was previously handled.';
COMMENT ON FUNCTION public.cleanup_old_webhook_events IS 'Removes webhook events older than the specified number of days. Call periodically via cron to manage table size.';
