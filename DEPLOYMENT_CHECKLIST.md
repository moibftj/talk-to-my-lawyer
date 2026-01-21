# Deployment Checklist: Payment Race Condition Fix

## Overview
This checklist covers deployment of the verify-payment race condition fix and related improvements.

## Migration Files
✅ Created:
- `20260122000005_verify_payment_race_fix.sql` - New atomic RPC function

✅ Already Applied (verify these are deployed):
- `20260122000001_email_queue_concurrency.sql` - Email queue locking
- `20260122000002_stripe_session_id_unique.sql` - Unique session constraint
- `20260122000003_email_queue_processing_status.sql` - Processing status
- `20260107000003_atomic_checkout.sql` - Atomic checkout functions

## Pre-Deployment Steps

### 1. Backup Database
```bash
# Create a backup before deployment
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Verify Local Environment
```bash
# Check environment variables
node check-email-config.js

# Validate environment
pnpm validate-env

# Run linter
pnpm lint

# Build check
CI=1 pnpm build
```

### 3. Review Migration
```bash
# Review the new migration
cat supabase/migrations/20260122000005_verify_payment_race_fix.sql
```

## Deployment Steps

### Method 1: Using Supabase CLI (Recommended)
```bash
# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Check migration status
supabase db diff

# Apply migrations
supabase db push

# Verify migration
supabase db diff --linked
```

### Method 2: Using deploy-migrations.sh
```bash
# Set up environment variables in .env.local
# SUPABASE_DB_PASSWORD=your-password
# SUPABASE_DB_HOST=aws-1-us-east-2.pooler.supabase.com
# SUPABASE_DB_USER=postgres.your-project-ref

# Run deployment script
./deploy-migrations.sh
```

### Method 3: Manual SQL Execution
```bash
# Connect to database
psql -h your-host -U postgres.your-project -d postgres

# Copy and paste the SQL from the migration file
\i supabase/migrations/20260122000005_verify_payment_race_fix.sql
```

## Post-Deployment Verification

### 1. Verify Function Exists
```sql
-- Check the new function
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.proname = 'verify_and_complete_subscription';

-- Check grants
SELECT 
    grantee,
    routine_name,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'verify_and_complete_subscription';
```

### 2. Test Payment Flow
```bash
# Set up test environment
export ENABLE_TEST_MODE=true
export NEXT_PUBLIC_TEST_MODE=true

# Get test user token (from your auth system)
export TEST_USER_TOKEN="your-test-token"
export TEST_STRIPE_SESSION_ID="cs_test_example"

# Run payment race condition test
node test-payment-race-condition.js
```

### 3. Test with Stripe CLI
```bash
# Install Stripe CLI if not already installed
# stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test checkout session
stripe trigger checkout.session.completed
```

### 4. Monitor Logs
```bash
# In one terminal, watch application logs
pnpm dev

# In another, watch Supabase logs (if using Supabase CLI)
supabase logs --tail

# Check for race condition indicators:
# - "already completed by webhook" messages
# - No duplicate subscription errors
# - No commission creation errors
```

### 5. Database Health Check
```sql
-- Check for duplicate subscriptions (should be 0)
SELECT 
    stripe_session_id,
    COUNT(*) as count
FROM subscriptions
WHERE stripe_session_id IS NOT NULL
GROUP BY stripe_session_id
HAVING COUNT(*) > 1;

-- Check for orphaned commissions (should be 0)
SELECT 
    c.id,
    c.subscription_id,
    s.id as sub_exists
FROM commissions c
LEFT JOIN subscriptions s ON s.id = c.subscription_id
WHERE s.id IS NULL;

-- Check email queue status
SELECT 
    status,
    COUNT(*) as count
FROM email_queue
GROUP BY status;
```

## Rollback Plan

If issues occur, rollback using:

```sql
-- Drop the new function
DROP FUNCTION IF EXISTS public.verify_and_complete_subscription;

-- The old code will fall back to complete_subscription_with_commission
-- which still exists and works (though with more race condition risk)
```

## Testing Checklist

### Manual Testing
- [ ] Create new subscription via checkout
- [ ] Verify subscription activates correctly
- [ ] Check commission is created (if applicable)
- [ ] Verify email is sent
- [ ] Test with 100% discount coupon
- [ ] Test with employee referral code
- [ ] Verify allowance is set correctly

### Race Condition Testing
- [ ] Run concurrent payment verification test
- [ ] Verify no duplicate subscriptions created
- [ ] Verify no duplicate commissions created
- [ ] Check idempotency logs
- [ ] Verify webhook handles already-completed subscriptions

### Edge Cases
- [ ] Test payment already completed by webhook
- [ ] Test webhook arrives before verify-payment
- [ ] Test simultaneous requests
- [ ] Test webhook retry (should be idempotent)
- [ ] Test with expired session
- [ ] Test with failed payment

## Monitoring

After deployment, monitor for:

### Success Indicators
- ✓ No "subscription already active" errors
- ✓ Verify-payment and webhook both return success
- ✓ "already_completed" flag working correctly
- ✓ No duplicate subscriptions in database
- ✓ Commission emails sent once per subscription

### Error Indicators
- ✗ Duplicate subscription errors
- ✗ Commission creation failures
- ✗ Database constraint violations
- ✗ Orphaned pending subscriptions
- ✗ Multiple commissions for same subscription

## Documentation Updates

After successful deployment:
- [ ] Update AGENTS.md with deployment date
- [ ] Document any configuration changes
- [ ] Update team on new RPC function
- [ ] Note any behavior changes in logs

## Support Team Notification

Inform support team of:
1. New atomic payment verification in place
2. Better handling of concurrent payment processing
3. Expected log messages about "already completed"
4. No user-facing changes expected

## Production Deployment Timeline

1. **Deploy to Staging** (if available)
   - Test all scenarios
   - Monitor for 24 hours

2. **Deploy to Production**
   - Low-traffic window (e.g., 2 AM UTC)
   - Have DBA on standby
   - Monitor closely for 1 hour

3. **Post-Deployment**
   - Monitor for 24 hours
   - Check metrics daily for 1 week
   - Review any error logs

## Contact Information

- Database Lead: [Name]
- Backend Lead: [Name]
- On-Call Engineer: [Name]
- Rollback Authority: [Name]

## Sign-off

- [ ] Code reviewed
- [ ] Migrations reviewed
- [ ] Testing completed
- [ ] Documentation updated
- [ ] Team notified
- [ ] Monitoring configured
- [ ] Rollback plan tested

---

**Deployment Date:** _________________
**Deployed By:** _________________
**Verified By:** _________________
