# Email Service Agent Instructions

This directory contains the core email service for Talk-To-My-Lawyer.

## Quick Diagnostic Checklist

When debugging email issues, follow this order:

### 1. Check Resend Configuration

```bash
# Run the config checker
node check-email-config.js
```

**Required Environment Variables:**

- `RESEND_API_KEY` - From https://resend.com/api-keys
- `EMAIL_FROM` - Sender email (must be verified domain or use `onboarding@resend.dev` for testing)
- `EMAIL_FROM_NAME` - Display name (optional, defaults to "Talk-To-My-Lawyer")

**Verify in Code:**

- Check [lib/email/service.ts:20-26](service.ts#L20-L26) for initialization
- Check [lib/email/providers/resend.ts:10-17](providers/resend.ts#L10-L17) for API key loading

### 2. Test Email Sending

```bash
# Test direct send
node test-email-send.js

# Or use API
curl -X POST http://localhost:3000/api/test-email
```

### 3. Check Email Queue

```sql
-- Check queue status
SELECT status, COUNT(*)
FROM email_queue
GROUP BY status;

-- Check recent emails
SELECT id, to, subject, status, attempts, error, created_at
FROM email_queue
ORDER BY created_at DESC
LIMIT 10;

-- Check stuck emails
SELECT id, to, subject, attempts, next_retry_at, error
FROM email_queue
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '1 hour';
```

### 4. Verify Resend Dashboard

1. Go to https://resend.com/emails
2. Check delivery status
3. Look for bounces or errors
4. Verify domain is verified (if using custom domain)

## Architecture Overview

### Email Sending Flow

```
Application Code
    ↓
queueTemplateEmail()  (Recommended)
    ↓
Try Immediate Send via Resend
    ↓
    ├─ Success → Return message ID
    │
    └─ Failure → Save to email_queue
            ↓
        Cron job processes queue every 10 min
            ↓
        Retry with exponential backoff
```

**Key Files:**

- [service.ts](service.ts) - Main email service class
- [queue.ts](queue.ts) - Queue management and retry logic
- [providers/resend.ts](providers/resend.ts) - Resend API integration
- [templates.ts](templates.ts) - All email templates

### How Email Sending Works

**Method 1: Queue with Immediate Send (Recommended)**

```typescript
import { queueTemplateEmail } from '@/lib/email'

// Sends immediately, falls back to queue on failure
await queueTemplateEmail(
  'welcome',
  'user@example.com',
  { userName: 'John', actionUrl: 'https://...' }
)
```

Implementation: [service.ts:152-195](service.ts#L152-L195)

**Method 2: Direct Send (For urgent notifications only)**

```typescript
import { sendTemplateEmail } from '@/lib/email'

// No retry - fails if Resend is down
await sendTemplateEmail('security-alert', 'admin@example.com', { ... })
```

Implementation: [service.ts:130-136](service.ts#L130-L136)

## Common Issues & Solutions

### Issue 1: Emails Not Sending

**Symptoms:**

- No emails arriving
- No errors in logs
- Queue shows pending emails

**Diagnosis:**

```bash
# Check environment
node check-email-config.js

# Check service status
curl http://localhost:3000/api/health/detailed
```

**Solutions:**

1. **Missing RESEND_API_KEY**
   - Get key from https://resend.com/api-keys
   - Add to `.env.local`: `RESEND_API_KEY=re_xxxxx`
   - Add to Vercel: Dashboard → Settings → Environment Variables
   - Restart dev server or redeploy

2. **Invalid EMAIL_FROM**
   - Use `onboarding@resend.dev` for testing (no verification needed)
   - For production, verify your domain in Resend dashboard
   - Update `.env.local`: `EMAIL_FROM=onboarding@resend.dev`

3. **Cron Job Not Running**
   - Check Vercel logs for cron executions
   - Manually trigger: `curl -X POST "https://your-domain.com/api/cron/process-email-queue?secret=YOUR_CRON_SECRET"`
   - Verify `CRON_SECRET` is set

### Issue 2: Emails Stuck in Queue

**Symptoms:**

- Emails have `status = 'pending'`
- `next_retry_at` is in the past
- No delivery logs in Resend

**Diagnosis:**

```sql
SELECT id, to, subject, attempts, next_retry_at, created_at
FROM email_queue
WHERE status = 'pending'
ORDER BY created_at DESC;
```

**Solutions:**

1. **Manually Trigger Queue Processing**

   ```bash
   curl -X POST "https://your-domain.com/api/cron/process-email-queue?secret=YOUR_CRON_SECRET"
   ```

2. **Check for Errors**

   ```sql
   SELECT error FROM email_queue WHERE status = 'failed';
   ```

3. **Reset Stuck Emails**

   ```sql
   UPDATE email_queue
   SET next_retry_at = NOW(), attempts = 0
   WHERE status = 'pending'
   AND created_at < NOW() - INTERVAL '1 hour';
   ```

### Issue 3: Template Rendering Errors

**Symptoms:**

- Email sends but looks broken
- Missing data in email
- HTML not rendering

**Diagnosis:**

Check template in [templates.ts](templates.ts) and verify all required data fields are provided.

**Solutions:**

See [templates/AGENTS.md](templates/AGENTS.md) for template-specific troubleshooting.

### Issue 4: Rate Limiting

**Symptoms:**

- Resend returns 429 errors
- Free plan limit exceeded

**Solutions:**

1. **Check Resend Dashboard**
   - Free plan: 100 emails/day, 3,000/month
   - Upgrade if needed

2. **Implement Application Rate Limiting**
   - Already implemented on sensitive endpoints
   - Check [rate-limit-redis.ts](../rate-limit-redis.ts)

## Testing

### Local Testing

```bash
# 1. Set up environment
cp .env.example .env.local
# Add RESEND_API_KEY

# 2. Test email service
node test-email-send.js

# 3. Start dev server
pnpm dev

# 4. Test via UI
# Sign up new user → check for welcome email
```

### Production Testing

```bash
# 1. Check environment variables in Vercel
# Dashboard → Settings → Environment Variables

# 2. Deploy and check logs
vercel logs

# 3. Test email flow
# Sign up test user
# Check Resend dashboard for delivery

# 4. Monitor queue
# Run SQL queries against production database
```

## Monitoring

### Key Metrics

```sql
-- Email success rate (last 24 hours)
SELECT
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts
FROM email_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Average delivery time
SELECT AVG(sent_at - created_at) as avg_delivery_time
FROM email_queue
WHERE status = 'sent'
AND created_at > NOW() - INTERVAL '24 hours';

-- Failed email reasons
SELECT error, COUNT(*) as count
FROM email_queue
WHERE status = 'failed'
GROUP BY error
ORDER BY count DESC;
```

### Alerts to Set Up

1. Queue size > 100 emails
2. Failed rate > 10%
3. Emails pending > 1 hour
4. Resend API errors

## Related Files

- [queue/AGENTS.md](queue/AGENTS.md) - Queue management details
- [templates/AGENTS.md](templates/AGENTS.md) - Template customization
- [providers/resend.ts](providers/resend.ts) - Resend integration
- [../AGENTS.md](../AGENTS.md) - Parent directory instructions

## Environment Variables

```bash
# Required
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@yourdomain.com

# Optional
EMAIL_FROM_NAME=Talk-To-My-Lawyer

# Required for queue
SUPABASE_SERVICE_ROLE_KEY=xxxxx
CRON_SECRET=xxxxx
```

## Quick Reference

| Function | File | Purpose |
|----------|------|---------|
| `sendEmail()` | service.ts:126 | Direct send |
| `sendTemplateEmail()` | service.ts:130 | Direct template send |
| `queueTemplateEmail()` | service.ts:152 | Queue with immediate send |
| `processEmailQueue()` | queue.ts | Process queued emails |
| `renderTemplate()` | templates.ts:829 | Render email template |

## Need Help?

1. Check [EMAIL_SETUP.md](../../docs/EMAIL_SETUP.md) for full setup guide
2. Check [EMAIL_SETUP_GUIDE.md](../../EMAIL_SETUP_GUIDE.md) for quick start
3. Review Resend docs: https://resend.com/docs
4. Check Vercel logs for errors
5. Query email_queue table for stuck emails
