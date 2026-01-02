#!/usr/bin/env tsx
/**
 * CLI script for managing admin accounts
 *
 * Role-based admin system - no shared secrets required.
 *
 * Usage:
 *   npx tsx scripts/manage-admin.ts create admin@example.com password123 "John Doe"
 *   npx tsx scripts/manage-admin.ts list
 *   npx tsx scripts/manage-admin.ts deactivate admin@example.com
 *   npx tsx scripts/manage-admin.ts reactivate admin@example.com
 *   npx tsx scripts/manage-admin.ts update-password admin@example.com newpass123
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Commands
const command = process.argv[2]
const args = process.argv.slice(3)

async function createAdmin(email: string, password: string, fullName?: string) {
  console.log(`\n🔐 Creating admin account: ${email}`)

  // Validate password
  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters')
    process.exit(1)
  }

  try {
    // Check if user already exists
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const existingUser = users.find(u => u.email === email)

    if (existingUser) {
      // Promote existing user to admin
      console.log(`  📋 User already exists, promoting to admin...`)

      const { error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', existingUser.id)

      if (error) throw error

      console.log(`  ✅ User promoted to admin successfully`)
      console.log(`  📧 Email: ${email}`)
      console.log(`  🆔 User ID: ${existingUser.id}`)
      return
    }

    // Create new auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split('@')[0],
        role: 'admin'
      }
    })

    if (authError) throw authError

    // Create profile with admin role
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName || email.split('@')[0],
        role: 'admin',
        updated_at: new Date().toISOString()
      })

    if (profileError) throw profileError

    console.log(`  ✅ Admin account created successfully`)
    console.log(`  📧 Email: ${email}`)
    console.log(`  👤 Name: ${fullName || email.split('@')[0]}`)
    console.log(`  🆔 User ID: ${authData.user.id}`)

  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`)
    process.exit(1)
  }
}

async function listAdmins() {
  console.log(`\n👥 Admin Accounts:\n`)

  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at, last_sign_in_at')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error fetching admins:', error)
    process.exit(1)
  }

  if (!admins || admins.length === 0) {
    console.log('  ⚠️  No admin accounts found')
    return
  }

  console.log(`  Total: ${admins.length} admin(s)\n`)

  admins.forEach((admin, index) => {
    console.log(`  ${index + 1}. ${admin.full_name || admin.email}`)
    console.log(`     📧 ${admin.email}`)
    console.log(`     🆔 ${admin.id}`)
    console.log(`     📅 Created: ${new Date(admin.created_at).toLocaleDateString()}`)
    if (admin.last_sign_in_at) {
      console.log(`     🕐 Last login: ${new Date(admin.last_sign_in_at).toLocaleString()}`)
    }
    console.log('')
  })
}

async function deactivateAdmin(email: string) {
  console.log(`\n🔓 Deactivating admin: ${email}`)

  try {
    // Find user
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users.find(u => u.email === email)

    if (!user) {
      console.error(`  ❌ User not found: ${email}`)
      process.exit(1)
    }

    // Check current role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile) {
      console.error(`  ❌ Profile not found for user`)
      process.exit(1)
    }

    if (profile.role !== 'admin') {
      console.error(`  ❌ User is not currently an admin`)
      process.exit(1)
    }

    // Check if this is the last admin
    const { data: allAdmins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    if (allAdmins && allAdmins.length <= 1) {
      console.error(`  ❌ Cannot deactivate the last admin account`)
      console.error(`     Please create another admin first.`)
      process.exit(1)
    }

    // Change role to subscriber
    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'subscriber',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (error) throw error

    console.log(`  ✅ Admin "${profile.full_name || email}" has been deactivated`)
    console.log(`     Their role is now 'subscriber' (regular user)`)

  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`)
    process.exit(1)
  }
}

async function reactivateAdmin(email: string) {
  console.log(`\n🔐 Reactivating admin: ${email}`)

  try {
    // Find user
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users.find(u => u.email === email)

    if (!user) {
      console.error(`  ❌ User not found: ${email}`)
      process.exit(1)
    }

    // Change role to admin
    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (error) throw error

    console.log(`  ✅ User has been promoted back to admin`)

  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`)
    process.exit(1)
  }
}

async function updatePassword(email: string, newPassword: string) {
  console.log(`\n🔑 Updating password for: ${email}`)

  if (newPassword.length < 8) {
    console.error('  ❌ Password must be at least 8 characters')
    process.exit(1)
  }

  try {
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const user = users.find(u => u.email === email)

    if (!user) {
      console.error(`  ❌ User not found: ${email}`)
      process.exit(1)
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    })

    if (error) throw error

    console.log(`  ✅ Password updated successfully`)

  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`)
    process.exit(1)
  }
}

async function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           Admin Account Management CLI                          ║
╚═══════════════════════════════════════════════════════════════╝

Usage: npx tsx scripts/manage-admin.ts <command> [arguments...]

Commands:

  create <email> <password> [name]
      Create a new admin account or promote existing user to admin

  list
      List all admin accounts

  deactivate <email>
      Deactivate an admin account (changes role to subscriber)

  reactivate <email>
      Reactivate a deactivated admin (changes role back to admin)

  update-password <email> <new-password>
      Update an admin's password

Examples:

  npx tsx scripts/manage-admin.ts create admin@company.com SecurePass123! "John Doe"
  npx tsx scripts/manage-admin.ts list
  npx tsx scripts/manage-admin.ts deactivate admin@company.com
  npx tsx scripts/manage-admin.ts reactivate admin@company.com
  npx tsx scripts/manage-admin.ts update-password admin@company.com newpass123

Security Notes:

  • No shared secret required - each admin has their own account
  • Admin access is determined by the 'role' field in the profiles table
  • Deactivating an admin changes their role to 'subscriber'
  • You cannot deactivate the last admin (prevents lockout)

`)
}

// Execute command
switch (command) {
  case 'create':
    if (args.length < 2) {
      console.error('❌ Usage: create <email> <password> [name]')
      process.exit(1)
    }
    await createAdmin(args[0], args[1], args[2])
    break

  case 'list':
    await listAdmins()
    break

  case 'deactivate':
    if (args.length < 1) {
      console.error('❌ Usage: deactivate <email>')
      process.exit(1)
    }
    await deactivateAdmin(args[0])
    break

  case 'reactivate':
    if (args.length < 1) {
      console.error('❌ Usage: reactivate <email>')
      process.exit(1)
    }
    await reactivateAdmin(args[0])
    break

  case 'update-password':
    if (args.length < 2) {
      console.error('❌ Usage: update-password <email> <new-password>')
      process.exit(1)
    }
    await updatePassword(args[0], args[1])
    break

  default:
    await showHelp()
    process.exit(command ? 1 : 0)
}
