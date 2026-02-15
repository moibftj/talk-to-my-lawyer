# Role-Based RLS Patterns

## Table of Contents
- Role Model
- Core Entity Relationships
- Employee Letter Blocking (Critical)
- Role Policy Templates
- RLS Test Strategy
- Security Checklist

## Role Model
This application uses role-based access control, not org-based tenancy.

```sql
CREATE TYPE user_role AS ENUM ('subscriber', 'employee', 'admin');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role user_role DEFAULT 'subscriber'
);

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role::TEXT FROM profiles WHERE id = auth.uid()),
    'subscriber'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

## Core Entity Relationships
- `profiles` is the central identity table.
- `subscriptions` track plan state and letter allowances.
- `letters` track legal-letter requests and review states.
- `employee_coupons` track referral code ownership and limits.
- `commissions` track earned payouts from referral subscriptions.
- `payout_requests` track employee withdrawals.

## Employee Letter Blocking (Critical)
Employees must never access `letters` data.

```sql
CREATE POLICY "Subscribers view own letters"
ON letters FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND get_user_role() = 'subscriber'
);

CREATE POLICY "Subscribers create own letters"
ON letters FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND get_user_role() = 'subscriber'
);

CREATE POLICY "Admins full letter access"
ON letters FOR ALL
TO authenticated
USING (get_user_role() = 'admin');
```

Do not use ownership-only checks without role checks.

## Role Policy Templates

### Subscriber-Owned Data
```sql
CREATE POLICY "Users view own subscriptions"
ON subscriptions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins view all subscriptions"
ON subscriptions FOR SELECT
USING (get_user_role() = 'admin');
```

### Employee-Owned Data
```sql
CREATE POLICY "Employees view own coupons"
ON employee_coupons FOR SELECT
USING (employee_id = auth.uid());

CREATE POLICY "Employees view own commissions"
ON commissions FOR SELECT
USING (employee_id = auth.uid());
```

### Public Validation (Checkout)
```sql
CREATE POLICY "Public can validate active coupons"
ON employee_coupons FOR SELECT
USING (is_active = true);
```

### Admin Full Access
```sql
CREATE POLICY "Admins manage all [table]"
ON [table] FOR ALL
USING (get_user_role() = 'admin');
```

## RLS Test Strategy
Verify each role explicitly.

```sql
-- Subscriber should see own letters only
SET auth.uid() = 'subscriber-uuid';
SELECT * FROM letters;

-- Employee should see no letters
SET auth.uid() = 'employee-uuid';
SELECT * FROM letters;

-- Admin should see all letters
SET auth.uid() = 'admin-uuid';
SELECT * FROM letters;
```

## Security Checklist
- RLS enabled on all exposed tables.
- Subscriber ownership enforced for subscriber resources.
- Employee letter blocking verified in tests.
- Admin-only operations constrained by role checks.
- Audit logging enabled for privileged actions.
