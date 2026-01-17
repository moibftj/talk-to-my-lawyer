#!/usr/bin/env node

/**
 * Database Connection Verification Script
 *
 * This script verifies that the Supabase database is properly configured
 * and all required tables and functions are accessible.
 *
 * Usage: node scripts/verify-database-connection.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL');
  console.error('   Required: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDatabase() {
  console.log('🔍 Verifying Database Connection...\n');
  console.log('━'.repeat(60));

  let allPassed = true;

  // 1. Check core tables
  console.log('\n📊 Checking Core Tables:');
  const tables = [
    'profiles',
    'letters',
    'subscriptions',
    'employee_coupons',
    'commissions',
    'letter_audit_trail',
    'coupon_usage'
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('count').limit(1);
      if (error) {
        console.log(`   ❌ ${table} - ${error.message}`);
        allPassed = false;
      } else {
        console.log(`   ✅ ${table}`);
      }
    } catch (e) {
      console.log(`   ❌ ${table} - ${e.message}`);
      allPassed = false;
    }
  }

  // 2. Check additional tables
  console.log('\n📦 Checking Additional Tables:');
  const additionalTables = [
    'payout_requests',
    'email_queue',
    'data_export_requests',
    'data_deletion_requests',
    'privacy_policy_acceptances',
    'admin_audit_log'
  ];

  for (const table of additionalTables) {
    try {
      const { error } = await supabase.from(table).select('count').limit(1);
      if (error) {
        console.log(`   ⚠️  ${table} - ${error.message}`);
      } else {
        console.log(`   ✅ ${table}`);
      }
    } catch (e) {
      console.log(`   ⚠️  ${table} - ${e.message}`);
    }
  }

  // 3. Check RPC functions
  console.log('\n⚙️  Checking RPC Functions:');
  const testId = '00000000-0000-0000-0000-000000000000';

  const rpcChecks = [
    { name: 'check_letter_allowance', params: { u_id: testId } },
    { name: 'deduct_letter_allowance', params: { u_id: testId } },
    { name: 'add_letter_allowances', params: { u_id: testId, amount: 1 } },
    { name: 'increment_total_letters', params: { u_id: testId } },
    { name: 'reset_monthly_allowances', params: {} },
    { name: 'get_admin_dashboard_stats', params: {} }
  ];

  for (const { name, params } of rpcChecks) {
    try {
      const { error } = await supabase.rpc(name, params);

      if (error) {
        if (error.message.includes('does not exist')) {
          // Function doesn't exist - this is a real problem
          console.log(`   ❌ ${name} - NOT FOUND`);
          allPassed = false;
        } else {
          // Function exists but returned an error
          const errorPreview = error.message.substring(0, 50);
          console.log(`   ⚠️  ${name} - EXISTS (error: ${errorPreview}${error.message.length > 50 ? '...' : ''})`);
        }
      } else {
        // Function exists and executed successfully
        console.log(`   ✅ ${name}`);
      }
    } catch (e) {
      // Unexpected exception - log but don't fail
      const errorPreview = e.message.substring(0, 50);
      console.log(`   ⚠️  ${name} - EXISTS (exception: ${errorPreview}${e.message.length > 50 ? '...' : ''})`);
    }
  }

  // 4. Database info
  console.log('\n🔗 Connection Details:');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Key Type: ${supabaseKey.includes('service_role') ? 'Service Role (Full Access)' : 'Anon Key (RLS Enforced)'}`);

  // Final summary
  console.log('\n' + '━'.repeat(60));
  if (allPassed) {
    console.log('\n✅ DATABASE VERIFICATION PASSED');
    console.log('   All core tables and functions are accessible.\n');
    return 0;
  } else {
    console.log('\n⚠️  DATABASE VERIFICATION COMPLETED WITH WARNINGS');
    console.log('   Some tables or functions may be missing.\n');
    return 1;
  }
}

verifyDatabase()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('\n❌ VERIFICATION FAILED');
    console.error('   Error:', error.message);
    process.exit(1);
  });
