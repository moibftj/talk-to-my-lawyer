# Database Operations Guide

Complete guide for database management, migrations, testing, and operations for Talk-To-My-Lawyer Supabase project.

## Overview

Talk-To-My-Lawyer uses Supabase (PostgreSQL) with Row Level Security (RLS) for data isolation and security.

**Supabase Project**: Main (nomiiqzxaxyxnxndvkbe)

## Database Schema

Schema reference: `lib/database.types.ts` (generated from Supabase) is the source of truth for column names and types. The snippets below are simplified sketches for orientation.

### Core Tables

#### profiles
User profiles extending Supabase Auth users.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role,
  admin_sub_role admin_sub_role,
  phone TEXT,
  company_name TEXT,
  free_trial_used BOOLEAN,
  stripe_customer_id TEXT,
  total_letters_generated INTEGER,
  is_licensed_attorney BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### subscriptions
User subscriptions and letter allowances.

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan TEXT,
  plan_type TEXT,
  status subscription_status,
  price NUMERIC(10,2),
  discount NUMERIC(10,2),
  coupon_code TEXT,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  stripe_session_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  remaining_letters INTEGER,
  letters_remaining INTEGER,
  letters_per_period INTEGER,
  credits_remaining INTEGER,
  last_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### letters
Letter documents and review workflow.

```sql
CREATE TABLE letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status letter_status,
  letter_type TEXT,
  intake_data JSONB,
  ai_draft_content TEXT,
  final_content TEXT,
  draft_metadata JSONB,
  pdf_url TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  claimed_by UUID REFERENCES profiles(id),
  claimed_at TIMESTAMPTZ,
  is_attorney_reviewed BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### employee_coupons
Employee referral coupons.

```sql
CREATE TABLE employee_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) UNIQUE,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_percent INTEGER,
  is_active BOOLEAN,
  usage_count INTEGER,
  max_uses INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

#### commissions
Employee commission tracking.

```sql
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id),
  subscription_id UUID REFERENCES subscriptions(id),
  subscription_amount NUMERIC(10,2),
  commission_rate NUMERIC(5,4),
  commission_amount NUMERIC(10,2),
  status commission_status,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

### Supporting Tables

- **Audit & admin**: `letter_audit_trail`, `admin_audit_log`
- **Email**: `email_queue`, `email_queue_logs`, `email_delivery_log`
- **Coupons & usage**: `coupon_usage`, `promotional_code_usage`
- **GDPR**: `privacy_policy_acceptances`, `data_export_requests`, `data_deletion_requests`, `data_access_logs`
- **Security & fraud**: `security_audit_log`, `security_config`, `fraud_detection_config`, `fraud_detection_log`, `suspicious_patterns`
- **Payouts**: `payout_requests`
- **Webhooks & analytics**: `webhook_events`, `admin_coupon_analytics` (view)

## Database Functions

### Letter Allowance Functions

#### check_letter_allowance(user_id)
Check available letter credits

```sql
SELECT * FROM check_letter_allowance('USER_UUID');
-- Returns: has_access, letters_remaining
```

#### check_and_deduct_allowance(user_id)
Atomically check eligibility and deduct one credit

```sql
SELECT * FROM check_and_deduct_allowance('USER_UUID');
-- Returns: success, remaining, error_message, is_free_trial, is_super_admin
```

#### refund_letter_allowance(user_id, amount)
Refund credits after failed generation

```sql
SELECT * FROM refund_letter_allowance('USER_UUID', 1);
-- Returns: success, error_message
```

### Admin Helper Functions

#### is_super_admin()
Check if current user is Super Admin

```sql
SELECT is_super_admin();
```

#### is_attorney_admin()
Check if current user is Attorney Admin

```sql
SELECT is_attorney_admin();
```

#### get_admin_dashboard_stats()
Get comprehensive platform statistics

```sql
SELECT * FROM get_admin_dashboard_stats();
```

### Audit Functions

#### log_letter_audit(...)
Log letter state transitions

```sql
SELECT log_letter_audit(
  p_letter_id := 'LETTER_UUID',
  p_action := 'approved',
  p_old_status := 'under_review',
  p_new_status := 'approved',
  p_notes := 'Approved by admin'
);
```

## Database Migrations

### Migration Order

Execute in timestamp order from `supabase/migrations/`. The `pnpm db:migrate` script runs `scripts/run-migrations.js`, which applies all `.sql` files in `supabase/migrations/` sequentially.

### Running Migrations

```bash
# Via npm script
pnpm db:migrate

# Or manually in Supabase SQL Editor
# Execute each file in timestamp order from supabase/migrations/
```

### Migration Files

See `supabase/migrations/` for the full list. Key entries include:

| Migration | Description |
|-----------|-------------|
| `20251214022657_001_core_schema.sql` | Core tables, enums, indexes |
| `20251214022727_002_rls_policies.sql` | Base RLS policies |
| `20251214022758_003_database_functions.sql` | Core RPCs |
| `20250102000000_013_admin_role_separation.sql` | Admin sub-roles and helpers |
| `20260103000000_014_schema_alignment.sql` | Schema alignment updates |
| `20260116000000_020_email_queue_rpc_functions.sql` | Email queue RPCs |
| `20260116120000_021_schema_fixes.sql` | Schema fixes and enum updates |

## Database Testing

### Letter Allowance Test Plan

#### Test Scenarios

1. **Successful Allowance Check**
   - Goal: Verify correct data for user with credits
   - Expected: `has_allowance` is true, `remaining` matches

2. **Successful Letter Deduction**
   - Goal: Verify credit deduction works
   - Expected: Returns true, credits decrease by 1

3. **Depleted Allowance Check**
   - Goal: Verify behavior with zero credits
   - Expected: `has_allowance` is false, `remaining` is 0

4. **Deduction with Zero Credits**
   - Goal: Verify graceful failure
   - Expected: Returns false, no changes

#### Test Execution

```sql
-- Create test user
INSERT INTO profiles (id, email, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com', 'subscriber');

-- Create test subscription
INSERT INTO subscriptions (user_id, status, remaining_letters, credits_remaining)
VALUES ('00000000-0000-0000-0000-000000000001', 'active', 2, 2);

-- Test 1: Check initial allowance
SELECT * FROM check_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: has_access=true, letters_remaining=2

-- Test 2: Check + deduct first letter
SELECT * FROM check_and_deduct_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: success=true, remaining=1

-- Test 3: Check + deduct last letter
SELECT * FROM check_and_deduct_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: success=true, remaining=0

-- Test 4: Check depleted
SELECT * FROM check_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: has_access=false, letters_remaining=0

-- Test 5: Attempt over-deduction
SELECT * FROM check_and_deduct_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: success=false, error_message='No letter credits remaining'

-- Cleanup
DELETE FROM subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM profiles WHERE id = '00000000-0000-0000-0000-000000000001';
```

## Row Level Security (RLS)

### Core Policies

#### Profiles
- Users can only read/update their own profile
- Admins can access all profiles

#### Letters
- Users can only access their own letters
- Admins can access all letters

#### Subscriptions
- Users can only access their own subscriptions
- Admins can access all subscriptions

#### Employee Coupons
- Employees can access their own coupons
- Admins can access all coupons

### Verifying RLS

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'letters', 'subscriptions');

-- List all policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Common Queries

### User Statistics

```sql
-- Count users by role
SELECT role, COUNT(*) as count
FROM profiles
GROUP BY role;

-- Active subscriptions
SELECT COUNT(*) FROM subscriptions WHERE status = 'active';

-- Letters by status
SELECT status, COUNT(*) FROM letters GROUP BY status;
```

### Admin Operations

```sql
-- List all admin users
SELECT id, email, full_name, admin_sub_role, created_at
FROM profiles
WHERE role = 'admin'
ORDER BY created_at;

-- Letters pending review
SELECT id, title, user_id, created_at
FROM letters
WHERE status = 'pending_review'
ORDER BY created_at;

-- Commission summary
SELECT 
  e.email as employee,
  COUNT(*) as commission_count,
  SUM(c.commission_amount) as total_earned
FROM commissions c
JOIN profiles e ON c.employee_id = e.id
GROUP BY e.email;
```

### Performance Queries

```sql
-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
  schemaname, tablename, indexname,
  idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Backup & Recovery

### Automated Backups
- **Frequency**: Every 6 hours (Supabase automatic)
- **Retention**: 30 days
- **Location**: Supabase Dashboard → Database → Backups

### Manual Backup

```bash
# Via pg_dump (if direct access available)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Point-in-Time Recovery

Via Supabase Dashboard:
1. Go to Database → Backups
2. Select backup or specify timestamp
3. Click "Restore"

## Database Maintenance

### Regular Tasks

**Weekly**:
- Review slow queries
- Check table sizes
- Verify index usage
- Monitor connection pool

**Monthly**:
- Vacuum analyze tables
- Review and update statistics
- Check for bloat
- Update indexes if needed

### Optimization

```sql
-- Vacuum and analyze
VACUUM ANALYZE profiles;
VACUUM ANALYZE letters;
VACUUM ANALYZE subscriptions;

-- Update statistics
ANALYZE profiles;
ANALYZE letters;

-- Reindex if needed
REINDEX TABLE profiles;
```

## Troubleshooting

### Connection Issues
- Check Supabase dashboard for database status
- Verify connection string format
- Check connection pool settings
- Review firewall/network rules

### Performance Issues
- Identify slow queries with pg_stat_statements
- Check missing indexes
- Review table bloat
- Optimize query plans

### Data Integrity
- Verify foreign key constraints
- Check for orphaned records
- Validate data types
- Review constraint violations

---

**Last Updated**: January 2026  
**Database Version**: PostgreSQL 15 (Supabase)
