/**
 * Create all test accounts for E2E testing
 * Creates: subscriber, employee, super_admin, attorney_admin
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface TestAccount {
  email: string
  password: string
  role: 'subscriber' | 'employee' | 'admin'
  adminSubRole?: 'super_admin' | 'attorney_admin'
  fullName: string
}

const testPassword = process.env.TEST_ACCOUNT_PASSWORD

if (!testPassword) {
  console.error('❌ Error: TEST_ACCOUNT_PASSWORD must be set')
  process.exit(1)
}

const testAccounts: TestAccount[] = [
  {
    email: 'test-subscriber@ttml-test.com',
    password: testPassword,
    role: 'subscriber',
    fullName: 'Test Subscriber'
  },
  {
    email: 'test-employee@ttml-test.com',
    password: testPassword,
    role: 'employee',
    fullName: 'Test Employee'
  },
  {
    email: 'test-superadmin@ttml-test.com',
    password: testPassword,
    role: 'admin',
    adminSubRole: 'super_admin',
    fullName: 'Test System Admin'
  },
  {
    email: 'test-attorney@ttml-test.com',
    password: testPassword,
    role: 'admin',
    adminSubRole: 'attorney_admin',
    fullName: 'Test Attorney Admin'
  }
]

async function createTestAccount(account: TestAccount) {
  console.log(`\n🔐 Creating test account: ${account.email} (${account.role})`)

  // Check if user already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email, role, admin_sub_role')
    .eq('email', account.email)
    .single()

  if (existingProfile) {
    console.log(`⚠️  Account already exists: ${account.email}`)
    console.log(`   User ID: ${existingProfile.id}`)
    console.log(`   Current role: ${existingProfile.role}`)
    if (existingProfile.admin_sub_role) {
      console.log(`   Current sub-role: ${existingProfile.admin_sub_role}`)
    }
    return existingProfile.id
  }

  // Create user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true, // Auto-confirm since email confirmation is disabled
    user_metadata: {
      full_name: account.fullName,
      role: account.role,
      admin_sub_role: account.adminSubRole
    }
  })

  if (authError) {
    console.error(`❌ Error creating auth user for ${account.email}:`, authError.message)
    return null
  }

  console.log(`✅ Auth user created: ${authData.user.id}`)

  // Create profile
  const profileData: any = {
    id: authData.user.id,
    email: account.email,
    full_name: account.fullName,
    role: account.role,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  if (account.adminSubRole) {
    profileData.admin_sub_role = account.adminSubRole
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profileData)

  if (profileError) {
    console.error(`❌ Error creating profile for ${account.email}:`, profileError)
    return null
  }

  console.log(`✅ Profile created successfully!`)

  // For employee, create a coupon code
  if (account.role === 'employee') {
    const couponCode = `TEST${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    const { error: couponError } = await supabase
      .from('employee_coupons')
      .insert({
        employee_id: authData.user.id,
        code: couponCode,
        discount_percent: 20,
        is_active: true
      })

    if (couponError) {
      console.error(`⚠️  Error creating coupon for employee:`, couponError)
    } else {
      console.log(`✅ Coupon code created: ${couponCode}`)
    }
  }

  return authData.user.id
}

async function createAllTestAccounts() {
  console.log('\n🚀 Creating all test accounts for E2E testing...\n')

  const results: Record<string, string | null> = {}

  for (const account of testAccounts) {
    const userId = await createTestAccount(account)
    results[account.role + (account.adminSubRole ? `_${account.adminSubRole}` : '')] = userId
  }

  console.log('\n\n📋 TEST ACCOUNTS SUMMARY')
  console.log('═══════════════════════════════════════════════════════\n')

  for (const account of testAccounts) {
    const loginUrl = account.role === 'admin'
      ? account.adminSubRole === 'attorney_admin'
        ? '/attorney-portal/login'
        : '/secure-admin-gateway/login'
      : '/auth/login'

    console.log(`${account.role.toUpperCase()}${account.adminSubRole ? ` (${account.adminSubRole})` : ''}:`)
    console.log(`  Email:    ${account.email}`)
    console.log(`  Password: ${account.password}`)
    console.log(`  Login:    ${loginUrl}`)
    console.log('')
  }

  console.log('═══════════════════════════════════════════════════════\n')
}

createAllTestAccounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script error:', error)
    process.exit(1)
  })
