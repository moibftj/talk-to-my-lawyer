-- Allow 'processing' status in email_queue to support concurrent worker locking

ALTER TABLE email_queue
DROP CONSTRAINT IF EXISTS email_queue_status_check;

ALTER TABLE email_queue
ADD CONSTRAINT email_queue_status_check
CHECK (status IN ('pending', 'processing', 'sent', 'failed'));
