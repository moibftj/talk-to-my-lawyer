#!/usr/bin/env node

/**
 * Apply critical migration (atomic allowance deduction)
 * This script executes the SQL directly via Supabase REST API
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Read migration SQL
const migrationSQL = fs.readFileSync(
  './supabase/migrations/20260107000001_atomic_allowance_deduction.sql',
  'utf8'
);

console.log('📋 Migration: atomic_allowance_deduction');
console.log('🔧 Applying via Supabase REST API...\n');

// Split SQL into individual statements and execute
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

async function executeSQL(sql) {
  // Use postgres connection directly
  const { Client } = require('pg');

  // Use direct connection string
  const connectionString = 'postgresql://postgres.kvfzxvizcudjwqyxvqzg:kE2RCNmEcwrWgh8R@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    await client.query(sql);
    console.log('✅ Migration applied successfully!');

    // Verify functions exist
    const { rows } = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN (
        'check_and_deduct_allowance',
        'refund_letter_allowance',
        'increment_total_letters',
        'check_letter_allowance'
      )
      ORDER BY routine_name
    `);

    console.log('\n✅ Functions created:');
    rows.forEach(row => {
      console.log(`   - ${row.routine_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

executeSQL(migrationSQL).catch(console.error);
