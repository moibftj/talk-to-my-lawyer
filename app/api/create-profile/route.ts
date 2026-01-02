import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { createRateLimit } from "@/lib/rate-limit"
import { sendTemplateEmail } from "@/lib/email"

// Rate limiting for profile creation
const rateLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per window
  message: "Too many profile creation attempts. Please try again later.",
})

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimiter(request)
    if (rateLimitResult instanceof Response) {
      return rateLimitResult // Rate limit exceeded
    }

    // Verify user is authenticated
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[CreateProfile] Authentication error:', authError)
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse and validate input
    const body = await request.json()
    const { email, role, fullName } = body

    // Ensure the userId from the request matches the authenticated user
    if (body.userId && body.userId !== user.id) {
      console.error('[CreateProfile] User ID mismatch:', {
        requestUserId: body.userId,
        authenticatedUserId: user.id
      })
      return NextResponse.json(
        { error: "Unauthorized: Cannot create profile for another user" },
        { status: 403 }
      )
    }

    // Validate required fields
    if (!email || !fullName) {
      return NextResponse.json(
        { error: "Missing required fields: email, fullName" },
        { status: 400 }
      )
    }

    const requestedRole = role || 'subscriber'

    // Prevent role escalation from client requests
    if (requestedRole !== 'subscriber') {
      return NextResponse.json(
        { error: "Only subscriber profiles can be created via this endpoint" },
        { status: 403 }
      )
    }

    // Use service role client for profile creation (elevated permissions)
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profileData, error: profileError } = await serviceClient
      .from('profiles')
      .upsert({
        id: user.id,
        email: email.toLowerCase().trim(),
        role: requestedRole,
        full_name: fullName.trim()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (profileError) {
      console.error('[CreateProfile] Profile creation error:', profileError)
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 }
      )
    }

    // Note: Employee coupon is created automatically by the database trigger
    // (trigger_create_employee_coupon) when profile with role='employee' is inserted.
    // We verify it was created successfully here.
    if (role === 'employee') {
      // Wait a moment for trigger to complete, then verify coupon exists
      const { data: couponData, error: couponCheckError } = await serviceClient
        .from('employee_coupons')
        .select('code')
        .eq('employee_id', user.id)
        .single()

      if (couponCheckError || !couponData) {
        // Trigger may have failed - create coupon manually as fallback
        console.warn('[CreateProfile] Coupon not found after trigger, creating manually...')
        const couponCode = `EMP-${user.id.slice(0, 6).toUpperCase()}${Math.random().toString(36).substring(2, 4).toUpperCase()}`
        const { error: couponInsertError } = await serviceClient
          .from('employee_coupons')
          .insert({
            employee_id: user.id,
            code: couponCode,
            discount_percent: 20,
            is_active: true
          })
        
        if (couponInsertError) {
          console.error('[CreateProfile] Fallback coupon creation failed:', couponInsertError)
        } else {
          console.log('[CreateProfile] Fallback coupon created:', couponCode)
        }
      } else {
        console.log('[CreateProfile] Employee coupon verified:', couponData.code)
      }
    }

    console.log('[CreateProfile] Profile created successfully', {
      userId: user.id,
      email,
      role
    })

    // Send welcome email asynchronously (fire and forget)
    sendTemplateEmail(
      'welcome',
      email,
      {
        userName: fullName.split(' ')[0], // First name
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://talk-to-my-lawyer.com'}/dashboard`
      }
    ).catch((error) => {
      console.error('[CreateProfile] Failed to send welcome email:', error)
      // Don't fail the request if email fails
    })

    return NextResponse.json({
      success: true,
      profile: profileData,
      message: "Profile created successfully"
    })

  } catch (error: any) {
    console.error('[CreateProfile] Unexpected error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
