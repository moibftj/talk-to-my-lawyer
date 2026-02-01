# GitHub Issues - Critical Fixes

Copy each issue below to create GitHub issues. Issues are ordered by priority.

---

## Issue #1: [P0] Race Condition in Letter Allowance System

**Labels:** `P0`, `critical`, `bug`, `security`
**Milestone:** Production Ready
**Assignees:** (assign to developer)
**Estimated Time:** 4 hours

### Description

**Critical race condition** in the letter allowance system allows users to generate unlimited letters by exploiting concurrent requests. This is a **revenue-impacting security vulnerability**.

### Current Problem

The check and deduct operations are not atomic:

```typescript
// app/api/generate-letter/route.ts:88-127
const eligibility = await checkGenerationEligibility(user.id)  // Line 89
// ... validation ...
const deductionResult = await deductLetterAllowance(user.id)   // Line 119
```

**Attack Scenario:**
1. User has 1 letter remaining
2. User sends 5 concurrent requests
3. All 5 requests pass the check at line 89 (all see 1 remaining)
4. All 5 requests deduct at line 119
5. User gets 5 letters for the price of 1

### Impact

- **Revenue Loss:** Users can exploit this to get free letters
- **Data Integrity:** Negative allowance counts
- **User Trust:** Unfair advantage for tech-savvy users
- **Severity:** CRITICAL - Exploitable by anyone with basic technical knowledge

### Solution

Combine check and deduct into a single atomic database operation using a new RPC function.

**New RPC Function:**
```sql
CREATE OR REPLACE FUNCTION public.check_and_deduct_allowance(u_id UUID)
RETURNS TABLE(
    success BOOLEAN,
    remaining INTEGER,
    error_message TEXT,
    is_free_trial BOOLEAN,
    is_super_admin BOOLEAN
) AS $$
-- Implementation with SELECT FOR UPDATE lock
```

### Files to Modify

- [ ] `supabase/migrations/20260107000001_atomic_allowance_deduction.sql` (new)
- [ ] `lib/services/allowance-service.ts`
- [ ] `app/api/generate-letter/route.ts`

### Acceptance Criteria

- [ ] New atomic RPC function created
- [ ] API route updated to use atomic function
- [ ] Concurrent requests properly deduct allowance (no over-generation)
- [ ] Free trial users can still generate letters
- [ ] Super admins have unlimited access
- [ ] Refund works when generation fails
- [ ] Unit tests added for concurrent deduction scenarios
- [ ] Integration test validates fix

### Testing Instructions

```bash
# Test concurrent requests using curl
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/generate-letter \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"letterType":"demand","intakeData":{...}}' &
done
wait

# Verify only 1 letter was generated (if user had 1 remaining)
```

### References

- Implementation details: `IMPLEMENTATION_PLAN.md` - Issue P0-1
- Full audit: `COMPREHENSIVE_REPOSITORY_REVIEW.md` - Critical Issue #1

---

## Issue #2: [P0] Race Condition in Coupon Usage Tracking

**Labels:** `P0`, `critical`, `bug`, `finance`
**Milestone:** Production Ready
**Assignees:** (assign to developer)
**Estimated Time:** 2 hours

### Description

**Critical race condition** in coupon usage tracking causes lost commission records and incorrect usage counts. This directly impacts employee compensation.

### Current Problem

Non-atomic read-then-update pattern:

```typescript
// app/api/create-checkout/route.ts:238-255
const { data: currentCoupon } = await supabase
  .from('employee_coupons')
  .select('usage_count')
  .eq('code', couponCode)
  .maybeSingle()

const { error: updateError } = await supabase
  .from('employee_coupons')
  .update({
    usage_count: (currentCoupon?.usage_count || 0) + 1,  // RACE CONDITION
    updated_at: new Date().toISOString()
  })
  .eq('code', couponCode)
```

**Attack Scenario:**
1. Employee coupon used by 3 users simultaneously
2. All 3 requests read `usage_count = 10`
3. All 3 requests update to `usage_count = 11`
4. Final count shows 11 instead of 13
5. 2 uses were lost

### Impact

- **Financial:** Lost commission tracking
- **Employee Trust:** Incorrect payout calculations
- **Metrics:** Analytics unreliable
- **Severity:** CRITICAL - Affects employee compensation

### Solution

Use atomic increment operation via RPC function.

**New RPC Function:**
```sql
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_code TEXT)
RETURNS TABLE(usage_count INTEGER) AS $$
BEGIN
    UPDATE public.employee_coupons
    SET usage_count = employee_coupons.usage_count + 1,
        updated_at = NOW()
    WHERE code = coupon_code
    RETURNING employee_coupons.usage_count INTO usage_count;
END;
$$ LANGUAGE plpgsql;
```

### Files to Modify

- [ ] `supabase/migrations/20260107000002_atomic_coupon_increment.sql` (new)
- [ ] `app/api/create-checkout/route.ts`

### Acceptance Criteria

- [ ] Atomic increment RPC function created
- [ ] Checkout route uses atomic increment
- [ ] Concurrent coupon uses correctly increment count
- [ ] No lost usage counts
- [ ] Integration test validates fix

### Testing Instructions

```bash
# Simulate 10 concurrent checkouts with same coupon
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/create-checkout \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"planType":"basic","couponCode":"EMP-ABC123"}' &
done
wait

# Verify usage_count increased by exactly 10
```

### References

- Implementation details: `IMPLEMENTATION_PLAN.md` - Issue P0-2
- Full audit: `COMPREHENSIVE_REPOSITORY_REVIEW.md` - Critical Issue #2

---

## Issue #3: [P0] Missing Transaction Atomicity in Checkout Flow

**Labels:** `P0`, `critical`, `bug`, `finance`
**Milestone:** Production Ready
**Assignees:** (assign to developer)
**Estimated Time:** 6 hours

### Description

**Critical lack of transaction atomicity** in checkout flow can result in users receiving subscriptions without employees receiving commissions, or partial subscription creation.

### Current Problem

Multiple database operations not wrapped in transaction:

```typescript
// app/api/create-checkout/route.ts:182-256
1. Create subscription             // Success
2. Create commission               // If this fails...
3. Update coupon usage             // ...user gets subscription but employee loses commission
4. Return success
```

If any step fails, previous steps are not rolled back.

### Impact

- **Financial:** Lost employee commissions
- **User Experience:** Partial subscription creation
- **Data Integrity:** Orphaned records
- **Employee Trust:** Missing compensation
- **Severity:** CRITICAL - Direct financial impact

### Solution

Wrap all checkout operations in a single atomic database transaction using an RPC function.

**New RPC Function:**
```sql
CREATE OR REPLACE FUNCTION public.create_subscription_with_commission(
    p_user_id UUID,
    p_plan_type TEXT,
    p_stripe_subscription_id TEXT,
    p_stripe_customer_id TEXT,
    p_status TEXT,
    p_monthly_allowance INTEGER,
    p_total_letters INTEGER,
    p_coupon_code TEXT DEFAULT NULL,
    p_employee_id UUID DEFAULT NULL,
    p_commission_amount DECIMAL DEFAULT NULL,
    p_discount_percent INTEGER DEFAULT 0
)
RETURNS TABLE(
    success BOOLEAN,
    subscription_id UUID,
    commission_id UUID,
    error_message TEXT
) AS $$
-- All operations succeed or all fail together
```

### Files to Modify

- [ ] `supabase/migrations/20260107000003_atomic_checkout.sql` (new)
- [ ] `app/api/create-checkout/route.ts`
- [ ] `app/api/stripe/webhook/route.ts` (use same RPC)

### Acceptance Criteria

- [ ] Atomic transaction RPC function created
- [ ] Subscription, commission, and coupon update in single transaction
- [ ] Rollback on any failure
- [ ] Checkout route uses atomic function
- [ ] Webhook handler uses atomic function
- [ ] No partial subscription creation
- [ ] No lost commissions
- [ ] Integration test validates atomicity
- [ ] Rollback test validates transaction abort

### Testing Instructions

```bash
# Test normal checkout flow
curl -X POST http://localhost:3000/api/create-checkout \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"planType":"basic","couponCode":"EMP-ABC123"}'

# Verify in database:
# - Subscription created
# - Commission created
# - Coupon usage incremented
# All should exist or none should exist

# Test rollback (simulate failure in commission creation)
# Verify subscription is NOT created if commission fails
```

### References

- Implementation details: `IMPLEMENTATION_PLAN.md` - Issue P0-3
- Full audit: `COMPREHENSIVE_REPOSITORY_REVIEW.md` - Critical Issue #3

---

## Issue #4: [P0] Stripe Webhook Idempotency Gap

**Labels:** `P0`, `critical`, `bug`, `stripe`, `payments`
**Milestone:** Production Ready
**Assignees:** (assign to developer)
**Estimated Time:** 3 hours

### Description

**Critical missing idempotency checks** in Stripe webhook handler can create duplicate subscriptions when webhooks are retried by Stripe.

### Current Problem

No tracking of processed webhook IDs:

```typescript
// app/api/stripe/webhook/route.ts:65-89
const metadata = session.metadata || {}
const userId = metadata.user_id

// No check if this webhook was already processed!
// If Stripe retries, creates duplicate subscription
```

**Scenario:**
1. Webhook delivered successfully → subscription created ✅
2. Response times out before reaching Stripe
3. Stripe retries webhook → duplicate subscription created ❌

### Impact

- **Financial:** Users charged multiple times
- **User Experience:** Confused users with multiple subscriptions
- **Data Integrity:** Duplicate records
- **Support Load:** Refund requests
- **Severity:** CRITICAL - Direct financial and user trust impact

### Solution

Track processed webhook events in database and check before processing.

**New Table:**
```sql
CREATE TABLE public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**New RPC Function:**
```sql
CREATE OR REPLACE FUNCTION public.check_and_record_webhook(
    p_stripe_event_id TEXT,
    p_event_type TEXT,
    p_metadata JSONB DEFAULT NULL
)
RETURNS TABLE(already_processed BOOLEAN, event_id UUID)
```

### Files to Modify

- [ ] `supabase/migrations/20260107000004_webhook_idempotency.sql` (new)
- [ ] `app/api/stripe/webhook/route.ts`
- [ ] `app/api/cron/cleanup-webhooks/route.ts` (new - cleanup old events)

### Acceptance Criteria

- [ ] `webhook_events` table created
- [ ] Idempotency check RPC function created
- [ ] Webhook handler checks idempotency before processing
- [ ] Already-processed webhooks return success without re-processing
- [ ] New webhooks are recorded before processing
- [ ] Cleanup cron job removes old webhook events (30+ days)
- [ ] Integration test simulates webhook retry
- [ ] No duplicate subscriptions created on retry

### Testing Instructions

```bash
# Send same webhook twice
WEBHOOK_PAYLOAD='{"id":"evt_test_123","type":"checkout.session.completed",...}'

# First delivery
curl -X POST http://localhost:3000/api/stripe/webhook \
  -H "Stripe-Signature: $SIGNATURE" \
  -d "$WEBHOOK_PAYLOAD"

# Retry (same event ID)
curl -X POST http://localhost:3000/api/stripe/webhook \
  -H "Stripe-Signature: $SIGNATURE" \
  -d "$WEBHOOK_PAYLOAD"

# Verify:
# - Only 1 subscription created
# - Second request returns "already processed"
# - webhook_events table has 1 record
```

### References

- Implementation details: `IMPLEMENTATION_PLAN.md` - Issue P0-4
- Full audit: `COMPREHENSIVE_REPOSITORY_REVIEW.md` - Critical Issue #4
- Stripe docs: https://stripe.com/docs/webhooks/best-practices#duplicate-events

---

## Issue #5: [P1] Test Mode Security Risk - Missing Production Guard

**Labels:** `P1`, `high`, `security`, `configuration`
**Milestone:** Production Ready
**Assignees:** (assign to developer)
**Estimated Time:** 30 minutes

### Description

**Test mode can be accidentally enabled in production**, allowing users to get free subscriptions without payment. While pre-deploy checks exist, there's no runtime guard.

### Current Problem

```typescript
// app/api/create-checkout/route.ts:12
const TEST_MODE = process.env.ENABLE_TEST_MODE === 'true'

if (TEST_MODE) {
  // Bypasses Stripe entirely
  // Creates active subscription without payment
  // Anyone can get free subscription
}
```

**Risk Scenario:**
1. Developer accidentally sets `ENABLE_TEST_MODE=true` in production
2. Pre-deploy check missed or bypassed
3. All users get free subscriptions
4. Major revenue loss before discovered

### Impact

- **Financial:** Free subscriptions for all users
- **Revenue Loss:** Potentially catastrophic
- **Severity:** HIGH - Single config mistake = major breach

### Current Mitigations

✅ Pre-deploy check script validates this
✅ Documentation warns about it
✅ Environment validation on startup

**Still Risky:**
- No runtime production guard
- Logs test mode but doesn't block

### Solution

Add runtime production guard:

```typescript
const TEST_MODE = process.env.ENABLE_TEST_MODE === 'true'

// Add production guard
if (TEST_MODE && process.env.NODE_ENV === 'production') {
  console.error('[CRITICAL] Test mode enabled in production environment!')
  throw new Error('Test mode is not allowed in production. Set ENABLE_TEST_MODE=false.')
}
```

### Files to Modify

- [ ] `app/api/create-checkout/route.ts`

### Acceptance Criteria

- [ ] Runtime check added to checkout route
- [ ] Error thrown if test mode enabled in production
- [ ] Development and staging environments unaffected
- [ ] Logs indicate production environment
- [ ] Test validates error is thrown

### Testing Instructions

```bash
# Test in development - should work
ENABLE_TEST_MODE=true NODE_ENV=development npm run dev

# Test in production - should error
ENABLE_TEST_MODE=true NODE_ENV=production npm start
# Should see: Error: Test mode is not allowed in production
```

### References

- Implementation details: `IMPLEMENTATION_PLAN.md` - Issue P1-5
- Full audit: `COMPREHENSIVE_REPOSITORY_REVIEW.md` - High Priority Issue #5

---

## Issue #6: [P1] Email Template Injection Risk

**Labels:** `P1`, `high`, `security`, `xss`
**Milestone:** Production Ready
**Assignees:** (assign to developer)
**Estimated Time:** 2 hours

### Description

**User-controlled data injected into email templates without HTML escaping**, allowing email body manipulation and potential XSS in vulnerable email clients.

### Current Problem

```typescript
// lib/email/templates.ts
html: `
  <p>Rejection Reason: ${data.rejectionReason}</p>
  <p>Review Notes: ${data.reviewNotes}</p>
`
```

If admin enters: `<script>alert('xss')</script>` as rejection reason, it's injected directly into email HTML.

### Impact

- **Email Appearance:** Can be altered maliciously
- **XSS Risk:** Email clients with poor sanitization could execute scripts
- **Professional Image:** Compromised email appearance
- **Severity:** HIGH - Potential security and trust issue

### Real-World Example

**Admin rejects letter with reason:**
```
</p><h1 style="color:red">URGENT: ACCOUNT SUSPENDED</h1><p>
```

**Resulting email looks like:**
```html
<p>Rejection Reason: </p>
<h1 style="color:red">URGENT: ACCOUNT SUSPENDED</h1>
<p></p>
```

User sees fake urgent message.

### Solution

HTML escape all dynamic template variables:

```typescript
function escapeHtml(text: string | undefined | null): string {
  if (!text) return ''
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  }
  return text.toString().replace(/[&<>"'/]/g, (char) => map[char])
}

// Usage
html: `<p>Rejection Reason: ${escapeHtml(data.rejectionReason)}</p>`
```

### Files to Modify

- [ ] `lib/email/templates.ts` (all templates)

### Acceptance Criteria

- [ ] HTML escape utility function created
- [ ] All template variables escaped
- [ ] Multi-line content preserves newlines as `<br>` tags
- [ ] Emails render correctly with escaped content
- [ ] Test validates HTML injection is prevented
- [ ] No legitimate content broken by escaping

### Testing Instructions

```bash
# Test with malicious input
const testData = {
  rejectionReason: '<script>alert("xss")</script>',
  reviewNotes: '<h1>FAKE</h1>'
}

# Send test email
await sendTemplateEmail('letter-rejected', 'test@example.com', testData)

# Verify in received email:
# - HTML tags are escaped (visible as text)
# - No script execution
# - Professional appearance maintained
```

### Templates to Update

- `welcome`
- `letter-approved`
- `letter-rejected`
- `letter-ready`
- `subscription-created`
- `commission-payout`
- All others with dynamic content

### References

- Implementation details: `IMPLEMENTATION_PLAN.md` - Issue P1-6
- Full audit: `COMPREHENSIVE_REPOSITORY_REVIEW.md` - High Priority Issue #6
- OWASP: https://owasp.org/www-community/attacks/xss/

---

## Issue #7: [P1] Missing Rate Limiting on Critical Endpoints

**Labels:** `P1`, `high`, `security`, `dos`
**Milestone:** Production Ready
**Assignees:** (assign to developer)
**Estimated Time:** 1 hour

### Description

**Several critical endpoints lack rate limiting**, making them vulnerable to enumeration attacks, DoS, and abuse.

### Affected Endpoints

1. **`/api/create-profile`** - No rate limit
2. **`/api/gdpr/export-data`** - No rate limit
3. **`/api/gdpr/delete-account`** - No rate limit

### Impact

**Enumeration Attack Example:**
```bash
# Try to enumerate valid user IDs
for i in {1..1000}; do
  curl -X POST /api/gdpr/export-data -d "{\"userId\":\"$i\"}"
done
```

**DoS Attack Example:**
```bash
# Flood profile creation
while true; do
  curl -X POST /api/create-profile -d "{...}"
done
```

### Current State

Most endpoints properly rate limited:
- ✅ Auth endpoints: 5/15min
- ✅ Letter generation: 5/hour
- ✅ Subscriptions: 3/hour
- ✅ Admin endpoints: 10/15min

**Missing:**
- ❌ Profile creation
- ❌ GDPR endpoints

### Solution

Add rate limiting to all unprotected endpoints:

```typescript
export async function POST(request: NextRequest) {
  try {
    // Add rate limiting
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      apiRateLimit,
      10,      // 10 requests
      "15 m"   // per 15 minutes
    )
    if (rateLimitResponse) return rateLimitResponse

    // ... rest of handler ...
  }
}
```

### Files to Modify

- [ ] `app/api/create-profile/route.ts`
- [ ] `app/api/gdpr/export-data/route.ts`
- [ ] `app/api/gdpr/delete-account/route.ts`

### Acceptance Criteria

- [ ] Rate limiting added to all 3 endpoints
- [ ] 10 requests per 15 minutes limit
- [ ] Proper `Retry-After` headers returned
- [ ] Rate limit info in response headers
- [ ] Test validates rate limiting works
- [ ] Legitimate users not impacted

### Testing Instructions

```bash
# Test rate limiting
for i in {1..15}; do
  echo "Request $i:"
  curl -i -X POST http://localhost:3000/api/create-profile \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"userId":"test","email":"test@example.com"}'
  echo "---"
done

# Verify:
# - First 10 requests succeed (200)
# - Requests 11-15 return 429 (Too Many Requests)
# - Retry-After header present
```

### References

- Implementation details: `IMPLEMENTATION_PLAN.md` - Issue P1-7
- Full audit: `COMPREHENSIVE_REPOSITORY_REVIEW.md` - High Priority Issue #7

---

## Issue #8: [P1] Netlify Configuration Mismatch

**Labels:** `P1`, `high`, `configuration`, `deployment`
**Milestone:** Production Ready
**Assignees:** (assign to developer)
**Estimated Time:** 5 minutes

### Description

**`netlify.toml` configuration is incompatible** with current Next.js build settings, causing deployment failures.

### Current Problem

```toml
# netlify.toml
[build]
command = "npx next build"
publish = "out"
```

**But:**
- `next.config.mjs` has `output: 'standalone'` (not static export)
- Standalone builds output to `.next/standalone/`, not `out/`
- API routes require serverless functions, not static files

**Result:** Deployment will fail.

### Impact

- **Deployment:** Will fail if attempted on Netlify
- **CI/CD:** Broken deployment pipeline
- **Severity:** HIGH - Blocks Netlify deployment

### Solution Options

**Option 1: Remove netlify.toml (Recommended)**
```bash
git rm netlify.toml
git commit -m "Remove netlify.toml - using Vercel deployment"
```

Use Vercel instead (Next.js is optimized for Vercel).

**Option 2: Fix for Netlify**
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

**Option 3: Static Export (Breaks API routes)**
```javascript
// next.config.mjs
export default {
  output: 'export',  // Change to export
  // ... other config
}
```

⚠️ **Not recommended** - Breaks all API routes.

### Files to Modify

- [ ] `netlify.toml` (delete or fix)

### Acceptance Criteria

**If Option 1 (Delete):**
- [ ] File removed from repository
- [ ] Deployment uses Vercel

**If Option 2 (Fix):**
- [ ] Configuration updated for standalone build
- [ ] Netlify plugin added
- [ ] Test deployment succeeds on Netlify
- [ ] API routes work
- [ ] SSR pages work

### Testing Instructions

**If fixing for Netlify:**
```bash
# Test local build
npm run build

# Verify output
ls .next/standalone/

# Deploy to Netlify
netlify deploy --prod

# Test deployed site
curl https://your-site.netlify.app/api/health
```

### Recommendation

**Use Option 1 (Delete)** - Vercel is better optimized for Next.js and requires no configuration.

### References

- Implementation details: `IMPLEMENTATION_PLAN.md` - Issue P1-8
- Full audit: `COMPREHENSIVE_REPOSITORY_REVIEW.md` - High Priority Issue #8
- Netlify Next.js: https://docs.netlify.com/frameworks/next-js/

---

## Summary

**Total Issues:** 8 (4 P0, 4 P1)

**P0 Issues (Critical - Blocking Production):**
1. Race Condition - Letter Allowance (4h)
2. Race Condition - Coupon Usage (2h)
3. Missing Transaction Atomicity (6h)
4. Webhook Idempotency Gap (3h)

**P1 Issues (High Priority - Should Fix Before Launch):**
5. Test Mode Production Guard (30min)
6. Email Template Injection (2h)
7. Missing Rate Limiting (1h)
8. Netlify Config Mismatch (5min)

**Total Estimated Time:** ~19 hours (~2.5 days)

**Order of Implementation:**
1. Issue #1 (P0-1) - Highest impact
2. Issue #4 (P0-4) - Payment critical
3. Issue #2 (P0-2) - Employee compensation
4. Issue #3 (P0-3) - Data integrity
5. Issue #5 (P1-5) - Quick win
6. Issue #8 (P1-8) - Quick win
7. Issue #7 (P1-7) - Security
8. Issue #6 (P1-6) - Security

---

## Instructions for Creating Issues

### Using GitHub Web UI

1. Go to https://github.com/moizjmj-pk/talk-to-my-lawyer/issues
2. Click "New Issue"
3. Copy the title (e.g., "[P0] Race Condition in Letter Allowance System")
4. Copy the entire content for that issue
5. Add labels: `P0` or `P1`, `critical` or `high`, etc.
6. Set milestone: "Production Ready"
7. Assign to developer
8. Click "Submit new issue"
9. Repeat for all 8 issues

### Using GitHub CLI (if available)

```bash
# Install gh CLI first
# Then create all issues:

gh issue create \
  --title "[P0] Race Condition in Letter Allowance System" \
  --body-file issue-1.md \
  --label "P0,critical,bug,security" \
  --milestone "Production Ready"

# Repeat for all issues
```

### Using GitHub API Script

A script will be created in the next step if you prefer automation.

---

**Created:** 2026-01-07
**For Repository:** moizjmj-pk/talk-to-my-lawyer
**Branch:** claude/code-review-wkA3w
