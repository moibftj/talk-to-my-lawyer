# Payment Race Condition Fix - Deployment Guide

## Quick Summary

This deployment fixes a critical race condition between the verify-payment endpoint and Stripe webhook that could cause:
- Duplicate subscription creation attempts
- Duplicate commission creation
- Payment verification errors
- Inconsistent database state

## What Changed

### Database Changes
- **New RPC Function**: `verify_and_complete_subscription()`
  - Handles all race conditions internally using `FOR UPDATE SKIP LOCKED`
  - Returns `already_completed` flag to indicate webhook precedence
  - Fully atomic - all operations succeed or fail together

### API Changes
- **verify-payment endpoint**: Simplified to use new atomic RPC
- **Stripe webhook**: Updated to use new atomic RPC
- **Behavior**: Both can run concurrently without conflicts

## Deployment Instructions

### Option 1: Quick Deployment (Supabase CLI)

```bash
# 1. Link to your project
supabase link --project-ref your-project-ref

# 2. Apply migration
supabase db push

# 3. Verify
psql -h your-host -U postgres.your-project -d postgres -f scripts/verify-race-fix-deployment.sql
```

### Option 2: Safe Deployment (Script)

```bash
# 1. Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 2. Run deployment script
./scripts/deploy-race-fix.sh

# Script will:
# - Test database connection
# - Prompt for backup confirmation
# - Apply migration
# - Run verification checks
```

### Option 3: Manual Deployment

```bash
# 1. Create backup
supabase db dump -f backup_$(date +%Y%m%d).sql

# 2. Connect to database
psql -h your-host -U postgres.your-project -d postgres

# 3. Apply migration
\i supabase/migrations/20260122000005_verify_payment_race_fix.sql

# 4. Verify
\i scripts/verify-race-fix-deployment.sql
```

## Testing

### Automated Testing

```bash
# Set up test environment
export ENABLE_TEST_MODE=true
export TEST_USER_TOKEN="your-test-user-jwt"
export TEST_STRIPE_SESSION_ID="cs_test_12345"

# Run concurrent request test
node test-payment-race-condition.js
```

### Manual Testing

1. **Start dev server**: `pnpm dev`
2. **Use Stripe CLI** to forward webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. **Create test checkout**: `stripe trigger checkout.session.completed`
4. **Monitor logs** for:
   - "already completed by webhook" messages
   - No duplicate subscription errors
   - Successful payment verification

### Verification Queries

```sql
-- Check for duplicates (should return 0 rows)
SELECT stripe_session_id, COUNT(*) 
FROM subscriptions 
WHERE stripe_session_id IS NOT NULL 
GROUP BY stripe_session_id 
HAVING COUNT(*) > 1;

-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'verify_and_complete_subscription';
```

## Rollback Plan

If issues occur:

```sql
-- Drop new function (old function still exists)
DROP FUNCTION IF EXISTS public.verify_and_complete_subscription;

-- Code will fall back to complete_subscription_with_commission
-- (less optimal but functional)
```

## Monitoring

Watch for these success indicators:
- ✓ No "subscription already active" errors
- ✓ Both verify-payment and webhook succeed
- ✓ `already_completed` flag appears in logs when appropriate
- ✓ No duplicate subscriptions in database

## Files Changed

1. **Migration**: `supabase/migrations/20260122000005_verify_payment_race_fix.sql`
2. **API Route**: `app/api/verify-payment/route.ts`
3. **Webhook**: `app/api/stripe/webhook/route.ts`
4. **Test Script**: `test-payment-race-condition.js`
5. **Deploy Script**: `scripts/deploy-race-fix.sh`
6. **Verify Script**: `scripts/verify-race-fix-deployment.sql`

## Related Migrations

These should already be deployed:
- `20260122000001_email_queue_concurrency.sql` - Email queue locking
- `20260122000002_stripe_session_id_unique.sql` - Unique session constraint
- `20260107000003_atomic_checkout.sql` - Atomic checkout functions

## Support

For issues or questions:
1. Check `DEPLOYMENT_CHECKLIST.md` for detailed steps
2. Review application logs for errors
3. Run verification script for database health
4. Check Stripe webhook logs for delivery issues

## Timeline

- **Development**: 2026-01-21
- **Testing**: Run test script before production deployment
- **Staging**: Deploy and test for 24 hours (if available)
- **Production**: Deploy during low-traffic window

---

**Status**: Ready for deployment
**Risk Level**: Low (backward compatible, adds new function alongside existing)
**Estimated Downtime**: None (zero-downtime deployment)
