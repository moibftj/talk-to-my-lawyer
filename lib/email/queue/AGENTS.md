# Email Queue Agent Instructions

Email queue system for reliable delivery with automatic retries.

## Overview

The email queue provides:

- ✅ **Persistence** - Emails survive server restarts
- ✅ **Retries** - Automatic retry with exponential backoff
- ✅ **Monitoring** - Track status in database
- ✅ **Reliability** - Processes via cron job

## Queue Architecture

```
Email Request
    ↓
queueTemplateEmail()
    ↓
1. Try immediate send via Resend
    ├─ Success → Return message ID ✅
    └─ Failure → Save to email_queue table 💾
            ↓
2. Cron job runs every 10 minutes
    ├─ Fetch pending emails (next_retry_at <= NOW)
    ├─ Process up to 10 emails per batch
    ├─ Send via Resend API
    ├─ Update status (sent/failed)
    └─ Calculate next retry time
            ↓
3. Retry Logic (exponential backoff)
    ├─ Attempt 1: Immediate (0 min)
    ├─ Attempt 2: +5 min
    ├─ Attempt 3: +10 min
    └─ Attempt 4: Mark as failed ❌
```

**Implementation:** [../queue.ts](../queue.ts)

## Database Schema

### Table: `email_queue`

```sql
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'sent' | 'failed'
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_next_retry ON email_queue(next_retry_at);
```

## Queue Operations

### Enqueueing Emails

**Via queueTemplateEmail (Recommended):**

```typescript
import { queueTemplateEmail } from '@/lib/email'

// Tries immediate send, falls back to queue on failure
const messageId = await queueTemplateEmail(
  'welcome',
  'user@example.com',
  { userName: 'John', actionUrl: 'https://...' },
  3  // max retries (default: 3)
)
```

**Direct Queue (Bypass Immediate Send):**

```typescript
import { getEmailQueue } from '@/lib/email/queue'

const queue = getEmailQueue()
const queueId = await queue.enqueue({
  to: 'user@example.com',
  subject: 'Subject',
  html: '<p>HTML content</p>',
  text: 'Plain text'
}, 3)  // max retries
```

### Processing Queue

**Automatic (Cron Job):**

Runs every 10 minutes via Vercel Cron:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/process-email-queue",
    "schedule": "*/10 * * * *"
  }]
}
```

**Manual Trigger:**

```bash
# Via API (secured with CRON_SECRET)
curl -X POST "https://your-domain.com/api/cron/process-email-queue?secret=YOUR_CRON_SECRET"

# Or programmatically
import { processEmailQueue } from '@/lib/email/queue'
const stats = await processEmailQueue()
console.log(stats)
// { processed: 5, failed: 1, remaining: 10 }
```

## Monitoring the Queue

### Check Queue Status

```sql
-- Overview
SELECT
  status,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM email_queue
GROUP BY status;

-- Expected output:
-- status  | count | latest
-- --------|-------|-------------------
-- pending |   5   | 2024-01-12 10:30
-- sent    |  142  | 2024-01-12 10:35
-- failed  |   3   | 2024-01-12 09:15
```

### Check Pending Emails

```sql
SELECT
  id,
  to,
  subject,
  attempts,
  next_retry_at,
  created_at,
  error
FROM email_queue
WHERE status = 'pending'
ORDER BY next_retry_at ASC;
```

### Check Failed Emails

```sql
SELECT
  id,
  to,
  subject,
  attempts,
  error,
  created_at
FROM email_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Queue Performance

```sql
-- Average delivery time (for successful sends)
SELECT AVG(sent_at - created_at) as avg_delivery_time
FROM email_queue
WHERE status = 'sent'
AND created_at > NOW() - INTERVAL '24 hours';

-- Success rate (last 24 hours)
SELECT
  status,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM email_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

## Common Queue Issues

### Issue 1: Emails Stuck in Pending

**Symptoms:**

- Emails remain `status = 'pending'`
- `next_retry_at` is in the past
- Queue count keeps growing

**Diagnosis:**

```sql
SELECT COUNT(*) as stuck_emails
FROM email_queue
WHERE status = 'pending'
AND next_retry_at < NOW() - INTERVAL '30 minutes';
```

**Solutions:**

1. **Check Cron Job Running:**

   ```bash
   # Check Vercel logs
   vercel logs --follow

   # Look for: "Processing email queue..."
   ```

2. **Manually Trigger Queue:**

   ```bash
   curl -X POST "https://your-domain.com/api/cron/process-email-queue?secret=YOUR_CRON_SECRET"
   ```

3. **Reset Stuck Emails:**

   ```sql
   -- Reset retry timer
   UPDATE email_queue
   SET next_retry_at = NOW(), attempts = 0
   WHERE status = 'pending'
   AND next_retry_at < NOW() - INTERVAL '1 hour';
   ```

4. **Check CRON_SECRET:**

   - Verify it's set in `.env.local` and Vercel
   - Must match between environment and cron calls

### Issue 2: High Failure Rate

**Symptoms:**

- Many emails with `status = 'failed'`
- All emails failing with same error

**Diagnosis:**

```sql
SELECT error, COUNT(*) as count
FROM email_queue
WHERE status = 'failed'
GROUP BY error
ORDER BY count DESC;
```

**Common Errors & Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Resend is not configured" | Missing API key | Set `RESEND_API_KEY` in environment |
| "Invalid recipient" | Bad email address | Validate emails before queueing |
| "Domain not verified" | Custom domain not verified | Use `onboarding@resend.dev` or verify domain |
| "Rate limit exceeded" | Too many emails | Upgrade Resend plan or throttle sends |
| "Network timeout" | Resend API down | Check https://status.resend.com |

### Issue 3: Queue Growing Too Large

**Symptoms:**

- Thousands of pending emails
- Processing slow

**Diagnosis:**

```sql
SELECT COUNT(*) FROM email_queue WHERE status = 'pending';
```

**Solutions:**

1. **Increase Processing Frequency:**

   ```json
   // vercel.json - Change from */10 to */5 (every 5 min)
   {
     "crons": [{
       "path": "/api/cron/process-email-queue",
       "schedule": "*/5 * * * *"
     }]
   }
   ```

2. **Increase Batch Size:**

   Edit [../queue.ts](../queue.ts):

   ```typescript
   // Change from 10 to 20
   .limit(20)
   ```

3. **Manual Bulk Processing:**

   ```bash
   # Run multiple times
   for i in {1..5}; do
     curl -X POST "https://your-domain.com/api/cron/process-email-queue?secret=SECRET"
     sleep 2
   done
   ```

### Issue 4: Duplicate Emails

**Symptoms:**

- Users receiving multiple copies
- Same email in queue multiple times

**Diagnosis:**

```sql
SELECT to, subject, COUNT(*) as duplicates
FROM email_queue
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY to, subject
HAVING COUNT(*) > 1;
```

**Solutions:**

1. **Check Application Code:**
   - Ensure not calling `queueTemplateEmail()` multiple times
   - Check for duplicate event handlers

2. **Add Idempotency:**

   ```typescript
   // Before queuing, check if already sent recently
   const { data: recent } = await supabase
     .from('email_queue')
     .select('id')
     .eq('to', email)
     .eq('subject', subject)
     .gte('created_at', new Date(Date.now() - 60000).toISOString())
     .single()

   if (!recent) {
     await queueTemplateEmail(...)
   }
   ```

## Queue Maintenance

### Cleanup Old Emails

**Sent Emails (>30 days):**

```sql
DELETE FROM email_queue
WHERE status = 'sent'
AND sent_at < NOW() - INTERVAL '30 days';
```

**Failed Emails (>7 days):**

```sql
DELETE FROM email_queue
WHERE status = 'failed'
AND created_at < NOW() - INTERVAL '7 days';
```

**Automated Cleanup (Recommended):**

Create a new cron job in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-email-queue",
      "schedule": "0 2 * * *"  // 2 AM daily
    }
  ]
}
```

### Retry Failed Emails

```sql
-- Retry all failed emails from last 24 hours
UPDATE email_queue
SET
  status = 'pending',
  attempts = 0,
  next_retry_at = NOW(),
  error = NULL
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '24 hours';
```

### Archive Old Emails

Instead of deleting, archive to separate table:

```sql
-- Create archive table
CREATE TABLE email_queue_archive AS SELECT * FROM email_queue WHERE false;

-- Move old sent emails
INSERT INTO email_queue_archive
SELECT * FROM email_queue
WHERE status = 'sent'
AND sent_at < NOW() - INTERVAL '90 days';

-- Delete from main queue
DELETE FROM email_queue
WHERE status = 'sent'
AND sent_at < NOW() - INTERVAL '90 days';
```

## Testing the Queue

### Test Enqueue

```javascript
// test-queue.js
const { getEmailQueue } = require('./lib/email/queue')

async function test() {
  const queue = getEmailQueue()

  const id = await queue.enqueue({
    to: 'test@example.com',
    subject: 'Test Email',
    html: '<p>Test</p>',
    text: 'Test'
  })

  console.log('Queued:', id)
}

test()
```

### Test Processing

```bash
# 1. Add test email to queue
node test-queue.js

# 2. Check it's pending
psql -c "SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 1"

# 3. Process queue
curl -X POST "http://localhost:3000/api/cron/process-email-queue?secret=YOUR_SECRET"

# 4. Check it's sent
psql -c "SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 1"
```

## API Reference

### `getEmailQueue()`

Returns queue instance.

```typescript
import { getEmailQueue } from '@/lib/email/queue'
const queue = getEmailQueue()
```

### `queue.enqueue(message, maxRetries)`

Add email to queue.

```typescript
const queueId = await queue.enqueue({
  to: 'user@example.com',
  subject: 'Subject',
  html: '<p>HTML</p>',
  text: 'Plain text'
}, 3)  // max retries
```

### `processEmailQueue()`

Process pending emails (called by cron).

```typescript
import { processEmailQueue } from '@/lib/email/queue'

const stats = await processEmailQueue()
// { processed: 5, failed: 1, remaining: 10 }
```

## Configuration

### Environment Variables

```bash
# Required for queue
SUPABASE_SERVICE_ROLE_KEY=xxxxx  # For database access
CRON_SECRET=xxxxx                # For cron security

# Required for sending
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### Retry Configuration

Edit [../queue.ts](../queue.ts):

```typescript
// Default retry delays
const delays = [0, 300000, 600000, 1200000]  // 0, 5min, 10min, 20min

// Change max retries default
const MAX_RETRIES = 3  // Change to 5 for more retries
```

## Monitoring & Alerts

### Recommended Alerts

Set up monitoring for:

1. **Queue Size > 100**
   ```sql
   SELECT COUNT(*) FROM email_queue WHERE status = 'pending'
   ```

2. **Old Pending Emails**
   ```sql
   SELECT COUNT(*) FROM email_queue
   WHERE status = 'pending'
   AND created_at < NOW() - INTERVAL '1 hour'
   ```

3. **High Failure Rate**
   ```sql
   SELECT COUNT(*) FROM email_queue
   WHERE status = 'failed'
   AND created_at > NOW() - INTERVAL '1 hour'
   ```

4. **Cron Not Running**
   - Check Vercel logs for cron executions
   - Alert if no execution in last 15 minutes

## Related Files

- [../AGENTS.md](../AGENTS.md) - Email service overview
- [../queue.ts](../queue.ts) - Queue implementation
- [../../api/cron/AGENTS.md](../../app/api/cron/AGENTS.md) - Cron job details
- [../../../docs/EMAIL_SETUP.md](../../../docs/EMAIL_SETUP.md) - Setup guide

## Quick Reference

```bash
# Check queue status
SELECT status, COUNT(*) FROM email_queue GROUP BY status;

# Process queue manually
curl -X POST "https://your-domain.com/api/cron/process-email-queue?secret=SECRET"

# Clean old emails
DELETE FROM email_queue WHERE status = 'sent' AND sent_at < NOW() - INTERVAL '30 days';

# Retry failed emails
UPDATE email_queue SET status='pending', attempts=0, next_retry_at=NOW() WHERE status='failed';
```
