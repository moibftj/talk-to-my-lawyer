# Commission System

## Table of Contents
- Commission Model
- Core Tables
- Payout Lifecycle
- Investigation Queries
- Performance and Migration Notes

## Commission Model
- Employees earn a fixed-rate percentage of qualifying subscription payments (commonly 5%).
- Coupon attribution determines employee ownership for commissions.
- Commission statuses should transition through lifecycle states (for example `pending -> paid`).

## Core Tables

### `employee_coupons`
- One coupon owner per employee (`employee_id` unique).
- Tracks code usage, limits, activity, and expiration.
- Index coupon code and employee ID.

### `commissions`
- Links `employee_id` and `subscription_id`.
- Stores rate snapshot, subscription amount snapshot, commission amount.
- Tracks payout status and paid timestamp.

### `payout_requests`
- Tracks employee withdrawal requests.
- Stores method details and processing status.
- Includes processor metadata and rejection reason where applicable.

## Payout Lifecycle
1. Employee accrues `pending` commissions.
2. Employee submits payout request.
3. Admin processes request (`pending -> processing -> completed|rejected`).
4. Related commissions marked as paid when payout is finalized.

Controls:
- validate available unpaid balance before accepting request.
- prevent duplicate payout coverage for same commission rows.
- store immutable payout ledger events for audit.

## Investigation Queries
Commission records with subscription context:
```sql
SELECT c.*, s.price, s.discount, p.email
FROM commissions c
JOIN subscriptions s ON c.subscription_id = s.id
JOIN profiles p ON c.employee_id = p.id
WHERE c.employee_id = $1;
```

Coupon usage consistency check:
```sql
SELECT ec.code, ec.usage_count, COUNT(s.id) AS actual_usage
FROM employee_coupons ec
LEFT JOIN subscriptions s ON s.coupon_code = ec.code
WHERE ec.employee_id = $1
GROUP BY ec.id;
```

Payout history review:
```sql
SELECT *
FROM payout_requests
WHERE employee_id = $1
ORDER BY created_at DESC;
```

## Performance and Migration Notes
Indexing recommendations:
- `commissions(employee_id, status)`
- `subscriptions(user_id, status)`
- `letters(user_id, status)`

Migration safety:
- Use idempotent DDL (`IF NOT EXISTS`, `DROP ... IF EXISTS`).
- Backfill before adding strict `NOT NULL` constraints.
- Validate RLS behavior after every role-related migration.
