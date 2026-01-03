# Test Plan: Letter Allowance & Credit Functions

This test plan outlines the scenarios and SQL scripts required to verify the updated `deduct_letter_allowance` and `check_letter_allowance` functions in the Supabase project.

## 1. Test Scenarios

### Scenario 1: Successful Allowance Check
*   **Goal:** Verify `check_letter_allowance` returns correct data for a user with an active subscription and remaining credits.
*   **Expectation:** `has_allowance` is `true`, `remaining` matches the database, and `plan_name` is correct.

### Scenario 2: Successful Letter Deduction
*   **Goal:** Verify `deduct_letter_allowance` correctly decrements credits and increments the total letters counter.
*   **Expectation:** Returns `true`, `remaining_letters` and `credits_remaining` decrease by 1, and `total_letters_generated` increases by 1.

### Scenario 3: Depleted Allowance Check
*   **Goal:** Verify `check_letter_allowance` returns `false` when credits are zero.
*   **Expectation:** `has_allowance` is `false`, `remaining` is `0`.

### Scenario 4: Deduction with Zero Credits
*   **Goal:** Verify `deduct_letter_allowance` fails gracefully when no credits are left.
*   **Expectation:** Returns `false`, no changes to database values.

### Scenario 5: No Active Subscription
*   **Goal:** Verify functions handle users without any active subscription.
*   **Expectation:** Both functions return `false` or empty results as appropriate.

### Scenario 6: Atomic Race Condition (Conceptual)
*   **Goal:** Ensure `FOR UPDATE` prevents double-spending of the last credit.
*   **Expectation:** In a high-concurrency environment, only one request should succeed if only 1 credit remains.

---

## 2. Test Setup

Before running tests, create a dummy test user and subscription:

```sql
-- 1. Create a test profile
INSERT INTO public.profiles (id, email, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com', 'Test User', 'subscriber')
ON CONFLICT (id) DO NOTHING;

-- 2. Create a test subscription with 2 letters
INSERT INTO public.subscriptions (user_id, status, plan_type, remaining_letters, credits_remaining)
VALUES ('00000000-0000-0000-0000-000000000001', 'active', 'standard_4_month', 2, 2);
```

---

## 3. Execution Scripts

### Test 1: Check Initial Allowance
```sql
SELECT * FROM public.check_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: true, 2, 'standard_4_month'
```

### Test 2: Deduct First Letter
```sql
SELECT public.deduct_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: true

SELECT remaining_letters, credits_remaining, total_letters_generated 
FROM public.subscriptions s JOIN public.profiles p ON s.user_id = p.id
WHERE p.id = '00000000-0000-0000-0000-000000000001';
-- Expected: 1, 1, 1
```

### Test 3: Deduct Last Letter
```sql
SELECT public.deduct_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: true

SELECT * FROM public.check_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: false, 0, 'standard_4_month'
```

### Test 4: Attempt Deduction with Zero Credits
```sql
SELECT public.deduct_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: false
```

---

## 4. Cleanup

```sql
DELETE FROM public.subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
```
