# Performance Quick Fixes Guide

Quick reference for implementing the most impactful performance improvements.

## 🔥 Critical Fix #1: Batch Operations N+1 Query

**File:** `app/api/admin/letters/batch/route.ts`

**Before (❌ Slow - N+1 pattern):**
```typescript
for (const letterId of letterIds) {
  const { data: letter } = await supabase
    .from('letters')
    .select('*, profiles:user_id(id, email, full_name)')
    .eq('id', letterId)
    .single()
}
// 50 letters = 50 queries = 5+ seconds
```

**After (✅ Fast - Single query):**
```typescript
const { data: letters } = await supabase
  .from('letters')
  .select('*, profiles:user_id(id, email, full_name)')
  .in('id', letterIds)  // Fetch all at once

const letterMap = new Map(letters.map(l => [l.id, l]))
// Process letterMap in parallel
// 50 letters = 1 query = <500ms
```

---

## 🔥 Critical Fix #2: Add Missing Indexes

**Create migration:** `supabase/migrations/YYYYMMDD_performance_indexes.sql`

```sql
-- Letters: user_id lookup (very common)
CREATE INDEX CONCURRENTLY idx_letters_user_id 
  ON letters(user_id) 
  WHERE status != 'deleted';

-- Subscriptions: Stripe webhook lookups
CREATE INDEX CONCURRENTLY idx_subscriptions_stripe_customer 
  ON subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Email queue: Processing pending emails
CREATE INDEX CONCURRENTLY idx_email_queue_retry_time
  ON email_queue(next_retry_at, status)
  WHERE status = 'pending';

-- Letters: Admin dashboard "approved today"
CREATE INDEX CONCURRENTLY idx_letters_approved_at
  ON letters(approved_at DESC)
  WHERE status = 'approved';
```

**Deploy:**
```bash
supabase db push
```

---

## 🔥 Critical Fix #3: Optimize Analytics Functions

**File:** `supabase/migrations/YYYYMMDD_analytics_optimization.sql`

**Before (❌ 7 table scans):**
```sql
SELECT
  (SELECT COUNT(*) FROM profiles),
  (SELECT COUNT(*) FROM profiles WHERE role = 'subscriber'),
  (SELECT COUNT(*) FROM profiles WHERE role = 'employee'),
  -- ... 4 more queries
```

**After (✅ 3 table scans with CTEs):**
```sql
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE(...) AS $$
BEGIN
  RETURN QUERY
  WITH user_counts AS (
    SELECT 
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE role = 'subscriber') AS subscribers,
      COUNT(*) FILTER (WHERE role = 'employee') AS employees
    FROM profiles
  ),
  letter_counts AS (
    SELECT 
      COUNT(*) FILTER (WHERE status IN ('pending_review', 'under_review')) AS pending,
      COUNT(*) FILTER (WHERE status = 'approved' AND approved_at::DATE = CURRENT_DATE) AS approved_today
    FROM letters
  ),
  financial_stats AS (
    SELECT 
      COALESCE(SUM(price - COALESCE(discount, 0)), 0) AS revenue,
      COALESCE(SUM(c.commission_amount) FILTER (WHERE c.status = 'pending'), 0) AS pending_comm
    FROM subscriptions s
    LEFT JOIN commissions c ON c.subscription_id = s.id
    WHERE s.status = 'active'
  )
  SELECT uc.*, lc.*, fs.*
  FROM user_counts uc
  CROSS JOIN letter_counts lc
  CROSS JOIN financial_stats fs;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## ⚠️ High Value Fix #4: Parallel Operations

**File:** `app/api/generate-letter/route.ts`

**Before (❌ Sequential - blocks for 200ms):**
```typescript
await incrementTotalLetters(user.id)  // Wait 20ms
await logLetterStatusChange(...)       // Wait 30ms
await notifyAdminsNewLetter(...)       // Wait 100ms
return successResponse(...)            // After 150ms delay
```

**After (✅ Parallel - return immediately):**
```typescript
// Fire-and-forget non-critical operations
Promise.allSettled([
  incrementTotalLetters(user.id),
  logLetterStatusChange(...),
  notifyAdminsNewLetter(...)
]).catch(err => console.error('Non-critical error:', err))

return successResponse(...)  // Return immediately!
```

---

## ⚠️ High Value Fix #5: Single Supabase Client Per Request

**Before (❌ Multiple clients):**
```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient()  // Client 1
  
  // ... some code ...
  
  const supabase2 = await createClient()  // Client 2 ❌
  await supabase2.from('users').select()
}
```

**After (✅ Reuse client):**
```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient()  // Client 1 - reuse everywhere
  
  await helperFunction(supabase)  // Pass client as param
}

async function helperFunction(supabase: SupabaseClient) {
  // Use passed client, don't create new one
  await supabase.from('users').select()
}
```

---

## ⚠️ High Value Fix #6: Email Queue Stats Optimization

**Before (❌ Fetch all rows):**
```typescript
const { data } = await supabase.from('email_queue').select('status')
// Transfers 100K rows, counts in JS
const pending = data.filter(i => i.status === 'pending').length
```

**After (✅ Database counting):**
```typescript
// Create RPC function
const { data } = await supabase.rpc('get_email_queue_stats')
// Returns: { pending: 5, sent: 1000, failed: 2, total: 1007 }
```

**Database function:**
```sql
CREATE OR REPLACE FUNCTION get_email_queue_stats()
RETURNS TABLE(pending BIGINT, sent BIGINT, failed BIGINT, total BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'sent'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*)
  FROM email_queue;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## 💡 Quick Win: Add Redis Caching

**File:** `lib/cache/redis-cache.ts` (create new)

```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 300
): Promise<T> {
  const cached = await redis.get<T>(key)
  if (cached) return cached
  
  const fresh = await fetcher()
  await redis.setex(key, ttl, JSON.stringify(fresh))
  return fresh
}
```

**Usage in API route:**
```typescript
import { getCached } from '@/lib/cache/redis-cache'

export async function GET(request: NextRequest) {
  const stats = await getCached(
    'admin:dashboard:stats',
    () => supabase.rpc('get_admin_dashboard_stats'),
    300  // 5 min cache
  )
  return NextResponse.json(stats)
}
```

---

## 📊 Verify Performance Improvements

**Add to each optimized endpoint:**
```typescript
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ... your code ...
    
    const duration = Date.now() - startTime
    console.log(`[Performance] ${request.url} completed in ${duration}ms`)
    
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Performance] ${request.url} failed after ${duration}ms`)
  }
}
```

**Monitor in production:**
```bash
# Vercel logs
vercel logs --follow

# Look for performance improvements:
# Before: "completed in 3450ms" 
# After:  "completed in 450ms" ✅
```

---

## 🎯 Performance Testing Checklist

After implementing fixes, test:

```bash
# 1. Load test admin dashboard
curl -X GET "https://your-app.vercel.app/api/admin/analytics"
# Before: ~800ms
# After:  ~150ms (with cache ~20ms)

# 2. Test batch operations
curl -X POST "https://your-app.vercel.app/api/admin/letters/batch" \
  -d '{"letterIds": ["id1", "id2", ...], "action": "approve"}'
# Before: 10+ seconds for 50 letters
# After:  <2 seconds for 50 letters

# 3. Test letter generation
curl -X POST "https://your-app.vercel.app/api/generate-letter" \
  -d '{"letterType": "demand", "intakeData": {...}}'
# Before: 3500ms
# After:  3200ms (200ms saved on non-critical ops)
```

---

## 🚨 Common Pitfalls to Avoid

1. **Don't use `.select('*')` in production**
   ```typescript
   // ❌ Bad: Fetches everything including large text fields
   .select('*')
   
   // ✅ Good: Only select what you need
   .select('id, title, status, created_at')
   ```

2. **Don't query in loops**
   ```typescript
   // ❌ Bad: N queries
   for (const id of ids) {
     await supabase.from('table').select().eq('id', id)
   }
   
   // ✅ Good: 1 query
   await supabase.from('table').select().in('id', ids)
   ```

3. **Don't create clients unnecessarily**
   ```typescript
   // ❌ Bad: Multiple clients
   const supabase1 = await createClient()
   const supabase2 = await createClient()
   
   // ✅ Good: Reuse one client
   const supabase = await createClient()
   ```

4. **Don't block on non-critical operations**
   ```typescript
   // ❌ Bad: Wait for logging
   await logAudit(...)
   return response
   
   // ✅ Good: Fire-and-forget
   logAudit(...).catch(console.error)
   return response
   ```

---

## 📖 See Also

- Full analysis: `PERFORMANCE_ANALYSIS.md`
- Database schema: `docs/DATABASE.md`
- Architecture: `docs/ARCHITECTURE_AND_DEVELOPMENT.md`
- Security: `docs/SECURITY.md`

---

**Questions?** Review the full `PERFORMANCE_ANALYSIS.md` for detailed explanations and impact estimates.
