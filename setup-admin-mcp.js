#!/usr/bin/env node
/**
 * Admin Account Setup via MCP
 * Creates admin account with specified credentials
 */

const { createClient } = require('@supabase/supabase-js');

// Credentials
const ADMIN_EMAIL = 'admin@talk-to-my-lawyer.com';
const ADMIN_PASSWORD = 'D3GmgknFj8CPa5A';
const ADMIN_NAME = 'System Administrator';
const ADMIN_SUB_ROLE = 'super_admin';

// Supabase config from env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nomiiqzxaxyxnxndvkbe.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupAdmin() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         Admin Account Setup (MCP)                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Step 1: Check for existing user
    console.log('📋 Step 1: Checking for existing account...');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) throw listError;
    
    const existingUser = users.find(u => u.email === ADMIN_EMAIL);
    let userId;
    
    if (existingUser) {
      console.log(`   ✅ User found: ${existingUser.id}`);
      userId = existingUser.id;
      
      // Update password
      console.log('\n🔑 Step 2: Updating password...');
      const { error: pwdError } = await supabase.auth.admin.updateUserById(userId, {
        password: ADMIN_PASSWORD
      });
      
      if (pwdError) throw pwdError;
      console.log('   ✅ Password updated');
      
    } else {
      // Create new user
      console.log('\n✨ Step 2: Creating new auth user...');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: ADMIN_NAME,
          role: 'admin'
        }
      });
      
      if (authError) throw authError;
      userId = authData.user.id;
      console.log(`   ✅ Auth user created: ${userId}`);
    }
    
    // Step 3: Ensure profile exists with correct role
    console.log('\n👤 Step 3: Setting up profile...');
    
    // Try to get existing profile
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (existingProfile) {
      // Update existing profile
      console.log('   📝 Updating existing profile...');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: 'admin',
          admin_sub_role: ADMIN_SUB_ROLE,
          full_name: ADMIN_NAME,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (updateError) throw updateError;
      console.log('   ✅ Profile updated with super_admin role');
      
    } else {
      // Create new profile
      console.log('   📝 Creating new profile...');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: ADMIN_EMAIL,
          full_name: ADMIN_NAME,
          role: 'admin',
          admin_sub_role: ADMIN_SUB_ROLE,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (insertError) throw insertError;
      console.log('   ✅ Profile created with super_admin role');
    }
    
    // Step 4: Verify setup
    console.log('\n🔍 Step 4: Verifying setup...');
    const { data: finalProfile, error: verifyError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (verifyError) {
      console.log('   ⚠️  Could not verify profile (database cache issue)');
      console.log('   Profile should exist, try logging in');
    } else {
      console.log('   ✅ Verification successful:');
      console.log(`      - Email: ${finalProfile.email}`);
      console.log(`      - Name: ${finalProfile.full_name}`);
      console.log(`      - Role: ${finalProfile.role}`);
      console.log(`      - Sub-role: ${finalProfile.admin_sub_role || 'NOT SET'}`);
    }
    
    // Success summary
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                   ✅ SETUP COMPLETE!                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 LOGIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email:       ${ADMIN_EMAIL}`);
    console.log(`🔑 Password:    ${ADMIN_PASSWORD}`);
    console.log(`🔐 Portal Key:  ${process.env.ADMIN_PORTAL_KEY || 'APK_...'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🌐 Login at: /secure-admin-gateway/login');
    console.log('');
    console.log('📝 3-FACTOR LOGIN:');
    console.log('   1. Enter Portal Key');
    console.log('   2. Enter Email');
    console.log('   3. Enter Password');
    console.log('');
    console.log('🚀 You can login immediately!\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.details) console.error('   Details:', error.details);
    if (error.hint) console.error('   Hint:', error.hint);
    if (error.code) console.error('   Code:', error.code);
    console.log('');
    process.exit(1);
  }
}

// Execute
setupAdmin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });
