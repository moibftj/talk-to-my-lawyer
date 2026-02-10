# Sentry Error Tracking & Performance Monitoring

This guide covers the complete Sentry integration for Talk-to-My-Lawyer.

## Overview

The application now has **full Sentry integration** for:
- ✅ Error tracking (client + server + middleware)
- ✅ Performance monitoring (transactions, spans, traces)
- ✅ User context attachment
- ✅ Session replay for errors
- ✅ Core Web Vitals tracking

---

## Quick Start

### 1. Create Sentry Account

1. Go to https://sentry.io/signup
2. Sign up with GitHub (recommended)
3. Create new organization: `Talk-To-My-Lawyer`
4. Create new project: Select **Next.js**

### 2. Get Your DSNs

From Sentry → Settings → Projects → Your Project → Client Keys (DSN):

- **Client DSN** → `NEXT_PUBLIC_SENTRY_DSN` (for browser errors)
- **Server DSN** → `SENTRY_DSN` (for API errors)

Copy both DSNs.

### 3. Add Environment Variables

**In `.env.local` (development):**
```bash
NEXT_PUBLIC_SENTRY_DSN=https://your-client-dsn@sentry.io/project-id
SENTRY_DSN=https://your-server-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=development
```

**In Vercel Dashboard (production):**
1. Go to Project Settings → Environment Variables
2. Add both DSNs
3. Set `SENTRY_ENVIRONMENT=production`
4. The `VERCEL_GIT_COMMIT_SHA` environment variable is automatically set by Vercel

### 4. Test the Integration

```bash
# Start the dev server
pnpm dev

# In a browser, visit http://localhost:3000
# Open browser console and run:
throw new Error('Sentry test error')

# Check Sentry dashboard → Issues
# The error should appear with user context
```

---

## Files Created/Modified

### New Files

```
lib/monitoring/sentry/
├── sentry.server.config.ts      # Server-side config (API routes, middleware)
├── sentry.client.config.ts      # Client-side config (browser, React)
├── sentry.edge.config.ts        # Edge runtime config (unused currently)
├── filters.ts                    # Error filtering & utilities
└── database-tracing.ts         # Database query tracing wrappers
```

### Modified Files

```
instrumentation.ts              # Initializes Sentry on server startup
middleware.ts                   # Captures middleware errors in Sentry
lib/api/api-error-handler.ts    # Sends API errors to Sentry with context
.env.example                     # Added Sentry environment variable docs
```

---

## Configuration Details

### Error Filtering

The following errors are **automatically filtered** (not sent to Sentry):

- **Validation errors** (400) - `ValidationError`, `VALIDATION_ERROR`
- **Auth failures** (401) - Login failures are expected behavior
- **Authorization failures** (403) - Role-based access denials
- **Not found** (404) - For API resources that don't exist
- **Rate limits** (429) - Rate limiting is expected behavior
- **Supabase PGRST116** - "Not found" errors (expected, not bugs)
- **n8n timeouts** - Handled with retry logic

### User Context

Sentry automatically attaches user context when available:

- **Supabase users** (`subscriber` role)
  - `user.id`
  - `user.email`
  - `user.role`

- **Admin users** (`attorney_admin`, `super_admin`)
  - Auth provider tag
  - User type tag

### Performance Monitoring

All HTTP requests are automatically traced:

```
POST /api/generate-letter (transaction)
├── checkAndDeductAllowance (span)
├── insert letter (span)
├── n8n webhook (span)
└── update letter status (span)
```

**Transaction sampling:**
- 100% of transactions tracked (`tracesSampleRate: 1.0`)
- 10% profiled for deep performance analysis (`profilesSampleRate: 0.1`)

### Session Replay

- **Normal sessions:** 10% sampled (`replaysSessionSampleRate: 0.1`)
- **Error sessions:** 100% captured (`replaysOnErrorSampleRate: 1.0`)
- All text masked by default for privacy

---

## Production Deployment

### Vercel Configuration

**Environment Variables in Vercel:**

| Variable | Value | Environment |
|----------|-------|--------------|
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...@sentry.io/...` | Production |
| `SENTRY_DSN` | `https://...@sentry.io/...` | Production |
| `SENTRY_ENVIRONMENT` | `production` | Production |
| `VERCEL_GIT_COMMIT_SHA` | Auto-set by Vercel | Auto |

### Deployment Checklist

- [ ] Sentry account created and project configured
- [ ] DSNs added to Vercel environment variables
- [ ] `SENTRY_ENVIRONMENT=production` set in Vercel
- [ ] Production build deployed
- [ ] Test error captured in Sentry dashboard
- [ ] Test transaction visible in Performance dashboard
- [ ] Filters configured in Sentry dashboard
- [ ] Alert rules created (see below)
- [ ] Team has Sentry access

---

## Sentry Dashboard Configuration

### Filters (Settings → Server-Side Filters)

**Error Filters:**
```
1. Ignore health check endpoints:
   - request.url: /api/health, /api/cron/health-check

2. Ignore authentication failures:
   - response.status: 401

3. Ignore validation errors:
   - error.type: ValidationError, AND response.status: 400

4. Ignore rate limit errors:
   - response.status: 429
```

### Alert Rules (Settings → Alerts → New Alert Rule)

| Alert Name | Condition | Environment | Notification |
|------------|-----------|------------|--------------|
| **Critical Errors** | Event count > 5 in 5m | production | Slack + Email |
| **API Error Spike** | Error rate > 1% | production | Slack |
| **Slow Requests** | P95 duration > 5s | production | Email |
| **Database Errors** | `db:*` tags, 3+ in 10m | production | Slack |
| **Payment Issues** | `stripe:*` tags | production | Email |

### Slack Integration

1. Sentry → Settings → Integrations → Slack
2. Connect workspace and select channel `#production-errors`
3. Configure alert rules to use Slack webhook

---

## Usage Examples

### Manual Error Capture

```typescript
import * as Sentry from '@sentry/nextjs'

// Capture a simple error
Sentry.captureException(new Error('Something went wrong'))

// Capture with context
Sentry.captureException(error, {
  tags: {
    feature: 'letter-generation',
    letterType: 'demand_letter'
  },
  user: { id: 'user-123', email: 'user@example.com' },
  extra: {
    letterId: 'letter-abc-123'
  }
})

// Add breadcrumb
Sentry.addBreadcrumb({
  category: 'user-action',
  message: 'Clicked submit button',
  level: 'info',
})
```

### Custom Transactions

```typescript
import * as Sentry from '@sentry/nextjs'

async function generateLetter(data: LetterData) {
  return await Sentry.startSpan(
    { op: 'function', name: 'generateLetter' },
    async (span) => {
      span?.setAttribute('letter.type', data.type)
      span?.setAttribute('user.id', data.userId)

      // Your logic here
      const result = await callAPI(data)

      return result
    }
  )
}
```

### Database Tracing

```typescript
import { traceSupabaseQuery } from '@/lib/monitoring/sentry/database-tracing'

// Automatically traced query
const letter = await traceSupabaseQuery(
  'select',
  'letters',
  () => supabase.from('letters').select('*').eq('id', letterId).single()
)
```

---

## Verification

### Local Development

```bash
# Enable debug mode to see what Sentry is doing
SENTRY_DEBUG=true pnpm dev

# Trigger a test error
curl http://localhost:3000/api/sentry-test
```

### Production

After deployment:

1. **Check instrumentation:**
   - Visit your site
   - Sentry → Performance → Transactions
   - Should see page loads and API calls

2. **Test error capture:**
   - Trigger an error (invalid API call, etc.)
   - Sentry → Issues
   - Should see error with user context and breadcrumbs

3. **Test session replay:**
   - Trigger a client-side error
   - Sentry → Issue → Session Replay
   - Should see video replay of what user did

4. **Verify filters:**
   - Try to log in with wrong credentials
   - Should NOT appear in Sentry (filtered as expected)
   - Trigger a 500 error
   - SHOULD appear in Sentry

---

## Troubleshooting

### Events Not Appearing in Sentry

1. **Check environment variables:**
   ```bash
   # Run in your project
   pnpm validate-env
   ```

2. **Check if filtering is removing events:**
   - In development, events are logged to console instead of sent
   - Check `isExpectedError()` in `lib/monitoring/sentry/filters.ts`

3. **Check console for Sentry debug logs:**
   ```bash
   SENTRY_DEBUG=true pnpm dev
   ```

### Performance Data Missing

1. **Check tracesSampleRate** - Should be 1.0 (100%)
2. **Check if transactions are filtered** - Health checks are filtered out
3. **Check browser network tab** - Look for Sentry requests failing

### Session Replay Not Working

1. **Check SDK version** - Must be `@sentry/nextjs@10.x`
2. **Check browser console** - Look for SDK errors
3. **Check replay sample rate** - `replaysSessionSampleRate` and `replaysOnErrorSampleRate`

---

## Next Steps

1. **Set up Sentry account** and create a project
2. **Add DSNs to Vercel** environment variables
3. **Deploy to production**
4. **Create alert rules** in Sentry dashboard
5. **Add team members** to Sentry organization
6. **Create runbook** for on-call procedures
7. **Set up PagerDuty integration** for critical alerts (optional)

---

## Additional Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Performance Monitoring](https://docs.sentry.io/platforms/javascript/performance/)
- [Sentry Session Replay](https://docs.sentry.io/platforms/javascript/session-replay/)
- [Sentry Alerts](https://docs.sentry.io/product/alerts/)
