# Implementation Plan - Critical Fixes
## Talk-To-My-Lawyer Production Readiness

**Date:** 2026-01-07
**Status:** Ready for Implementation
**Estimated Total Time:** 15-20 hours (2-3 days)
**Priority:** CRITICAL - Blocking Production Deployment

---

## Overview

This plan addresses the 4 critical P0 issues and 4 high-priority P1 issues identified in the comprehensive code review. Each issue includes detailed implementation steps, code examples, and testing requirements.

---

## Phase 1: Critical Fixes (P0) - 15 hours

### Issue P0-1: Race Condition in Letter Allowance System

**Priority:** CRITICAL
**Estimated Time:** 4 hours
**Files to Modify:**
- `supabase/migrations/[timestamp]_atomic_allowance_deduction.sql` (new)
- `lib/services/allowance-service.ts`
- `app/api/generate-letter/route.ts`

**Current Problem:**
```typescript
// app/api/generate-letter/route.ts:88-127
const eligibility = await checkGenerationEligibility(user.id)  // Line 89
// ... validation ...
const deductionResult = await deductLetterAllowance(user.id)   // Line 119
// RACE CONDITION: Multiple requests can pass check before deduction
```

**Solution Steps:**

1. **Create new atomic RPC function** (1.5 hours)

Create `supabase/migrations/20260107000001_atomic_allowance_deduction.sql`:

```sql
-- Atomic check and deduct function
CREATE OR REPLACE FUNCTION public.check_and_deduct_allowance(u_id UUID)
RETURNS TABLE(
    success BOOLEAN,
    remaining INTEGER,
    error_message TEXT,
    is_free_trial BOOLEAN,
    is_super_admin BOOLEAN
) AS $$
DECLARE
    current_allowance INTEGER;
    user_role TEXT;
    sub_status TEXT;
    sub_created TIMESTAMP;
BEGIN
    -- Get user role
    SELECT role::TEXT INTO user_role
    FROM public.profiles
    WHERE id = u_id;

    -- Check if super admin (unlimited)
    IF user_role = 'admin' THEN
        RETURN QUERY SELECT TRUE, 999999, NULL::TEXT, FALSE, TRUE;
        RETURN;
    END IF;

    -- Lock subscription row for update
    SELECT
        monthly_letter_allowance,
        status,
        created_at
    INTO current_allowance, sub_status, sub_created
    FROM public.subscriptions
    WHERE user_id = u_id
    FOR UPDATE;

    -- Check if free trial eligible (< 7 days, no subscription)
    IF sub_status IS NULL THEN
        IF (NOW() - (SELECT created_at FROM profiles WHERE id = u_id)) < INTERVAL '7 days' THEN
            -- Free trial user - allow generation without deduction
            RETURN QUERY SELECT TRUE, 1, NULL::TEXT, TRUE, FALSE;
            RETURN;
        ELSE
            RETURN QUERY SELECT FALSE, 0, 'Free trial expired - subscription required'::TEXT, FALSE, FALSE;
            RETURN;
        END IF;
    END IF;

    -- Check if subscription is active
    IF sub_status != 'active' THEN
        RETURN QUERY SELECT FALSE, 0, 'Subscription not active'::TEXT, FALSE, FALSE;
        RETURN;
    END IF;

    -- Check allowance
    IF current_allowance > 0 THEN
        -- Deduct allowance atomically
        UPDATE public.subscriptions
        SET monthly_letter_allowance = monthly_letter_allowance - 1
        WHERE user_id = u_id;

        RETURN QUERY SELECT TRUE, current_allowance - 1, NULL::TEXT, FALSE, FALSE;
    ELSE
        RETURN QUERY SELECT FALSE, 0, 'No letter allowances remaining'::TEXT, FALSE, FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_and_deduct_allowance(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.check_and_deduct_allowance IS
'Atomically checks eligibility and deducts letter allowance in a single transaction. Prevents race conditions.';
```

2. **Update allowance service** (1 hour)

Modify `lib/services/allowance-service.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'

export interface AllowanceResult {
  success: boolean
  remaining: number
  errorMessage?: string
  isSuperAdmin?: boolean
  isFreeTrial?: boolean
  wasDeducted: boolean
}

/**
 * Atomically check and deduct letter allowance
 * This function prevents race conditions by combining check and deduct in a single DB operation
 */
export async function checkAndDeductAllowance(userId: string): Promise<AllowanceResult> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .rpc('check_and_deduct_allowance', { u_id: userId })
      .single()

    if (error) {
      console.error('[AllowanceService] Error:', error)
      return {
        success: false,
        remaining: 0,
        errorMessage: 'Failed to check allowance',
        wasDeducted: false
      }
    }

    return {
      success: data.success,
      remaining: data.remaining,
      errorMessage: data.error_message || undefined,
      isSuperAdmin: data.is_super_admin,
      isFreeTrial: data.is_free_trial,
      wasDeducted: data.success && !data.is_super_admin && !data.is_free_trial
    }
  } catch (err) {
    console.error('[AllowanceService] Unexpected error:', err)
    return {
      success: false,
      remaining: 0,
      errorMessage: 'Unexpected error',
      wasDeducted: false
    }
  }
}

/**
 * Refund a letter allowance (when generation fails)
 */
export async function refundAllowance(userId: string): Promise<boolean> {
  const supabase = await createClient()

  try {
    const { error } = await supabase.rpc('add_letter_allowances', {
      u_id: userId,
      amount: 1
    })

    if (error) {
      console.error('[AllowanceService] Refund error:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[AllowanceService] Refund unexpected error:', err)
    return false
  }
}
```

3. **Update generate-letter API route** (1 hour)

Modify `app/api/generate-letter/route.ts`:

```typescript
// Remove old imports
// import { checkGenerationEligibility, deductLetterAllowance, shouldSkipDeduction } from '...'

// Add new import
import { checkAndDeductAllowance, refundAllowance } from '@/lib/services/allowance-service'

export async function POST(request: NextRequest) {
  try {
    // ... existing rate limiting, auth, role check ...

    // 4. Atomically check eligibility and deduct allowance
    const allowanceResult = await checkAndDeductAllowance(user.id)

    if (!allowanceResult.success) {
      return errorResponses.validation(
        allowanceResult.errorMessage || "No letter credits remaining",
        { needsSubscription: true }
      )
    }

    // Log for debugging
    console.log('[GenerateLetter] Allowance check:', {
      userId: user.id,
      remaining: allowanceResult.remaining,
      wasDeducted: allowanceResult.wasDeducted,
      isSuperAdmin: allowanceResult.isSuperAdmin,
      isFreeTrial: allowanceResult.isFreeTrial
    })

    // 5. Parse and validate request body
    const body = await request.json()
    const { letterType, intakeData } = body

    const validation = validateLetterGenerationRequest(letterType, intakeData)
    if (!validation.valid) {
      // Refund allowance if validation fails
      if (allowanceResult.wasDeducted) {
        await refundAllowance(user.id)
      }

      console.error("[GenerateLetter] Validation failed:", validation.errors)
      return errorResponses.validation("Invalid input data", validation.errors)
    }

    // ... rest of the function ...

    // In the catch block, refund if needed
  } catch (error: any) {
    console.error('[GenerateLetter] Error:', error)

    // Refund allowance on error if it was deducted
    if (allowanceResult?.wasDeducted) {
      const refunded = await refundAllowance(user.id)
      console.log('[GenerateLetter] Refund after error:', refunded)
    }

    return handleApiError(error, 'GenerateLetter')
  }
}
```

4. **Testing** (0.5 hours)

Test cases to verify:
- Single user can't generate more letters than allowed
- Concurrent requests properly deduct allowance
- Free trial users can generate letters
- Super admins have unlimited access
- Refund works when generation fails

---

### Issue P0-2: Race Condition in Coupon Usage Tracking

**Priority:** CRITICAL
**Estimated Time:** 2 hours
**Files to Modify:**
- `app/api/create-checkout/route.ts`

**Current Problem:**
```typescript
// Lines 239-255
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

**Solution Steps:**

1. **Update checkout route** (1.5 hours)

Modify `app/api/create-checkout/route.ts:238-255`:

```typescript
// Replace read-then-update with atomic increment

// OLD CODE (DELETE):
// const { data: currentCoupon } = await supabase
//   .from('employee_coupons')
//   .select('usage_count')
//   .eq('code', couponCode)
//   .maybeSingle()
//
// const { error: updateError } = await supabase
//   .from('employee_coupons')
//   .update({
//     usage_count: (currentCoupon?.usage_count || 0) + 1,
//     updated_at: new Date().toISOString()
//   })
//   .eq('code', couponCode)

// NEW CODE (ATOMIC):
const { data: updatedCoupon, error: updateError } = await supabase
  .rpc('increment_coupon_usage', { coupon_code: couponCode })
  .single()

if (updateError) {
  console.error('[Checkout] Coupon increment error:', updateError)
  // Don't fail the entire checkout, but log for review
} else {
  console.log('[Checkout] Coupon usage incremented:', {
    code: couponCode,
    newUsageCount: updatedCoupon?.usage_count
  })
}
```

2. **Create RPC function** (0.5 hours)

Create `supabase/migrations/20260107000002_atomic_coupon_increment.sql`:

```sql
-- Atomic coupon usage increment
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_code TEXT)
RETURNS TABLE(usage_count INTEGER) AS $$
BEGIN
    UPDATE public.employee_coupons
    SET
        usage_count = employee_coupons.usage_count + 1,
        updated_at = NOW()
    WHERE code = coupon_code
    RETURNING employee_coupons.usage_count INTO usage_count;

    RETURN QUERY SELECT usage_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(TEXT) TO authenticated;

COMMENT ON FUNCTION public.increment_coupon_usage IS
'Atomically increments coupon usage count. Prevents race conditions from concurrent checkouts.';
```

---

### Issue P0-3: Missing Transaction Atomicity in Checkout

**Priority:** CRITICAL
**Estimated Time:** 6 hours
**Files to Modify:**
- `supabase/migrations/[timestamp]_atomic_checkout.sql` (new)
- `app/api/create-checkout/route.ts`

**Current Problem:**
```typescript
// Lines 182-256: Multiple operations not in transaction
1. Create subscription
2. Create commission  // If this fails...
3. Update coupon usage
4. Return success  // ...user gets subscription but employee loses commission
```

**Solution Steps:**

1. **Create atomic checkout RPC** (3 hours)

Create `supabase/migrations/20260107000003_atomic_checkout.sql`:

```sql
-- Atomic checkout function combining subscription, commission, and coupon update
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
DECLARE
    v_subscription_id UUID;
    v_commission_id UUID;
    v_coupon_usage INTEGER;
BEGIN
    -- Start transaction (implicit in function)

    -- 1. Create subscription
    INSERT INTO public.subscriptions (
        user_id,
        plan_type,
        stripe_subscription_id,
        stripe_customer_id,
        status,
        monthly_letter_allowance,
        total_letters_count,
        start_date,
        billing_cycle_start,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_plan_type,
        p_stripe_subscription_id,
        p_stripe_customer_id,
        p_status,
        p_monthly_allowance,
        p_total_letters,
        NOW(),
        NOW(),
        NOW(),
        NOW()
    )
    RETURNING id INTO v_subscription_id;

    -- 2. Create commission (if coupon provided)
    IF p_employee_id IS NOT NULL AND p_commission_amount IS NOT NULL THEN
        INSERT INTO public.commissions (
            employee_id,
            subscription_id,
            coupon_code,
            commission_amount,
            status,
            created_at
        ) VALUES (
            p_employee_id,
            v_subscription_id,
            p_coupon_code,
            p_commission_amount,
            'pending',
            NOW()
        )
        RETURNING id INTO v_commission_id;

        -- 3. Increment coupon usage atomically
        UPDATE public.employee_coupons
        SET
            usage_count = usage_count + 1,
            updated_at = NOW()
        WHERE code = p_coupon_code;

        GET DIAGNOSTICS v_coupon_usage = ROW_COUNT;

        IF v_coupon_usage = 0 THEN
            RAISE WARNING 'Coupon code % not found for increment', p_coupon_code;
        END IF;
    END IF;

    -- 4. Record coupon usage in analytics table
    IF p_coupon_code IS NOT NULL THEN
        INSERT INTO public.coupon_usage (
            coupon_code,
            user_id,
            subscription_id,
            discount_amount,
            used_at
        ) VALUES (
            p_coupon_code,
            p_user_id,
            v_subscription_id,
            p_discount_percent,
            NOW()
        )
        ON CONFLICT DO NOTHING;  -- In case of duplicate
    END IF;

    -- All operations succeeded, return success
    RETURN QUERY SELECT
        TRUE,
        v_subscription_id,
        v_commission_id,
        NULL::TEXT;

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction will be rolled back automatically
        RETURN QUERY SELECT
            FALSE,
            NULL::UUID,
            NULL::UUID,
            SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.create_subscription_with_commission TO authenticated;

COMMENT ON FUNCTION public.create_subscription_with_commission IS
'Atomically creates subscription with optional commission and coupon usage. All operations succeed or all fail together.';
```

2. **Update checkout route to use RPC** (2.5 hours)

Modify `app/api/create-checkout/route.ts`:

```typescript
// In TEST_MODE section (around line 220-256)

// Replace all the manual insert operations with:
const { data: checkoutResult, error: checkoutError } = await supabase
  .rpc('create_subscription_with_commission', {
    p_user_id: user.id,
    p_plan_type: planType,
    p_stripe_subscription_id: `test_sub_${Date.now()}`,  // Test mode ID
    p_stripe_customer_id: `test_cus_${Date.now()}`,
    p_status: 'active',
    p_monthly_allowance: selectedPlan.letters,
    p_total_letters: selectedPlan.letters,
    p_coupon_code: couponCode || null,
    p_employee_id: validatedCoupon?.employee_id || null,
    p_commission_amount: commissionAmount || null,
    p_discount_percent: validatedCoupon?.discount_percent || 0
  })
  .single()

if (checkoutError || !checkoutResult?.success) {
  console.error('[Checkout] Transaction failed:', checkoutError || checkoutResult?.error_message)
  return errorResponses.serverError(
    checkoutResult?.error_message || 'Failed to create subscription'
  )
}

console.log('[Checkout] Transaction successful:', {
  subscriptionId: checkoutResult.subscription_id,
  commissionId: checkoutResult.commission_id
})

return NextResponse.json({
  success: true,
  subscriptionId: checkoutResult.subscription_id,
  letters: selectedPlan.letters,
  message: 'Subscription created successfully'
})
```

3. **Also update webhook handler** (0.5 hours)

Use the same RPC in `app/api/stripe/webhook/route.ts` for consistency.

---

### Issue P0-4: Stripe Webhook Idempotency Gap

**Priority:** CRITICAL
**Estimated Time:** 3 hours
**Files to Modify:**
- `supabase/migrations/[timestamp]_webhook_events.sql` (new)
- `app/api/stripe/webhook/route.ts`

**Solution Steps:**

1. **Create webhook events table** (1 hour)

Create `supabase/migrations/20260107000004_webhook_idempotency.sql`:

```sql
-- Table to track processed webhooks
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_stripe_id ON public.webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_created ON public.webhook_events(created_at DESC);

-- RLS policies
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access (webhooks use service role)
CREATE POLICY "Service role full access"
    ON public.webhook_events FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Function to check and record webhook
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
    v_exists BOOLEAN;
BEGIN
    -- Check if already processed
    SELECT EXISTS(
        SELECT 1 FROM public.webhook_events
        WHERE stripe_event_id = p_stripe_event_id
    ) INTO v_exists;

    IF v_exists THEN
        SELECT id INTO v_event_id
        FROM public.webhook_events
        WHERE stripe_event_id = p_stripe_event_id;

        RETURN QUERY SELECT TRUE, v_event_id;
    ELSE
        -- Record as processed
        INSERT INTO public.webhook_events (
            stripe_event_id,
            event_type,
            metadata,
            processed_at
        ) VALUES (
            p_stripe_event_id,
            p_event_type,
            p_metadata,
            NOW()
        )
        RETURNING id INTO v_event_id;

        RETURN QUERY SELECT FALSE, v_event_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.check_and_record_webhook TO service_role;

COMMENT ON TABLE public.webhook_events IS
'Tracks processed Stripe webhooks to ensure idempotency and prevent duplicate processing.';
```

2. **Update webhook handler** (1.5 hours)

Modify `app/api/stripe/webhook/route.ts`:

```typescript
export async function POST(request: NextRequest) {
  try {
    // ... existing signature verification ...

    const event = constructedEvent

    // Check if webhook already processed (IDEMPOTENCY CHECK)
    const supabase = createServiceRoleClient()  // Service role for webhooks

    const { data: webhookCheck, error: webhookCheckError } = await supabase
      .rpc('check_and_record_webhook', {
        p_stripe_event_id: event.id,
        p_event_type: event.type,
        p_metadata: event.data.object
      })
      .single()

    if (webhookCheckError) {
      console.error('[Webhook] Failed to check idempotency:', webhookCheckError)
      // Continue processing but log error
    }

    if (webhookCheck?.already_processed) {
      console.log('[Webhook] Already processed:', {
        eventId: event.id,
        eventType: event.type,
        webhookRecordId: webhookCheck.event_id
      })

      // Return success (already processed)
      return NextResponse.json({
        received: true,
        alreadyProcessed: true,
        message: 'Webhook already processed'
      })
    }

    console.log('[Webhook] Processing new webhook:', {
      eventId: event.id,
      eventType: event.type,
      webhookRecordId: webhookCheck?.event_id
    })

    // Handle the event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        // ... existing processing ...
        // Use the atomic RPC from P0-3
        const { data: checkoutResult, error: checkoutError } = await supabase
          .rpc('create_subscription_with_commission', {
            p_user_id: userId,
            p_plan_type: planType,
            // ... other params ...
          })
          .single()

        if (checkoutError || !checkoutResult?.success) {
          console.error('[Webhook] Subscription creation failed:', checkoutError)
          // Webhook will be retried by Stripe, but won't duplicate thanks to idempotency
          return NextResponse.json({ received: false, error: 'Failed to create subscription' }, { status: 500 })
        }

        break

      // ... other event types ...
    }

    return NextResponse.json({ received: true, processed: true })
  } catch (error) {
    console.error('[Webhook] Error:', error)
    return NextResponse.json({ received: false, error: 'Webhook processing failed' }, { status: 500 })
  }
}
```

3. **Add cleanup job** (0.5 hours)

Add to `app/api/cron/cleanup-webhooks/route.ts` (new file):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  // Delete webhook events older than 30 days
  const { error } = await supabase
    .from('webhook_events')
    .delete()
    .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (error) {
    console.error('[CleanupWebhooks] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

---

## Phase 2: High Priority Fixes (P1) - 5 hours

### Issue P1-5: Test Mode Production Guard

**Estimated Time:** 30 minutes
**File:** `app/api/create-checkout/route.ts`

```typescript
// Line 12
const TEST_MODE = process.env.ENABLE_TEST_MODE === 'true'

// Add production guard immediately after
if (TEST_MODE && process.env.NODE_ENV === 'production') {
  console.error('[CRITICAL] Test mode enabled in production environment!')
  throw new Error('Test mode is not allowed in production. Set ENABLE_TEST_MODE=false.')
}

// Line 15: Update log
console.log('[Checkout] Request received, TEST_MODE:', TEST_MODE, 'ENV:', process.env.NODE_ENV)
```

---

### Issue P1-6: Email Template HTML Escaping

**Estimated Time:** 2 hours
**File:** `lib/email/templates.ts`

1. **Create HTML escape utility** (30 min)

Add to `lib/email/templates.ts`:

```typescript
/**
 * Escape HTML special characters to prevent injection
 */
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

/**
 * Escape and preserve newlines as <br> tags
 */
function escapeHtmlWithBreaks(text: string | undefined | null): string {
  if (!text) return ''
  return escapeHtml(text).replace(/\n/g, '<br>')
}
```

2. **Update all templates** (1.5 hours)

Update each template to use escaping:

```typescript
// BEFORE:
html: `<p>Rejection Reason: ${data.rejectionReason}</p>`

// AFTER:
html: `<p>Rejection Reason: ${escapeHtml(data.rejectionReason)}</p>`

// For multi-line content with line breaks:
html: `<p>${escapeHtmlWithBreaks(data.reviewNotes)}</p>`
```

Apply to ALL templates in the file.

---

### Issue P1-7: Missing Rate Limiting

**Estimated Time:** 1 hour
**Files:**
- `app/api/create-profile/route.ts`
- `app/api/gdpr/export-data/route.ts`
- `app/api/gdpr/delete-account/route.ts`

Add at the start of each POST handler:

```typescript
// Apply rate limiting
const rateLimitResponse = await safeApplyRateLimit(
  request,
  apiRateLimit,
  10,      // 10 requests
  "15 m"   // per 15 minutes
)
if (rateLimitResponse) return rateLimitResponse
```

---

### Issue P1-8: Netlify Configuration

**Estimated Time:** 5 minutes
**File:** `netlify.toml`

**Option 1: Delete (recommended)**
```bash
git rm netlify.toml
git commit -m "Remove netlify.toml - using Vercel deployment"
```

**Option 2: Fix for Netlify**
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

---

## Phase 3: Testing & Validation - 4 hours

### Unit Tests

Create `__tests__/allowance.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals'
import { checkAndDeductAllowance, refundAllowance } from '@/lib/services/allowance-service'

describe('Allowance Service', () => {
  it('should handle concurrent deductions correctly', async () => {
    // Test concurrent requests don't over-deduct
  })

  it('should refund allowance correctly', async () => {
    // Test refund functionality
  })

  it('should handle super admin unlimited access', async () => {
    // Test super admin bypass
  })
})
```

### Integration Tests

Create `__tests__/checkout.test.ts`:

```typescript
describe('Checkout Flow', () => {
  it('should create subscription with commission atomically', async () => {
    // Test full checkout flow
  })

  it('should rollback on commission failure', async () => {
    // Test transaction rollback
  })

  it('should increment coupon usage correctly', async () => {
    // Test atomic increment
  })
})
```

### Manual Testing Checklist

```markdown
- [ ] Letter generation with concurrent requests (use Postman/Thunder Client)
- [ ] Coupon usage with multiple simultaneous checkouts
- [ ] Stripe webhook duplicate delivery (simulate retry)
- [ ] Test mode blocked in production environment
- [ ] Email templates render correctly without HTML injection
- [ ] Rate limiting works on newly protected endpoints
- [ ] Super admin unlimited letter generation
- [ ] Free trial users can generate letters
- [ ] Refund works when generation fails
- [ ] Transaction rollback on commission failure
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run all migrations in staging environment
- [ ] Test all P0 fixes in staging
- [ ] Verify no regression in existing functionality
- [ ] Run security audit: `pnpm audit:security`
- [ ] Run database verification: `pnpm db:verify`
- [ ] Check TypeScript: `npx tsc --noEmit`
- [ ] Run linting: `pnpm lint`
- [ ] Verify `ENABLE_TEST_MODE=false` in production env

### Deployment

- [ ] Apply migrations to production database
- [ ] Deploy application code
- [ ] Monitor error logs for 1 hour
- [ ] Test letter generation in production
- [ ] Test subscription purchase in production
- [ ] Verify webhook processing (check `webhook_events` table)
- [ ] Check allowance deductions are accurate
- [ ] Verify commission creation
- [ ] Test email delivery

### Post-Deployment Monitoring

- [ ] Monitor for race condition indicators
- [ ] Check webhook_events for duplicate processing
- [ ] Verify coupon usage counts are accurate
- [ ] Monitor commission records
- [ ] Check error rates (should not increase)
- [ ] Verify email delivery rates

---

## Rollback Plan

If critical issues are discovered after deployment:

1. **Immediate Actions:**
   ```bash
   # Revert code deployment
   git revert <commit-hash>
   git push origin main

   # Or redeploy previous version
   vercel rollback
   ```

2. **Database Rollback:**
   - New RPC functions are additive (safe to leave)
   - If needed, can revert to old code paths
   - Webhook events table is safe to leave

3. **Communication:**
   - Notify users of any issues
   - Provide ETA for fix
   - Offer refunds if needed

---

## Success Metrics

After deployment, monitor these metrics:

| Metric | Target | Check |
|--------|--------|-------|
| Letter generation errors | < 0.1% | CloudWatch/logs |
| Duplicate subscriptions | 0 | Database query |
| Commission accuracy | 100% | Manual review |
| Webhook processing time | < 5s | Logs |
| Allowance accuracy | 100% | User reports |
| Email delivery rate | > 99% | Resend dashboard |

---

## Timeline Summary

| Phase | Duration | Days |
|-------|----------|------|
| P0-1: Allowance race condition | 4 hours | 0.5 |
| P0-2: Coupon race condition | 2 hours | 0.25 |
| P0-3: Checkout atomicity | 6 hours | 0.75 |
| P0-4: Webhook idempotency | 3 hours | 0.375 |
| P1-5: Test mode guard | 0.5 hours | 0.06 |
| P1-6: Email escaping | 2 hours | 0.25 |
| P1-7: Rate limiting | 1 hour | 0.125 |
| P1-8: Netlify config | 0.5 hours | 0.06 |
| Testing & validation | 4 hours | 0.5 |
| **Total** | **23 hours** | **~3 days** |

---

## Next Steps

1. **Review this plan** - Ensure all stakeholders agree
2. **Set up staging environment** - Test all fixes there first
3. **Create GitHub issues** - Track each fix separately
4. **Assign to developers** - Begin implementation
5. **Schedule deployment** - Pick low-traffic window
6. **Prepare rollback** - Have plan ready
7. **Monitor closely** - Watch metrics after deployment

---

**Plan Status:** ✅ Ready for Implementation
**Estimated Completion:** 3 working days
**Risk Level:** Medium (well-understood problems with clear solutions)
**Production Impact:** High (blocking issues for production readiness)

