# Database Operations Guide

Complete guide for database management, migrations, testing, and operations for Talk-To-My-Lawyer Supabase project.

## Overview

Talk-To-My-Lawyer uses Supabase (PostgreSQL) with Row Level Security (RLS) for data isolation and security.

**Supabase Project**: Main (nomiiqzxaxyxnxndvkbe)

## Database Schema

### Core Tables

#### profiles
User profiles extending Supabase Auth users

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role DEFAULT 'subscriber',
  admin_sub_role TEXT,  -- 'system_admin' | 'attorney_admin'
  phone TEXT,
  company_name TEXT,
  stripe_customer_id TEXT,
  total_letters_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### subscriptions
User subscription and letter allowances

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'single_letter',
  plan_type TEXT,
  price NUMERIC(10,2) DEFAULT 299.00,
  discount NUMERIC(10,2) DEFAULT 0.00,
  coupon_code TEXT,
  employee_id UUID REFERENCES profiles(id),
  remaining_letters INTEGER DEFAULT 0,
  credits_remaining INTEGER DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### letters
Letter documents and workflow

```sql
CREATE TABLE letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  letter_type TEXT,
  intake_data JSONB DEFAULT '{}',
  ai_draft_content TEXT,
  final_content TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### employee_coupons
Employee referral coupons

```sql
CREATE TABLE employee_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) UNIQUE,
  code TEXT UNIQUE NOT NULL,
  discount_percent INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### commissions
Employee commission tracking

```sql
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id),
  subscription_id UUID REFERENCES subscriptions(id),
  subscription_amount NUMERIC(10,2),
  commission_rate NUMERIC(5,4) DEFAULT 0.0500,
  commission_amount NUMERIC(10,2),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Audit & Security Tables

- `letter_audit_trail` - Letter change history
- `email_queue` - Queued emails and retries
- `admin_audit_log` - Admin authentication and activity
- `fraud_detection_rules` - Fraud detection configuration
- `fraud_alerts` - Suspicious activity alerts

## Database Functions

### Letter Allowance Functions

#### check_letter_allowance(user_id)
Check available letter credits

```sql
SELECT * FROM check_letter_allowance('USER_UUID');
-- Returns: has_allowance, remaining, plan_name
```

#### deduct_letter_allowance(user_id)
Atomically deduct one letter credit

```sql
SELECT deduct_letter_allowance('USER_UUID');
-- Returns: true if successful, false if no credits
```

#### add_letter_allowances(user_id, amount)
Add credits based on plan type

```sql
SELECT add_letter_allowances('USER_UUID', 4);
```

### Admin Helper Functions

#### is_system_admin()
Check if current user is System Admin

```sql
SELECT is_system_admin();
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

Execute in sequence for clean setup:

1. `scripts/001-023.sql` - Core schema and updates
2. `supabase/migrations/*.sql` - Supabase CLI migrations (timestamp order)

### Running Migrations

```bash
# Via npm script
pnpm db:migrate

# Or manually in Supabase SQL Editor
# Execute each file in numeric order
```

### Migration Files

| Migration | Description |
|-----------|-------------|
| `001_setup_schema.sql` | Core tables |
| `002_setup_indexes.sql` | Performance indexes |
| `003_add_admin_column.sql` | Admin role column |
| `011_remove_is_superuser.sql` | Remove single-admin constraint |
| `012_add_multi_admin_support.sql` | Multi-admin system |
| `014_add_credits_remaining.sql` | Credit allowance system |
| `020_add_profile_totals.sql` | Aggregate fields |

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
-- Expected: true, 2, plan_name

-- Test 2: Deduct first letter
SELECT deduct_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: true

-- Test 3: Deduct last letter
SELECT deduct_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: true

-- Test 4: Check depleted
SELECT * FROM check_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: false, 0, plan_name

-- Test 5: Attempt over-deduction
SELECT deduct_letter_allowance('00000000-0000-0000-0000-000000000001');
-- Expected: false

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
