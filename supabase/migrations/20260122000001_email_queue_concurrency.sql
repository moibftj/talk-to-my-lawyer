-- Email Queue Concurrency Fix
-- Adds FOR UPDATE SKIP LOCKED to prevent duplicate processing by concurrent workers

-- Drop and recreate get_pending_emails with row locking
-- This function now claims and locks rows atomically
DROP FUNCTION IF EXISTS get_pending_emails(INTEGER);

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
  -- Use CTE to SELECT ... FOR UPDATE SKIP LOCKED
  -- This claims rows exclusively so other workers skip them
  RETURN QUERY
  WITH pending AS (
    SELECT eq.id AS email_id
    FROM email_queue eq
    WHERE eq.status = 'pending'
      AND (eq.next_retry_at IS NULL OR eq.next_retry_at <= NOW())
    ORDER BY eq.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
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
  INNER JOIN pending p ON p.email_id = eq.id;
END;
$$;

-- Grant execution to service role
GRANT EXECUTE ON FUNCTION get_pending_emails(INTEGER) TO service_role;

-- Add comment documenting the locking behavior
COMMENT ON FUNCTION get_pending_emails IS 
  'Retrieves and locks pending emails for processing. Uses FOR UPDATE SKIP LOCKED to prevent race conditions when multiple workers run concurrently.';

-- Also create a function that atomically claims emails by setting status to 'processing'
-- This is even safer for distributed systems where locks don't persist across connections
CREATE OR REPLACE FUNCTION claim_pending_emails(p_limit INTEGER DEFAULT 10)
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
  -- Atomically claim and return emails by setting status to 'processing'
  RETURN QUERY
  WITH claimed AS (
    UPDATE email_queue eq
    SET status = 'processing',
        updated_at = NOW()
    WHERE eq.id IN (
      SELECT eq2.id
      FROM email_queue eq2
      WHERE eq2.status = 'pending'
        AND (eq2.next_retry_at IS NULL OR eq2.next_retry_at <= NOW())
      ORDER BY eq2.created_at ASC
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
    )
    RETURNING eq.id, eq."to", eq.subject, eq.html, eq.text, eq.attempts, eq.max_retries, eq.created_at
  )
  SELECT * FROM claimed;
END;
$$;

-- Grant execution to service role
GRANT EXECUTE ON FUNCTION claim_pending_emails(INTEGER) TO service_role;

COMMENT ON FUNCTION claim_pending_emails IS 
  'Atomically claims pending emails by setting status to processing and returning them. More robust than get_pending_emails for distributed systems.';

-- Update mark_email_sent to handle the new 'processing' status
DROP FUNCTION IF EXISTS mark_email_sent(UUID, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION mark_email_sent(
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
  WHERE id = p_email_id
    AND status IN ('pending', 'processing'); -- Allow both statuses

  -- Log the success
  INSERT INTO email_queue_logs (email_id, status, provider, response_time_ms, created_at)
  VALUES (p_email_id, 'sent', p_provider, p_response_time_ms, NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION mark_email_sent(UUID, TEXT, INTEGER) TO service_role;

-- Update mark_email_failed similarly
DROP FUNCTION IF EXISTS mark_email_failed(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION mark_email_failed(
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
  v_current_attempts := COALESCE(v_current_attempts, 0) + 1;
  v_max_retries := COALESCE(v_max_retries, 3);

  IF v_current_attempts >= v_max_retries THEN
    -- Max retries reached, mark as permanently failed
    UPDATE email_queue
    SET
      status = 'failed',
      error_message = p_error_message,
      attempts = v_current_attempts,
      updated_at = NOW()
    WHERE id = p_email_id;
  ELSE
    -- Schedule retry with exponential backoff
    UPDATE email_queue
    SET
      status = 'pending',  -- Back to pending for retry
      error_message = p_error_message,
      attempts = v_current_attempts,
      next_retry_at = NOW() + (POWER(2, v_current_attempts) * INTERVAL '1 minute'),
      updated_at = NOW()
    WHERE id = p_email_id;
  END IF;

  -- Log the failure
  INSERT INTO email_queue_logs (email_id, status, error_message, provider, created_at)
  VALUES (p_email_id, 'failed', p_error_message, p_provider, NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION mark_email_failed(UUID, TEXT, TEXT) TO service_role;

-- Add index to optimize status + next_retry_at queries if not exists
CREATE INDEX IF NOT EXISTS idx_email_queue_processing_status
  ON email_queue(status, next_retry_at, created_at)
  WHERE status IN ('pending', 'processing');

-- Add a cleanup function to reset stuck 'processing' emails
CREATE OR REPLACE FUNCTION reset_stuck_processing_emails(p_timeout_minutes INTEGER DEFAULT 15)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  UPDATE email_queue
  SET status = 'pending',
      updated_at = NOW()
  WHERE status = 'processing'
    AND updated_at < NOW() - (p_timeout_minutes * INTERVAL '1 minute');
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  RETURN v_reset_count;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_stuck_processing_emails(INTEGER) TO service_role;

COMMENT ON FUNCTION reset_stuck_processing_emails IS 
  'Resets emails stuck in processing status for more than the specified timeout (default 15 minutes) back to pending.';
