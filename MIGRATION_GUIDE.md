# Migration Application Guide

## Step 1: Apply Critical Migration (Race Condition Fix)

**Go to:** https://supabase.com/dashboard/project/nomiiqzxaxyxnxndvkbe/sql

**Copy and paste this SQL:**

```sql
/*
  P0-1: Fix Race Condition in Letter Allowance System

  This migration adds an atomic function to check and deduct letter allowance
  in a single database operation using SELECT FOR UPDATE row-level locking.
*/

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.check_letter_allowance(UUID);
DROP FUNCTION IF EXISTS public.deduct_letter_allowance(UUID);
DROP FUNCTION IF EXISTS public.add_letter_allowances(UUID, INTEGER);

-- Create atomic check_and_deduct_allowance function
CREATE OR REPLACE FUNCTION public.check_and_deduct_allowance(
    u_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    remaining INTEGER,
    error_message TEXT,
    is_free_trial BOOLEAN,
    is_super_admin BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
    sub_record RECORD;
    v_remaining INTEGER := 0;
    v_is_free_trial BOOLEAN := FALSE;
    v_is_super_admin BOOLEAN := FALSE;
    v_total_generated INTEGER := 0;
    letters_to_deduct INTEGER := 1;
BEGIN
    -- Lock the user's profile row to prevent concurrent modifications
    SELECT p.role, p.total_letters_generated
    INTO user_record
    FROM public.profiles p
    WHERE p.id = u_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'User not found'::TEXT, FALSE, FALSE;
        RETURN;
    END IF;

    v_total_generated := COALESCE(user_record.total_letters_generated, 0);

    -- Check if user is super admin (unlimited letters, no deduction needed)
    IF user_record.role = 'super_admin' THEN
        v_is_super_admin := TRUE;
        RETURN QUERY SELECT TRUE, NULL::INTEGER, NULL::TEXT, FALSE, TRUE;
        RETURN;
    END IF;

    -- Lock and check the user's active subscription
    SELECT s.id, s.credits_remaining, s.remaining_letters
    INTO sub_record
    FROM public.subscriptions s
    WHERE s.user_id = u_id
      AND s.status = 'active'
    FOR UPDATE;

    -- Check free trial eligibility (first letter)
    IF v_total_generated = 0 AND sub_record IS NULL THEN
        v_is_free_trial := TRUE;
        UPDATE public.profiles
        SET total_letters_generated = total_letters_generated + 1,
            updated_at = NOW()
        WHERE id = u_id;

        RETURN QUERY SELECT TRUE, 1::INTEGER, NULL::TEXT, TRUE, FALSE;
        RETURN;
    END IF;

    -- Check if user has an active subscription with remaining letters
    IF sub_record IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'No active subscription found'::TEXT, FALSE, FALSE;
        RETURN;
    END IF;

    -- Use credits_remaining if available, otherwise use remaining_letters
    v_remaining := COALESCE(sub_record.credits_remaining, 0);
    IF v_remaining = 0 THEN
        v_remaining := COALESCE(sub_record.remaining_letters, 0);
    END IF;

    IF v_remaining <= 0 THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'No letter credits remaining'::TEXT, FALSE, FALSE;
        RETURN;
    END IF;

    -- Deduct from credits_remaining first, then remaining_letters
    IF sub_record.credits_remaining IS NOT NULL AND sub_record.credits_remaining > 0 THEN
        UPDATE public.subscriptions
        SET credits_remaining = GREATEST(0, credits_remaining - letters_to_deduct),
            remaining_letters = GREATEST(0, COALESCE(remaining_letters, 0) -
                CASE WHEN credits_remaining >= letters_to_deduct THEN 0
                     ELSE letters_to_deduct - credits_remaining END),
            updated_at = NOW()
        WHERE id = sub_record.id;
    ELSE
        UPDATE public.subscriptions
        SET remaining_letters = GREATEST(0, COALESCE(remaining_letters, 0) - letters_to_deduct),
            updated_at = NOW()
        WHERE id = sub_record.id;
    END IF;

    -- Increment total letters generated
    UPDATE public.profiles
    SET total_letters_generated = total_letters_generated + 1,
        updated_at = NOW()
    WHERE id = u_id;

    v_remaining := v_remaining - letters_to_deduct;

    RETURN QUERY SELECT TRUE, v_remaining::INTEGER, NULL::TEXT, FALSE, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add refund function (for when generation fails)
CREATE OR REPLACE FUNCTION public.refund_letter_allowance(
    u_id UUID,
    amount INTEGER DEFAULT 1
)
RETURNS TABLE(
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    sub_record RECORD;
BEGIN
    SELECT s.id
    INTO sub_record
    FROM public.subscriptions s
    WHERE s.user_id = u_id
      AND s.status = 'active'
    FOR UPDATE;

    IF sub_record IS NULL THEN
        RETURN QUERY SELECT FALSE, 'No active subscription found'::TEXT;
        RETURN;
    END IF;

    UPDATE public.subscriptions
    SET credits_remaining = credits_remaining + amount,
        remaining_letters = COALESCE(remaining_letters, 0) + amount,
        updated_at = NOW()
    WHERE id = sub_record.id;

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper function to increment total letters (for free trials)
CREATE OR REPLACE FUNCTION public.increment_total_letters(
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles
    SET total_letters_generated = total_letters_generated + 1,
        updated_at = NOW()
    WHERE id = p_user_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Legacy compatibility function (read-only, for checking allowance)
CREATE OR REPLACE FUNCTION public.check_letter_allowance(
    u_id UUID
)
RETURNS TABLE(
    has_access BOOLEAN,
    letters_remaining INTEGER
) AS $$
DECLARE
    v_remaining INTEGER := 0;
    sub_record RECORD;
BEGIN
    SELECT s.credits_remaining, s.remaining_letters
    INTO sub_record
    FROM public.subscriptions s
    WHERE s.user_id = u_id
      AND s.status = 'active'
    LIMIT 1;

    IF sub_record IS NOT NULL THEN
        v_remaining := COALESCE(sub_record.credits_remaining, 0);
        IF v_remaining = 0 THEN
            v_remaining := COALESCE(sub_record.remaining_letters, 0);
        END IF;
    END IF;

    RETURN QUERY SELECT (v_remaining > 0)::BOOLEAN, v_remaining::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_and_deduct_allowance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_letter_allowance(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_total_letters(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_letter_allowance(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.check_and_deduct_allowance IS 'Atomically checks letter allowance and deducts one letter. Uses row-level locking (SELECT FOR UPDATE) to prevent race conditions.';
```

**Click "Run" button**

---

## Step 2: Verify Migration Applied

After running the SQL above, verify it worked:

```sql
-- Test the new function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'check_and_deduct_allowance',
    'refund_letter_allowance',
    'increment_total_letters',
    'check_letter_allowance'
);
```

You should see all 4 functions listed.

---

## Step 3: Apply Additional Migrations (Optional)

### Migration 2: Atomic Coupon Operations

```sql
-- Apply: supabase/migrations/20260107000002_atomic_coupon_increment.sql
-- (This prevents double-spending of referral coupons)
```

### Migration 3: Atomic Checkout

```sql
-- Apply: supabase/migrations/20260107000003_atomic_checkout.sql
-- (Idempotent checkout operations)
```

### Migration 4: Webhook Idempotency

```sql
-- Apply: supabase/migrations/20260107000004_webhook_idempotency.sql
-- (Prevents duplicate Stripe webhook charges)
```

---

## Step 4: Update Application Code

After applying the migration, update `app/api/generate-letter/route.ts` to use the new atomic function:

**Replace:**
```typescript
// OLD CODE (has race condition)
const { data: allowance } = await supabase.rpc('check_letter_allowance', { u_id: user.id });
if (!allowance?.has_access) {
  return errorResponses.forbidden('No letter credits remaining');
}
await supabase.rpc('deduct_letter_allowance', { u_id: user.id });
```

**With:**
```typescript
// NEW CODE (atomic, no race condition)
const { data: result } = await supabase.rpc('check_and_deduct_allowance', { u_id: user.id });

if (!result?.[0]?.success) {
  // Refund if deduction happened but generation failed
  if (result?.[0]?.is_free_trial) {
    await supabase.rpc('refund_letter_allowance', { u_id: user.id, amount: 1 });
  }
  return errorResponses.forbidden(result?.[0]?.error_message || 'No letter credits remaining');
}

// Proceed with letter generation
// If generation fails later, call: await supabase.rpc('refund_letter_allowance', { u_id: user.id });
```

---

## Step 5: Test

1. Run the schema verification script:
```bash
node scripts/verify-mcp-schema.js
```

2. All 6 RPC functions should now show ✅

---

## Need Help?

- **Database Issues**: Check Supabase Logs (https://supabase.com/dashboard/project/nomiiqzxaxyxnxndvkbe/logs)
- **Migration Errors**: Copy the error message and review the SQL syntax
- **API Issues**: Check the application logs after updating the code
