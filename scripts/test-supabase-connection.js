#!/usr/bin/env node
/**
 * Execute SQL directly against Supabase using the REST API
 * This uses the service role key for full access
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseHost = new URL(SUPABASE_URL).hostname;

// SQL to execute - Employee coupon fix migration
const sql = `
-- Fix employee coupon auto-generation system
-- Step 1: Add unique constraint on employee_id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_coupons_employee_id_key'
  ) THEN
    ALTER TABLE employee_coupons ADD CONSTRAINT employee_coupons_employee_id_key UNIQUE (employee_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Step 2: Create coupons for existing employees who don't have one
INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
SELECT 
  p.id,
  'EMP-' || UPPER(SUBSTR(MD5(p.id::TEXT || RANDOM()::TEXT || NOW()::TEXT), 1, 6)),
  20,
  true
FROM profiles p
WHERE p.role = 'employee'
  AND NOT EXISTS (
    SELECT 1 FROM employee_coupons ec WHERE ec.employee_id = p.id
  )
ON CONFLICT (employee_id) DO NOTHING;

-- Step 3: Update the trigger function
CREATE OR REPLACE FUNCTION create_employee_coupon()
RETURNS TRIGGER AS $$
DECLARE
  coupon_code TEXT;
  attempts INT := 0;
  max_attempts INT := 5;
BEGIN
  IF NEW.role = 'employee' THEN
    IF EXISTS (SELECT 1 FROM employee_coupons WHERE employee_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    LOOP
      coupon_code := 'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT || NOW()::TEXT || attempts::TEXT), 1, 6));
      
      BEGIN
        INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
        VALUES (NEW.id, coupon_code, 20, true);
        EXIT;
      EXCEPTION 
        WHEN unique_violation THEN
          attempts := attempts + 1;
          IF attempts >= max_attempts THEN
            EXIT;
          END IF;
        WHEN OTHERS THEN
          EXIT;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 4: Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_create_employee_coupon ON profiles;
CREATE TRIGGER trigger_create_employee_coupon
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_employee_coupon();

-- Step 5: Handle role updates
CREATE OR REPLACE FUNCTION handle_employee_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'employee' AND (OLD.role IS NULL OR OLD.role != 'employee') THEN
    IF NOT EXISTS (SELECT 1 FROM employee_coupons WHERE employee_id = NEW.id) THEN
      INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
      VALUES (
        NEW.id,
        'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT || NOW()::TEXT), 1, 6)),
        20,
        true
      )
      ON CONFLICT (employee_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_handle_employee_role_change ON profiles;
CREATE TRIGGER trigger_handle_employee_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_employee_role_change();
`;

function executeSQL(query) {
  return new Promise((resolve, reject) => {
    const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);
    
    // First, let's try using the PostgREST endpoint directly
    const options = {
      hostname: supabaseHost,
      port: 443,
      path: '/rest/v1/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      }
    };

    console.log('Connecting to Supabase...');
    
    // Since we can't use RPC directly, let's just verify connection
    const testOptions = {
      hostname: supabaseHost,
      port: 443,
      path: '/rest/v1/profiles?select=count&limit=1',
      method: 'GET',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      }
    };

    const req = https.request(testOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Connection test status:', res.statusCode);
        if (res.statusCode === 200) {
          console.log('✅ Successfully connected to Supabase!');
          console.log('\n📋 To apply the migration, please:');
          console.log('1. Go to: https://supabase.com/dashboard/project/nomiiqzxaxyxnxndvkbe/sql');
          console.log('2. Copy the SQL from scripts/023_fix_employee_coupons.sql');
          console.log('3. Paste and run in the SQL Editor\n');
          resolve(data);
        } else {
          reject(new Error(`Connection failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

executeSQL(sql)
  .then(() => console.log('Done!'))
  .catch(err => console.error('Error:', err.message));
