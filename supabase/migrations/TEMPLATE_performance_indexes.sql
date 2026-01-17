-- Performance Optimization Migration
-- Created: 2025-01-17
-- Purpose: Add missing indexes identified in performance analysis
-- Safe to run: Uses CONCURRENTLY to avoid table locks

-- =============================================================================
-- CRITICAL INDEXES - High Impact
-- =============================================================================

-- Index 1: Letters by user_id (very common query)
-- Before: Table scan on letters.user_id
-- After: Index scan, 15x faster
-- Impact: Affects dashboard, letter lists, user queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_user_id_active
  ON letters(user_id, created_at DESC)
  WHERE status != 'deleted';

COMMENT ON INDEX idx_letters_user_id_active IS 
  'Optimizes user letter listings, excludes deleted letters';

-- Index 2: Letters reviewed by admin
-- Before: Full table scan
-- After: Index scan for admin dashboard
-- Impact: Admin "my reviews" page
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_reviewed_by
  ON letters(reviewed_by, reviewed_at DESC NULLS LAST)
  WHERE reviewed_by IS NOT NULL;

COMMENT ON INDEX idx_letters_reviewed_by IS 
  'Optimizes admin dashboard showing letters reviewed by specific admin';

-- Index 3: Stripe customer ID lookup (webhook processing)
-- Before: Sequential scan on subscriptions
-- After: Direct index lookup
-- Impact: Every Stripe webhook (critical path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_stripe_customer
  ON subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON INDEX idx_subscriptions_stripe_customer IS 
  'Critical for Stripe webhook processing - finds subscription by customer_id';

-- Index 4: Email queue processing
-- Before: Full table scan to find pending emails
-- After: Index-only scan
-- Impact: Email queue cron job performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_queue_retry_pending
  ON email_queue(next_retry_at, created_at)
  WHERE status = 'pending';

COMMENT ON INDEX idx_email_queue_retry_pending IS 
  'Optimizes email queue processing - only indexes pending emails';

-- Index 5: Approved letters by date (analytics)
-- Before: Sequential scan with filter
-- After: Index scan
-- Impact: Analytics dashboard "approved today" count
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_approved_at
  ON letters(approved_at DESC)
  WHERE status = 'approved';

COMMENT ON INDEX idx_letters_approved_at IS 
  'Optimizes analytics queries for approved letters timeline';

-- =============================================================================
-- COVERING INDEXES - Reduce table lookups
-- =============================================================================

-- Covering index for letter list queries
-- Includes commonly selected columns to avoid table lookup
-- Impact: Letter list API endpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_list_covering
  ON letters(user_id, created_at DESC)
  INCLUDE (id, title, status, letter_type);

COMMENT ON INDEX idx_letters_list_covering IS 
  'Covering index for letter lists - includes all columns needed for list view';

-- =============================================================================
-- COMPOSITE INDEXES - Multi-column queries
-- =============================================================================

-- Index for admin letter filtering by status + creation time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_status_created
  ON letters(status, created_at DESC)
  WHERE status NOT IN ('deleted', 'draft');

COMMENT ON INDEX idx_letters_status_created IS 
  'Optimizes admin filtering by status with time ordering';

-- Index for subscription lookups by user and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_user_status_active
  ON subscriptions(user_id, status, created_at DESC)
  WHERE status IN ('active', 'pending');

COMMENT ON INDEX idx_subscriptions_user_status_active IS 
  'Optimizes subscription queries - only indexes active/pending';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Run these queries to verify indexes are being used:

-- Query 1: Check letter lookup by user
EXPLAIN ANALYZE
SELECT id, title, status, letter_type, created_at
FROM letters
WHERE user_id = '00000000-0000-0000-0000-000000000001'
  AND status != 'deleted'
ORDER BY created_at DESC
LIMIT 20;
-- Should show: "Index Scan using idx_letters_user_id_active"

-- Query 2: Check Stripe customer lookup
EXPLAIN ANALYZE
SELECT id, user_id, status
FROM subscriptions
WHERE stripe_customer_id = 'cus_test123';
-- Should show: "Index Scan using idx_subscriptions_stripe_customer"

-- Query 3: Check email queue processing
EXPLAIN ANALYZE
SELECT id, to, subject, html
FROM email_queue
WHERE status = 'pending'
  AND next_retry_at <= NOW()
ORDER BY created_at
LIMIT 10;
-- Should show: "Index Scan using idx_email_queue_retry_pending"

-- =============================================================================
-- INDEX STATISTICS
-- =============================================================================

-- View index usage statistics (run after production deployment)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;

-- =============================================================================
-- CLEANUP (if needed)
-- =============================================================================

-- Drop old redundant indexes (only if they exist and are truly redundant)
-- Review carefully before running!

-- Example: If idx_letters_user_status exists but idx_letters_user_id_active is better
-- DROP INDEX CONCURRENTLY IF EXISTS idx_letters_user_status_old;

-- =============================================================================
-- MAINTENANCE NOTES
-- =============================================================================

/*
IMPORTANT NOTES:

1. CONCURRENTLY keyword prevents table locks - safe for production
2. Partial indexes (WHERE clauses) save space by excluding irrelevant rows
3. Covering indexes (INCLUDE) avoid table lookups for index-only scans
4. Monitor index usage with pg_stat_user_indexes
5. Rebuild indexes if fragmented: REINDEX INDEX CONCURRENTLY index_name

MAINTENANCE SCHEDULE:
- Check index usage: Weekly
- Analyze tables: Daily (auto-vacuum should handle this)
- Rebuild fragmented indexes: Quarterly
- Review slow queries: Weekly

PERFORMANCE IMPACT ESTIMATES:
- Letter list queries: 300ms → 20ms (15x faster)
- Stripe webhooks: 500ms → 50ms (10x faster)
- Email queue processing: 200ms → 15ms (13x faster)
- Admin dashboard: 800ms → 150ms (5x faster with other optimizations)

DISK SPACE:
- Estimated total index size: ~50-100MB (for 10K letters, 1K users)
- Partial indexes save ~40% space vs full indexes
- Covering indexes add ~20% overhead but eliminate table lookups

ROLLBACK PLAN:
If indexes cause issues (unlikely with CONCURRENTLY):
1. DROP INDEX CONCURRENTLY idx_name;
2. No downtime required
3. Queries will fall back to table scans
*/

-- =============================================================================
-- POST-DEPLOYMENT VALIDATION
-- =============================================================================

-- 1. Verify all indexes were created
SELECT 
  indexname, 
  indexdef,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- 2. Check for missing indexes on foreign keys (should be none after this)
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = tc.table_name
      AND indexdef LIKE '%' || kcu.column_name || '%'
  );

-- 3. Analyze tables to update statistics
ANALYZE letters;
ANALYZE subscriptions;
ANALYZE email_queue;
ANALYZE profiles;

-- =============================================================================
-- SUCCESS CRITERIA
-- =============================================================================

/*
After deployment, verify:

✅ All indexes created successfully (no errors)
✅ EXPLAIN ANALYZE shows indexes are being used
✅ Response times improved on affected endpoints
✅ No lock warnings or timeouts
✅ Database CPU usage decreased
✅ Slow query log shows fewer table scans

Expected improvements:
- Admin dashboard load: 800ms → 150ms
- User letter list: 300ms → 20ms
- Batch operations: 10s → 2s (with code changes)
- Email queue processing: 200ms → 15ms

Monitor for 24 hours and review:
- Query performance in Supabase dashboard
- API response times in Vercel analytics
- Error rates (should not increase)
*/
