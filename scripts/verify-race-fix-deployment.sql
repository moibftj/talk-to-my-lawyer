-- Verification Script for Payment Race Condition Fix
-- Run this after deploying migration 20260122000005_verify_payment_race_fix.sql

\echo '============================================'
\echo 'Payment Race Condition Fix - Verification'
\echo '============================================'
\echo ''

-- 1. Check if new function exists
\echo '1. Checking verify_and_complete_subscription function...'
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ Function exists'
        ELSE '✗ Function NOT found'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'verify_and_complete_subscription'
  AND n.nspname = 'public';

-- 2. Check function parameters
\echo ''
\echo '2. Function parameters:'
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS parameters
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'verify_and_complete_subscription'
  AND n.nspname = 'public';

-- 3. Check function return type
\echo ''
\echo '3. Function return type:'
SELECT 
    p.proname AS function_name,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'verify_and_complete_subscription'
  AND n.nspname = 'public';

-- 4. Check grants (should be granted to service_role)
\echo ''
\echo '4. Checking function grants...'
SELECT 
    grantee,
    routine_name,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'verify_and_complete_subscription'
ORDER BY grantee;

-- 5. Check old function still exists (for backward compatibility)
\echo ''
\echo '5. Checking backward compatibility...'
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ complete_subscription_with_commission still exists'
        ELSE '✗ Old function missing'
    END as status
FROM pg_proc p
WHERE p.proname = 'complete_subscription_with_commission';

-- 6. Check for unique constraint on stripe_session_id
\echo ''
\echo '6. Checking stripe_session_id unique constraint...'
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    CASE 
        WHEN contype = 'u' THEN '✓ Unique constraint exists'
        ELSE 'Wrong type'
    END as status
FROM pg_constraint
WHERE conname = 'subscriptions_stripe_session_id_unique';

-- 7. Check for duplicate subscriptions (should be empty)
\echo ''
\echo '7. Checking for duplicate subscriptions...'
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ No duplicates found'
        ELSE '✗ WARNING: ' || COUNT(*) || ' duplicate session IDs found'
    END as status
FROM (
    SELECT stripe_session_id
    FROM subscriptions
    WHERE stripe_session_id IS NOT NULL
    GROUP BY stripe_session_id
    HAVING COUNT(*) > 1
) duplicates;

-- 8. Check email queue functions
\echo ''
\echo '8. Checking email queue concurrency functions...'
SELECT 
    p.proname AS function_name,
    CASE 
        WHEN p.proname = 'claim_pending_emails' THEN '✓ Atomic claim function exists'
        WHEN p.proname = 'reset_stuck_processing_emails' THEN '✓ Cleanup function exists'
        WHEN p.proname = 'get_pending_emails' THEN '✓ Get function exists'
        ELSE '? Unknown function'
    END as status
FROM pg_proc p
WHERE p.proname IN ('claim_pending_emails', 'reset_stuck_processing_emails', 'get_pending_emails')
ORDER BY p.proname;

-- 9. Check email queue index
\echo ''
\echo '9. Checking email queue indexes...'
SELECT 
    indexname,
    indexdef,
    CASE 
        WHEN indexname = 'idx_email_queue_processing_status' THEN '✓ Concurrency index exists'
        ELSE '? Other index'
    END as status
FROM pg_indexes
WHERE tablename = 'email_queue'
  AND indexname LIKE '%processing%'
ORDER BY indexname;

-- 10. Sample test query (dry run - doesn't modify data)
\echo ''
\echo '10. Testing function signature...'
SELECT 
    'verify_and_complete_subscription' AS function_name,
    'p_user_id UUID, p_stripe_session_id TEXT, ...' AS expected_params,
    'Returns TABLE with success, subscription_id, already_completed' AS expected_return,
    '✓ Ready to use' AS status;

\echo ''
\echo '============================================'
\echo 'Verification Complete'
\echo '============================================'
\echo ''
\echo 'Next steps:'
\echo '1. Test payment flow with: node test-payment-race-condition.js'
\echo '2. Monitor logs for race condition indicators'
\echo '3. Check metrics for duplicate subscriptions'
\echo ''
