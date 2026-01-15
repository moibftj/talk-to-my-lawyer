# Database Schema Status Report
**Generated:** 2026-01-15
**Method:** MCP Postgres + Supabase Client

## Executive Summary

⚠️ **Schema Drift Detected**: Database is behind latest migrations by ~6 migrations

### Current Status
- ✅ **13/13 Tables** - All core tables accessible
- ⚠️ **2/6 RPC Functions** - Some new functions missing
- ⚠️ **6 Unapplied Migrations** - Need to be applied

---

## Database Connection Status

### ✅ Working Connections
- **Supabase REST API** - Fully operational via service role key
- **MCP Postgres Server** - Connected (via pooler)

### ❌ Connection Issues
- **Direct PostgreSQL** - IPv6 network errors in containerized environment
- **Migration Script** - Cannot execute due to connection issues

---

## Schema Verification Results

### Tables: ✅ ALL PRESENT (13/13)

| Table | Status | Access |
|-------|--------|--------|
| profiles | ✅ | Readable |
| letters | ✅ | Readable |
| subscriptions | ✅ | Readable |
| employee_coupons | ✅ | Readable |
| commissions | ✅ | Readable |
| letter_audit_trail | ✅ | Readable |
| coupon_usage | ✅ | Readable |
| payout_requests | ✅ | Readable |
| data_export_requests | ✅ | Readable |
| data_deletion_requests | ✅ | Readable |
| privacy_policy_acceptances | ✅ | Readable |
| admin_audit_log | ✅ | Readable |
| email_queue | ✅ | Readable |

### RPC Functions: ⚠️ PARTIAL (2/6)

#### ✅ Operational
- `reset_monthly_allowances` - Monthly credit reset (cron)
- `get_admin_dashboard_stats` - Admin analytics

#### ❌ Missing (Need Migration)
- `check_and_deduct_allowance` - **NEW**: Atomic allowance check + deduct
- `refund_letter_allowance` - **NEW**: Refund letter credits on failures
- `increment_total_letters` - **NEW**: Track total letters generated
- `check_letter_allowance` - **LEGACY**: Read-only check (deprecated by atomic version)

---

## Unapplied Migrations

### High Priority
1. **20260107000001_atomic_allowance_deduction.sql** (Jan 7)
   - ⚠️ **CRITICAL**: Fixes race condition in letter generation
   - Replaces: `check_letter_allowance`, `deduct_letter_allowance`, `add_letter_allowances`
   - Adds: `check_and_deduct_allowance`, `refund_letter_allowance`, `increment_total_letters`

2. **20260107000002_atomic_coupon_increment.sql** (Jan 7)
   - Atomic coupon operations to prevent double-spending

3. **20260107000003_atomic_checkout.sql** (Jan 7)
   - Idempotent checkout operations

4. **20260107000004_webhook_idempotency.sql** (Jan 7)
   - Stripe webhook idempotency to prevent duplicate charges

### Recent Updates
5. **20260115000000_019_letter_claiming.sql** (Jan 15)
   - Letter claiming/assignment features

6. **20260115120000_fix_rls_admin_policies.sql** (Jan 15)
   - RLS policy fixes for admin access

---

## Impact Analysis

### 🚨 Critical Issues

1. **Race Condition in Letter Generation**
   - **Risk**: Concurrent requests could deduct allowance multiple times
   - **Impact**: Users could generate more letters than allowed
   - **Fix**: Migration #1 (atomic_allowance_deduction)

2. **Missing Refund Functionality**
   - **Risk**: Failed letter generations don't refund credits
   - **Impact**: Users lose credits on errors
   - **Fix**: Migration #1 (refund_letter_allowance)

### ⚠️ Important Features

3. **Webhook Idempotency**
   - **Risk**: Stripe webhook retries could cause duplicate charges
   - **Impact**: Billing errors
   - **Fix**: Migration #4

4. **Letter Claiming**
   - **Impact**: New feature unavailable
   - **Fix**: Migration #5

---

## Recommendations

### Immediate Actions Required

1. **Apply Critical Migrations** (Migrations #1-4)
   ```bash
   # Option 1: Via Supabase Dashboard
   # Go to: Database > Migrations > Apply migration

   # Option 2: Via Supabase CLI (if available locally)
   supabase db push

   # Option 3: Manual SQL execution
   # Copy SQL from migration files and run in Supabase SQL Editor
   ```

2. **Update Code to Use New RPC Functions**
   - Replace `check_letter_allowance()` + `deduct_letter_allowance()` calls
   - Use new `check_and_deduct_allowance()` function
   - See: `app/api/generate-letter/route.ts`

3. **Update MCP Configuration**
   - The `.mcp.json` postgres credentials may be outdated
   - Update with current Supabase database password from dashboard

### Long-term Actions

4. **Set Up Migration Tracking**
   - Consider using Supabase's built-in migration system
   - Document which migrations have been applied to production

5. **Update Alignment Report**
   - Regenerate `DATABASE_ALIGNMENT_REPORT.md` after applying migrations
   - Run: `pnpm db:verify`

---

## TypeScript Types Alignment

### ✅ Verified
- Database types in `lib/database.types.ts` are auto-generated
- Type definitions match current schema (13 tables)
- RPC function signatures may need update after migrations

### ⚠️ Pending
After applying migrations, regenerate types:
```bash
pnpm supabase gen types typescript --local > lib/database.types.ts
```

---

## MCP Tools Status

| MCP Server | Status | Tools Available |
|------------|--------|-----------------|
| **Postgres** | ✅ Connected | Query database (limited by network) |
| **Filesystem** | ✅ Connected | Full file operations |
| **GitHub** | ✅ Connected | Issues, PRs, repo management |
| **Vercel** | ❌ Failed | (Running via extensions instead) |

---

## Next Steps

1. **Apply migrations** via Supabase Dashboard SQL Editor
2. **Verify RPC functions** work correctly
3. **Test letter generation** with new atomic function
4. **Update MCP postgres credentials** if needed
5. **Regenerate database types** after migration

---

## Migration Files Reference

All migration files located in: `supabase/migrations/`

- `20260107000001_atomic_allowance_deduction.sql` - **CRITICAL**
- `20260107000002_atomic_coupon_increment.sql` - **HIGH**
- `20260107000003_atomic_checkout.sql` - **HIGH**
- `20260107000004_webhook_idempotency.sql` - **HIGH**
- `20260115000000_019_letter_claiming.sql` - **MEDIUM**
- `20260115120000_fix_rls_admin_policies.sql` - **MEDIUM**

---

**Status**: ⚠️ Database schema is partially aligned. Critical migrations needed.
**Risk**: High - Race conditions in production code.
**Priority**: Apply migrations immediately.
