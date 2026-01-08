/**
 * API endpoint to create test accounts
 * Call with POST to create all test accounts at once
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Security check - only allow in development or with secret key
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    
    // Simple security - in production, you'd want a better approach
    if (process.env.NODE_ENV === 'production' && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Get service role client for admin operations
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const testAccounts = [
      {
        email: 'test-subscriber@ttml-test.com',
        password: 'TestPass123!',
        role: 'subscriber' as const,
        fullName: 'Test Subscriber'
      },
      {
        email: 'test-employee@ttml-test.com',
        password: 'TestPass123!',
        role: 'employee' as const,
        fullName: 'Test Employee'
      },
      {
        email: 'test-superadmin@ttml-test.com',
        password: 'TestPass123!',
        role: 'admin' as const,
        adminSubRole: 'super_admin' as const,
        fullName: 'Test System Admin'
      },
      {
        email: 'test-attorney@ttml-test.com',
        password: 'TestPass123!',
        role: 'admin' as const,
        adminSubRole: 'attorney_admin' as const,
        fullName: 'Test Attorney Admin'
      }
    ]

    const results = []

    for (const account of testAccounts) {
      // Check if user already exists
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, email, role, admin_sub_role')
        .eq('email', account.email)
        .single()

      if (existingProfile) {
        results.push({
          email: account.email,
          status: 'exists',
          id: existingProfile.id
        })
        continue
      }

      // Create user with Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: {
          full_name: account.fullName,
          role: account.role,
          admin_sub_role: account.adminSubRole
        }
      })

      if (authError) {
        results.push({
          email: account.email,
          status: 'error',
          error: authError.message
        })
        continue
      }

      // Create profile
      const profileData: any = {
        id: authData.user.id,
        email: account.email,
        full_name: account.fullName,
        role: account.role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if ('adminSubRole' in account) {
        profileData.admin_sub_role = account.adminSubRole
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(profileData)

      if (profileError) {
        results.push({
          email: account.email,
          status: 'error',
          error: profileError.message
        })
        continue
      }

      // For employee, create a coupon code
      if (account.role === 'employee') {
        const couponCode = `TEST${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        await supabaseAdmin
          .from('employee_coupons')
          .insert({
            employee_id: authData.user.id,
            code: couponCode,
            discount_percent: 20,
            is_active: true
          })

        results.push({
          email: account.email,
          status: 'created',
          id: authData.user.id,
          couponCode
        })
      } else {
        results.push({
          email: account.email,
          status: 'created',
          id: authData.user.id
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Test accounts processed',
      results,
      credentials: {
        subscriber: {
          email: 'test-subscriber@ttml-test.com',
          password: 'TestPass123!',
          loginUrl: '/auth/login'
        },
        employee: {
          email: 'test-employee@ttml-test.com',
          password: 'TestPass123!',
          loginUrl: '/auth/login'
        },
        superAdmin: {
          email: 'test-superadmin@ttml-test.com',
          password: 'TestPass123!',
          loginUrl: '/secure-admin-gateway/login'
        },
        attorneyAdmin: {
          email: 'test-attorney@ttml-test.com',
          password: 'TestPass123!',
          loginUrl: '/attorney-portal/login'
        }
      }
    })

  } catch (error: any) {
    console.error('Error creating test accounts:', error)
    return NextResponse.json(
      { error: 'Failed to create test accounts', details: error.message },
      { status: 500 }
    )
  }
}

// Also allow GET to check status
export async function GET() {
  return NextResponse.json({
    message: 'Test account creation endpoint',
    usage: 'POST with ?secret=YOUR_CRON_SECRET to create accounts'
  })
}
