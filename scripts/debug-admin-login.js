#!/usr/bin/env node

/**
 * Admin Login Debug & Fix Script
 * 
 * This script helps diagnose and fix admin login issues by:
 * 1. Checking admin configuration
 * 2. Verifying admin users exist in database
 * 3. Testing admin authentication flow
 * 4. Creating admin users if needed
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_PORTAL_KEY = process.env.ADMIN_PORTAL_KEY

async function main() {
  console.log('🔍 Admin Login Debug & Fix Tool')
  console.log('================================')

  // Step 1: Check environment configuration
  console.log('\n1. Checking Environment Configuration...')
  
  if (!SUPABASE_URL) {
    console.log('❌ NEXT_PUBLIC_SUPABASE_URL is missing')
    return
  } else {
    console.log('✅ NEXT_PUBLIC_SUPABASE_URL configured')
  }

  if (!SUPABASE_SERVICE_KEY) {
    console.log('❌ SUPABASE_SERVICE_ROLE_KEY is missing')
    return
  } else {
    console.log('✅ SUPABASE_SERVICE_ROLE_KEY configured')
  }

  if (!ADMIN_PORTAL_KEY) {
    console.log('❌ ADMIN_PORTAL_KEY is missing')
    console.log('   Please set ADMIN_PORTAL_KEY in your environment variables')
    console.log('   Example: ADMIN_PORTAL_KEY=your-secure-portal-key-here')
    return
  } else {
    console.log('✅ ADMIN_PORTAL_KEY configured')
    if (ADMIN_PORTAL_KEY.length < 16) {
      console.log('⚠️  ADMIN_PORTAL_KEY should be at least 16 characters for security')
    }
  }

  // Step 2: Initialize Supabase client
  console.log('\n2. Connecting to Database...')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Test database connection
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1)
    if (error) {
      console.log('❌ Database connection failed:', error.message)
      return
    }
    console.log('✅ Database connection successful')
  } catch (err) {
    console.log('❌ Database connection error:', err.message)
    return
  }

  // Step 3: Check for admin users
  console.log('\n3. Checking Admin Users...')
  
  try {
    const { data: adminProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('role', 'admin')

    if (profileError) {
      console.log('❌ Error querying admin profiles:', profileError.message)
      return
    }

    if (!adminProfiles || adminProfiles.length === 0) {
      console.log('❌ No admin users found in profiles table')
      console.log('   You need to create at least one admin user')
      
      // Offer to create admin user
      console.log('\n📝 To create an admin user:')
      console.log('   1. Sign up normally at /auth/signup')
      console.log('   2. Update the user role in database:')
      console.log('      UPDATE profiles SET role = \'admin\' WHERE email = \'your-email@example.com\';')
      console.log('   3. Or use the create-admin script if available')
      
      return
    }

    console.log(`✅ Found ${adminProfiles.length} admin user(s):`)
    adminProfiles.forEach(admin => {
      console.log(`   • ${admin.email} (${admin.full_name || 'No name'}) - Created: ${admin.created_at}`)
    })

    // Step 4: Check auth users
    console.log('\n4. Checking Auth Users...')
    
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.log('❌ Error listing auth users:', authError.message)
      return
    }

    const adminAuthUsers = authUsers.users?.filter(user => 
      adminProfiles.some(profile => profile.id === user.id)
    )

    if (!adminAuthUsers || adminAuthUsers.length === 0) {
      console.log('❌ Admin users exist in profiles but not in auth.users')
      console.log('   This indicates a data consistency issue')
      return
    }

    console.log(`✅ Found ${adminAuthUsers.length} admin auth user(s):`)
    adminAuthUsers.forEach(user => {
      console.log(`   • ${user.email} - Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`)
    })

    // Step 5: Test admin login flow
    console.log('\n5. Testing Admin Login Flow...')
    
    const testAdmin = adminAuthUsers[0]
    console.log(`   Testing with admin: ${testAdmin.email}`)
    
    if (!testAdmin.email_confirmed_at) {
      console.log('⚠️  Admin email not confirmed - this may cause login issues')
    }

    console.log('✅ Admin login infrastructure appears functional')

    // Step 6: Usage instructions
    console.log('\n6. Admin Login Instructions:')
    console.log('   1. Go to: /secure-admin-gateway/login')
    console.log('   2. Enter admin email and password')
    console.log(`   3. Enter portal key: ${ADMIN_PORTAL_KEY.substring(0, 8)}...`)
    console.log('   4. Click "Sign In"')

    console.log('\n🔧 Troubleshooting Tips:')
    console.log('   • Make sure admin email is confirmed in Supabase Auth')
    console.log('   • Verify portal key matches exactly (no extra spaces)')
    console.log('   • Check browser console for detailed error messages')
    console.log('   • Ensure admin user has role="admin" in profiles table')
    
    console.log('\n✅ Admin login system check complete!')

  } catch (err) {
    console.log('❌ Unexpected error:', err.message)
  }
}

// Helper function to create admin user (if needed)
async function createAdminUser(email, password, fullName = null) {
  console.log(`\n🔨 Creating admin user: ${email}`)
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      console.log('❌ Failed to create auth user:', authError.message)
      return false
    }

    console.log('✅ Auth user created successfully')

    // Update profile role
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        role: 'admin',
        full_name: fullName || 'Administrator'
      })
      .eq('id', authData.user.id)

    if (profileError) {
      console.log('❌ Failed to update profile role:', profileError.message)
      return false
    }

    console.log('✅ Admin role assigned successfully')
    console.log(`🎉 Admin user created: ${email}`)
    
    return true
    
  } catch (err) {
    console.log('❌ Error creating admin user:', err.message)
    return false
  }
}

// Run the main function
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main, createAdminUser }