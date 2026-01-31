/**
 * QA Test User Creation Script
 * 
 * This script creates all required test users for comprehensive QA testing.
 * Run with: pnpm tsx qa/scripts/create-test-users.ts
 * 
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * - Access to staging/test database
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface TestUser {
  email: string;
  password: string;
  role: 'subscriber' | 'employee' | 'admin';
  adminSubRole?: 'super_admin' | 'attorney_admin';
  fullName: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  remainingLetters?: number;
  specialCondition?: string;
}

const testUsers: TestUser[] = [
  // Standard Role/Plan Combinations
  {
    email: 'test-free@example.com',
    password: 'TestPass123!',
    role: 'subscriber',
    fullName: 'Test Free User',
    subscriptionStatus: undefined,
    specialCondition: 'Free tier - no subscription'
  },
  {
    email: 'test-monthly@example.com',
    password: 'TestPass123!',
    role: 'subscriber',
    fullName: 'Test Monthly User',
    subscriptionPlan: 'monthly_membership',
    subscriptionStatus: 'active',
    specialCondition: '$200/mo membership'
  },
  {
    email: 'test-annual@example.com',
    password: 'TestPass123!',
    role: 'subscriber',
    fullName: 'Test Annual User',
    subscriptionPlan: 'annual',
    subscriptionStatus: 'active',
    remainingLetters: 48,
    specialCondition: '$2,000/year - 48 letters'
  },
  {
    email: 'test-pastdue@example.com',
    password: 'TestPass123!',
    role: 'subscriber',
    fullName: 'Test Past Due User',
    subscriptionPlan: 'monthly_membership',
    subscriptionStatus: 'past_due',
    specialCondition: 'Payment failed state'
  },
  {
    email: 'test-employee@example.com',
    password: 'TestPass123!',
    role: 'employee',
    fullName: 'Test Employee',
    specialCondition: 'Staff member with referral capabilities'
  },
  {
    email: 'test-attorney@example.com',
    password: 'TestPass123!',
    role: 'admin',
    adminSubRole: 'attorney_admin',
    fullName: 'Test Attorney Admin',
    specialCondition: 'Can review/approve letters'
  },
  {
    email: 'test-superadmin@example.com',
    password: 'TestPass123!',
    role: 'admin',
    adminSubRole: 'super_admin',
    fullName: 'Test Super Admin',
    specialCondition: 'Full system access'
  },
  // Special Case Users
  {
    email: 'test-newuser@example.com',
    password: 'TestPass123!',
    role: 'subscriber',
    fullName: 'Test New User',
    specialCondition: 'Fresh signup - should get auto-assigned coupon'
  },
  {
    email: 'test-noletters@example.com',
    password: 'TestPass123!',
    role: 'subscriber',
    fullName: 'Test No Letters User',
    subscriptionPlan: 'monthly_membership',
    subscriptionStatus: 'active',
    specialCondition: '0 letters created'
  },
  {
    email: 'test-multiletters@example.com',
    password: 'TestPass123!',
    role: 'subscriber',
    fullName: 'Test Multi Letters User',
    subscriptionPlan: 'monthly_membership',
    subscriptionStatus: 'active',
    specialCondition: '3+ letters to be created'
  },
  {
    email: 'test-edgecase@example.com',
    password: 'TestPass123!',
    role: 'subscriber',
    fullName: "Test O'Malley-Björk III (Edge Case) 日本語テスト",
    subscriptionPlan: 'monthly_membership',
    subscriptionStatus: 'active',
    specialCondition: 'Long name with special characters'
  }
];

async function createTestUser(user: TestUser): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', user.email)
      .single();

    if (existingUser) {
      console.log(`User ${user.email} already exists, skipping...`);
      return { success: true, userId: existingUser.id };
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    const userId = authData.user.id;

    // Update profile with role and details
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: user.fullName,
        role: user.role,
        admin_sub_role: user.adminSubRole || null
      })
      .eq('id', userId);

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    // Create subscription if needed
    if (user.subscriptionPlan && user.subscriptionStatus) {
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan: user.subscriptionPlan,
          plan_type: user.subscriptionPlan,
          status: user.subscriptionStatus,
          remaining_letters: user.remainingLetters || null,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (subError) {
        console.warn(`Warning: Could not create subscription for ${user.email}: ${subError.message}`);
      }
    }

    return { success: true, userId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('QA Test User Creation Script');
  console.log('='.repeat(60));
  console.log('');

  const results: { email: string; success: boolean; userId?: string; error?: string }[] = [];

  for (const user of testUsers) {
    console.log(`Creating user: ${user.email}...`);
    const result = await createTestUser(user);
    results.push({ email: user.email, ...result });

    if (result.success) {
      console.log(`  ✓ Success (ID: ${result.userId})`);
    } else {
      console.log(`  ✗ Failed: ${result.error}`);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log('');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('');
    console.log('Failed users:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.email}: ${r.error}`);
    });
  }

  console.log('');
  console.log('Test User Credentials Table:');
  console.log('-'.repeat(80));
  console.log('| Email                          | Password      | Role       | Status      |');
  console.log('-'.repeat(80));
  testUsers.forEach(user => {
    const status = results.find(r => r.email === user.email)?.success ? 'Created' : 'Failed';
    console.log(`| ${user.email.padEnd(30)} | ${user.password.padEnd(13)} | ${user.role.padEnd(10)} | ${status.padEnd(11)} |`);
  });
  console.log('-'.repeat(80));
}

main().catch(console.error);
