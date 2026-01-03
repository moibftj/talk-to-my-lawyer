/**
 * Create an admin user with optional sub-role specification
 * Usage: npx tsx scripts/create-additional-admin.ts <email> <password> [--role=super|attorney]
 *
 * Examples:
 *   npx tsx scripts/create-additional-admin.ts john@company.com SecurePass123!
 *   npx tsx scripts/create-additional-admin.ts attorney@company.com SecurePass123! --role=attorney
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

// Parse command line arguments
const email = process.argv[2]
const password = process.argv[3]
const roleArg = process.argv.find(arg => arg.startsWith('--role='))

// Determine admin sub-role
let adminSubRole: 'super_admin' | 'attorney_admin' = 'super_admin'
if (roleArg) {
  const roleValue = roleArg.split('=')[1]?.toLowerCase()
  if (roleValue === 'attorney') {
    adminSubRole = 'attorney_admin'
  } else if (roleValue === 'system') {
    adminSubRole = 'super_admin'
  } else {
    console.error('❌ Error: --role must be either "super" or "attorney"')
    console.error('   Example: --role=attorney')
    process.exit(1)
  }
}

if (!email || !password) {
  console.error('❌ Usage: npx tsx scripts/create-additional-admin.ts <email> <password> [--role=super|attorney]')
  console.error('   Example: npx tsx scripts/create-additional-admin.ts john@company.com SecurePass123!')
  console.error('   Example: npx tsx scripts/create-additional-admin.ts attorney@company.com SecurePass123! --role=attorney')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  console.log(`\n🔐 Creating admin user: ${email}`)
  console.log(`   Sub-role: ${adminSubRole === 'super_admin' ? 'Super Admin (full access)' : 'Attorney Admin (letter review only)'}`)

  // Check if user already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email, role, admin_sub_role')
    .eq('email', email)
    .single()

  if (existingProfile) {
    if (existingProfile.role === 'admin') {
      console.log('⚠️  User already exists and is already an admin!')
      console.log(`   User ID: ${existingProfile.id}`)
      console.log(`   Current sub-role: ${existingProfile.admin_sub_role || 'super_admin'}`)

      // Update sub-role if different
      if (existingProfile.admin_sub_role !== adminSubRole) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ admin_sub_role: adminSubRole, updated_at: new Date().toISOString() })
          .eq('email', email)

        if (updateError) {
          console.error('❌ Error updating admin sub-role:', updateError)
          return
        }

        console.log(`✅ Admin sub-role updated to: ${adminSubRole}`)
      }
      return
    } else {
      // Update existing user to admin role
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: 'admin',
          admin_sub_role: adminSubRole,
          updated_at: new Date().toISOString()
        })
        .eq('email', email)

      if (updateError) {
        console.error('❌ Error updating user role:', updateError)
        return
      }

      console.log('✅ Existing user promoted to admin!')
      console.log(`   User ID: ${existingProfile.id}`)
      console.log(`   Email: ${email}`)
      console.log(`   Sub-role: ${adminSubRole}`)
      console.log(`\n   Login URL: ${adminSubRole === 'attorney_admin' ? '/attorney-portal/login' : '/secure-admin-gateway/login'}`)
      return
    }
  }

  // Create user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: email.split('@')[0], // Use part of email as default name
      role: 'admin',
      admin_sub_role: adminSubRole
    }
  })

  if (authError) {
    console.error('❌ Error creating auth user:', authError.message)
    return
  }

  console.log('✅ Auth user created:', authData.user.id)

  // Create or update profile with admin role and sub-role
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email,
      full_name: email.split('@')[0],
      role: 'admin',
      admin_sub_role: adminSubRole,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (profileError) {
    console.error('❌ Error creating admin profile:', profileError)
    return
  }

  console.log('\n✅ Admin user created successfully!')
  console.log('   Email:', email)
  console.log('   User ID:', authData.user.id)
  console.log('   Role: admin')
  console.log('   Sub-role:', adminSubRole)
  console.log(`\n   Login URL: ${adminSubRole === 'attorney_admin' ? '/attorney-portal/login' : '/secure-admin-gateway/login'}`)

  if (adminSubRole === 'super_admin') {
    console.log('\n   🔧 Super Admin has access to:')
    console.log('      - Analytics Dashboard')
    console.log('      - User Management')
    console.log('      - Coupon Management')
    console.log('      - Commission Payouts')
    console.log('      - Email Queue')
    console.log('      - Letter Review Center')
  } else {
    console.log('\n   ⚖️  Attorney Admin has access to:')
    console.log('      - Letter Review Center only')
  }
}

createAdminUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script error:', error)
    process.exit(1)
  })
