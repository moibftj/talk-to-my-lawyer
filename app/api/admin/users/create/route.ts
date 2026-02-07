import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdminAuth } from '@/lib/auth/admin-session'
import { validateAdminRequest } from '@/lib/security/csrf'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { handleCSRFTokenRequest } from '@/lib/admin/letter-actions'
import { errorResponses, successResponse, handleApiError } from '@/lib/api/api-error-handler'

export const runtime = 'nodejs'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_SUB_ROLES = ['super_admin', 'attorney_admin'] as const

export async function GET() {
  return handleCSRFTokenRequest()
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, ...getRateLimitTuple('ADMIN_WRITE'))
    if (rateLimitResponse) return rateLimitResponse

    const authError = await requireSuperAdminAuth()
    if (authError) return authError

    const csrfResult = await validateAdminRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json(
        { error: 'CSRF validation failed', details: csrfResult.error },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password, fullName, adminSubRole } = body

    if (!email || !EMAIL_REGEX.test(email)) {
      return errorResponses.validation('A valid email address is required')
    }

    if (!password || password.length < 8) {
      return errorResponses.validation('Password must be at least 8 characters')
    }

    if (!fullName || fullName.trim().length === 0) {
      return errorResponses.validation('Full name is required')
    }

    if (!adminSubRole || !VALID_SUB_ROLES.includes(adminSubRole)) {
      return errorResponses.validation('admin_sub_role must be "super_admin" or "attorney_admin"')
    }

    const supabase = getServiceRoleClient()

    const { data: authData, error: authError2 } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError2) {
      console.error('[CreateAdminUser] Auth creation error:', authError2)
      if (authError2.message?.includes('already been registered') || authError2.message?.includes('already exists')) {
        return errorResponses.validation('A user with this email already exists')
      }
      return errorResponses.serverError('Failed to create user account')
    }

    if (!authData.user) {
      return errorResponses.serverError('Failed to create user account')
    }

    const { error: profileError } = await (supabase as any)
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email,
        role: 'admin',
        admin_sub_role: adminSubRole,
        full_name: fullName.trim(),
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('[CreateAdminUser] Profile update error:', profileError)
      return errorResponses.serverError('User created but failed to set admin role')
    }

    console.log('[CreateAdminUser] Admin account created:', {
      userId: authData.user.id,
      email,
      adminSubRole,
      timestamp: new Date().toISOString(),
    })

    return successResponse({
      message: `Admin account created successfully`,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: fullName.trim(),
        admin_sub_role: adminSubRole,
      },
    })
  } catch (error) {
    return handleApiError(error, 'CreateAdminUser')
  }
}
