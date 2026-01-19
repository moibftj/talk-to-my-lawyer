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

async function createAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@talk-to-my-lawyer.com'
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    console.error('❌ Error: ADMIN_PASSWORD must be set')
    process.exit(1)
  }

  console.log('Creating admin user...')

  // Create user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: 'System Administrator',
      role: 'admin'
    }
  })

  if (authError) {
    console.error('Error creating admin auth user:', authError)
    return
  }

  console.log('Admin auth user created:', authData.user.id)

  // Create or update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email: adminEmail,
      full_name: 'System Administrator',
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (profileError) {
    console.error('Error creating admin profile:', profileError)
    return
  }

  console.log('✅ Admin user created successfully!')
  console.log('Email:', adminEmail)
  console.log('User ID:', authData.user.id)
  console.log('Login at: /secure-admin-gateway/login')
}

createAdminUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script error:', error)
    process.exit(1)
  })
