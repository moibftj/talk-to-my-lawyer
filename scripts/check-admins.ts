import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.production' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkAdmins() {
  console.log('\n🔍 Checking for admin users in Supabase...\n')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .eq('role', 'admin')

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  if (data && data.length > 0) {
    console.log(`✅ Found ${data.length} admin user(s):\n`)
    data.forEach((admin, index) => {
      console.log(`   ${index + 1}. Email: ${admin.email}`)
      console.log(`      Name: ${admin.full_name || 'N/A'}`)
      console.log(`      ID: ${admin.id}`)
      console.log(`      Created: ${admin.created_at}`)
      console.log('')
    })
  } else {
    console.log('❌ No admin users found in Supabase')
    console.log('\n   To create an admin user, run:')
    console.log('   npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password>')
  }

  // Check for ADMIN_PORTAL_KEY
  console.log('\n🔑 Checking ADMIN_PORTAL_KEY in environment...')
  const portalKey = process.env.ADMIN_PORTAL_KEY

  if (portalKey) {
    console.log(`✅ ADMIN_PORTAL_KEY is set (length: ${portalKey.length})`)
  } else {
    console.log('❌ ADMIN_PORTAL_KEY is NOT set in .env.local')
    console.log('   This is required for admin login at /secure-admin-gateway/login')
  }
}

checkAdmins()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script error:', error)
    process.exit(1)
  })
