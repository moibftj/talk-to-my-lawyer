-- Email Queue RPC Functions for Edge Function
-- These functions are used by the process-email-queue Edge Function

-- Get pending emails for processing
CREATE OR REPLACE FUNCTION get_pending_emails(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  "to" TEXT,
  subject TEXT,
  html TEXT,
  text TEXT,
  attempts INTEGER,
  max_retries INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
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
  WHERE eq.status = 'pending'
    AND (eq.next_retry_at IS NULL OR eq.next_retry_at <= NOW())
  ORDER BY eq.created_at ASC
  LIMIT p_limit;
END;
$$;

-- Mark email as sent
DROP FUNCTION IF EXISTS mark_email_sent(UUID, TEXT, INTEGER) CASCADE;
CREATE FUNCTION mark_email_sent(
  p_email_id UUID,
  p_provider TEXT DEFAULT 'resend',
  p_response_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE email_queue
  SET
    status = 'sent',
    sent_at = NOW(),
    updated_at = NOW(),
    attempts = attempts + 1
  WHERE id = p_email_id;

  -- Log the success
  INSERT INTO email_queue_logs (email_id, status, provider, response_time_ms, created_at)
  VALUES (p_email_id, 'sent', p_provider, p_response_time_ms, NOW());
END;
$$;

-- Mark email as failed
DROP FUNCTION IF EXISTS mark_email_failed(UUID, TEXT, TEXT) CASCADE;
CREATE FUNCTION mark_email_failed(
  p_email_id UUID,
  p_error_message TEXT,
  p_provider TEXT DEFAULT 'resend'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_attempts INTEGER;
  v_max_retries INTEGER;
BEGIN
  -- Get current attempts and max retries
  SELECT attempts, max_retries INTO v_current_attempts, v_max_retries
  FROM email_queue
  WHERE id = p_email_id;

  -- Increment attempts
  v_current_attempts := v_current_attempts + 1;

  -- Check if we should retry or mark as permanently failed
  IF v_current_attempts >= v_max_retries THEN
    -- Permanently failed
    UPDATE email_queue
    SET
      status = 'failed',
      error = p_error_message,
      attempts = v_current_attempts,
      updated_at = NOW()
    WHERE id = p_email_id;
  ELSE
    -- Schedule for retry with exponential backoff
    UPDATE email_queue
    SET
      status = 'pending',
      error = p_error_message,
      attempts = v_current_attempts,
      next_retry_at = NOW() + (POWER(2, v_current_attempts) * INTERVAL '5 minutes'),
      updated_at = NOW()
    WHERE id = p_email_id;
  END IF;

  -- Log the failure
  INSERT INTO email_queue_logs (email_id, status, error_message, provider, created_at)
  VALUES (p_email_id, 'failed', p_error_message, p_provider, NOW());
END;
$$;

-- Create email_queue_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_queue_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES email_queue(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  error_message TEXT,
  provider TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_queue_logs_email_id ON email_queue_logs(email_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_logs_created_at ON email_queue_logs(created_at DESC);

-- Add comments for documentation
COMMENT ON FUNCTION get_pending_emails IS 'Retrieves pending emails that are ready for processing';
COMMENT ON FUNCTION mark_email_sent IS 'Marks an email as successfully sent and logs the result';
COMMENT ON FUNCTION mark_email_failed IS 'Marks an email as failed and schedules retry if appropriate';
COMMENT ON TABLE email_queue_logs IS 'Audit log for email queue processing';
