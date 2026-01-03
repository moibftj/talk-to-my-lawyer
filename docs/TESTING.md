# Testing & Monitoring Guide

Complete guide for testing, test mode configuration, monitoring, and observability in Talk-To-My-Lawyer.

## Table of Contents

1. [Test Mode Configuration](#test-mode-configuration)
2. [Manual Testing](#manual-testing)
3. [OpenTelemetry Tracing](#opentelemetry-tracing)
4. [Performance Monitoring](#performance-monitoring)

---

## Test Mode Configuration

### Overview

Test mode allows testing the complete letter generation and review workflow without processing real Stripe payments.

### Environment Variables

**Local Development** (`.env.local`):
```env
ENABLE_TEST_MODE="true"
NEXT_PUBLIC_TEST_MODE="true"
```

**Production** (MUST be false):
```env
ENABLE_TEST_MODE="false"
NEXT_PUBLIC_TEST_MODE="false"
```

### Test Mode Indicators

Visual indicators show when test mode is active:

1. **Subscription Page** (`/dashboard/subscription`)
   - Amber warning banner at top
   - Shows: "Test Mode Active - Stripe payments are simulated"

2. **Admin Review Center** (`/secure-admin-gateway/review`)
   - Amber warning banner at top
   - Shows: "Test Mode Active - You're reviewing letters created with simulated payments"

### How Test Mode Works

**For Subscribers:**
- Letter Generation works normally
- Checkout bypasses Stripe completely
- Subscription created directly in database
- Status set to `active` immediately
- Credits allocated instantly
- No payment processing
- No Stripe session ID

**For Admins:**
- Review workflow identical to production
- All actions trigger real-time updates
- Full audit trail maintained

---

## Manual Testing

### Complete End-to-End Test Flow

#### Prerequisites

1. Enable test mode in environment
2. Restart dev server: `pnpm dev`
3. Open two browser windows:
   - **Window A**: Regular browser (subscriber)
   - **Window B**: Incognito (admin)

#### Part 1: Subscriber Creates Letter

**Window A (Subscriber)**:

1. Navigate to `http://localhost:3000`
2. Sign up or login
3. Go to "Generate Letter"
4. Fill out intake form:
   - **Letter Type**: Demand Letter
   - **Sender Name**: John Doe
   - **Sender Email**: john@example.com
   - **Recipient Name**: Jane Smith
   - **Issue Description**: "Unpaid invoice for $5,000"
   - **Desired Outcome**: "Full payment within 14 days"

5. Click "Generate Letter"
6. Timeline modal appears showing progress

7. If no subscription, click "Subscribe":
   - Test mode banner visible
   - Choose a plan
   - Click "Subscribe"
   - NO redirect to Stripe
   - Success message appears instantly

8. Navigate to `/dashboard/letters`
9. Find newly created letter
10. Click to view detail page

**Keep this window open for real-time updates!**

#### Part 2: Admin Reviews Letter

**Window B (Admin - Incognito)**:

1. Navigate to `/secure-admin-gateway/login`
2. Enter admin credentials + Portal Key
3. Click "Login"
4. Go to "Review Center"
5. See letter in "Pending Review"
6. Click letter to view details
7. Click "Review Letter" button
8. **Expected**: Window A timeline **instantly updates** to "Attorney review in progress"
9. Edit content (optional)
10. Click "Approve Letter"
11. **Expected**: Window A timeline **instantly updates** to "Approved"

#### Part 3: Subscriber Downloads Letter

**Window A (Subscriber)**:

1. Letter shows "Approved" status
2. "Download PDF" button visible
3. Click "Download PDF"
4. Verify PDF contains letter content

### Test Scenarios

#### Authentication Flow
- [ ] Test user registration
- [ ] Test user login
- [ ] Verify password reset
- [ ] Test role-based access control
- [ ] Validate session management

#### Admin Access
- [ ] Test admin login with multiple accounts
- [ ] Verify access to `/secure-admin-gateway`
- [ ] Test admin actions (approve, reject)
- [ ] Check audit trail logging

#### Letter Generation
- [ ] Test each letter type
- [ ] Verify AI generation
- [ ] Test attorney review process
- [ ] Verify PDF generation

#### Payment Processing
- [ ] Test subscription with test cards
- [ ] Verify subscription upgrades/downgrades
- [ ] Test payment failure scenarios
- [ ] Verify webhook handling

#### Email Services
- [ ] Test email delivery
- [ ] Verify email templates
- [ ] Test fallback to console provider

### Test Data

**Test Email Addresses**:
- Use format: `test+{type}@example.com`

**Stripe Test Cards**:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- See [PAYMENTS.md](./PAYMENTS.md) for more

### Edge Cases to Test

1. **Network Failures**
   - AI generation timeout
   - Payment processing interruption
   - Email service outage

2. **Security Testing**
   - Input validation bypass attempts
   - Rate limiting effectiveness
   - Authentication bypass attempts
   - SQL injection prevention

3. **Concurrency**
   - Multiple admins reviewing same letter
   - Simultaneous letter generation
   - Concurrent subscription purchases

---

## OpenTelemetry Tracing

### Overview

OpenTelemetry provides distributed tracing for observability into:
- AI operations (OpenAI API calls)
- Database operations (Supabase queries)
- HTTP requests and API routes
- Business operations (letter generation)

### Quick Start

#### 1. Configure Environment

Add to `.env.local`:

```env
# Optional: OTLP endpoint (defaults to localhost:4318)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces

# Optional: Service configuration
OTEL_SERVICE_NAME=talk-to-my-lawyer
OTEL_SERVICE_VERSION=1.0.0

# Optional: Disable tracing
OTEL_SDK_DISABLED=false
```

#### 2. Run Jaeger (Local Collector)

```bash
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

Then visit http://localhost:16686 to view traces.

#### 3. Start Application

```bash
pnpm dev
```

Tracing automatically initializes.

### What Gets Traced

#### AI Operations
- **Location**: `lib/ai/openai-retry.ts`
- **Spans**: `ai.generateTextWithRetry`, `ai.healthCheck`
- **Attributes**: model, temperature, token counts, retry attempts
- **Events**: generation attempts, errors, circuit breaker states

#### API Routes
- **Location**: `app/api/generate-letter/route.ts`
- **Spans**: `business.generate_letter`, `ai.generateLetterContent`
- **Attributes**: user info, letter type, request details
- **Events**: authentication, validation, generation progress

#### HTTP Requests
- **Auto-instrumented**: All incoming HTTP requests
- **Filtering**: Health checks and static assets filtered out
- **Attributes**: URL, method, user agent, response status

### Using Tracing in Code

#### Manual Span Creation

```typescript
import { createAISpan } from '@/lib/monitoring/tracing'

const span = createAISpan('custom_ai_operation', {
  'ai.model': 'gpt-4-turbo',
  'ai.temperature': 0.7
})

try {
  // Your AI operation
  span.setStatus({ code: 1 }) // SUCCESS
} catch (error) {
  span.recordException(error)
  span.setStatus({ code: 2, message: error.message })
  throw error
} finally {
  span.end()
}
```

#### Async Function Tracing

```typescript
import { traceAsync } from '@/lib/monitoring/tracing'

const result = await traceAsync(
  'my_operation',
  async () => {
    return await someAsyncWork()
  },
  { 'custom.attribute': 'value' }
)
```

### Production Considerations

#### Performance
- Uses `BatchSpanProcessor` in production
- Uses `SimpleSpanProcessor` in development
- HTTP instrumentation filters out health checks

#### Configuration

For production, configure for your observability platform:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-platform.com/v1/traces
OTEL_EXPORTER_OTLP_HEADERS='{"authorization":"Bearer YOUR_TOKEN"}'
```

#### Sampling

For high-traffic applications:

```typescript
// In lib/monitoring/tracing.ts
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node'

sampler: new TraceIdRatioBasedSampler(0.1), // Sample 10% of traces
```

---

## Performance Monitoring

### Key Metrics

#### Response Times (95th percentile)
- Authentication: < 500ms
- Letter Generation: < 30 seconds
- Payment Processing: < 3 seconds
- Admin Dashboard: < 1 second

#### Database Performance
- Query Response: < 100ms average
- Connection Pool: < 80% utilization
- Index Hit Ratio: > 99%

#### Email Delivery
- Success Rate: > 98%
- Delivery Time: < 5 minutes
- Bounce Rate: < 2%

### Health Checks

```bash
# Basic health check
curl http://localhost:3000/api/health

# Detailed system status
curl http://localhost:3000/api/health/detailed
```

### Troubleshooting

#### Tracing Not Working
1. Check console logs during startup
2. Verify OTLP endpoint reachable
3. Check environment variables
4. Ensure Next.js using Node.js runtime

#### High Overhead
1. Reduce sampling rate
2. Filter out unnecessary operations
3. Use BatchSpanProcessor
4. Consider async export

#### Missing Spans
1. Ensure spans properly ended
2. Check for uncaught exceptions
3. Verify instrumentation loaded early

---

## Test Mode vs Production

### Test Mode (Development)
✅ No Stripe checkout page  
✅ Subscriptions created instantly  
✅ No payment processing  
✅ Amber warning banners visible  
✅ Perfect for development  
❌ Not suitable for real customers  

### Production Mode
✅ Real payment processing  
✅ Stripe Checkout UI  
✅ Customer payment methods saved  
✅ Real subscriptions with billing  
❌ Requires full Stripe configuration  

### Switching Between Modes

**To disable test mode** (production):

1. **Local**:
   ```bash
   # Edit .env.local
   ENABLE_TEST_MODE="false"
   NEXT_PUBLIC_TEST_MODE="false"
   ```

2. **Vercel**:
   Update environment variables in dashboard

3. **Restart** and **redeploy**

---

**Last Updated**: January 2026  
**Version**: Testing & Monitoring v2.0
