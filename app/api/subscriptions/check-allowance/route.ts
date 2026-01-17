import { NextRequest } from "next/server"
import { requireAuth } from '@/lib/auth/authenticate-user'
import { handleApiError, successResponse } from '@/lib/api/api-error-handler'
import { safeApplyRateLimit, apiRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for read-heavy endpoint
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, ...getRateLimitTuple('API_READ'))
    if (rateLimitResponse) return rateLimitResponse
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    const { user, supabase } = await requireAuth()

    // Call check_letter_allowance function
    const { data, error } = await supabase
      .rpc('check_letter_allowance', { u_id: user.id })
      .single<{ has_access: boolean; letters_remaining: number; plan_type: string; is_active: boolean }>()

    if (error) {
      throw error
    }

    return successResponse({
      hasAllowance: data?.has_access,
      remaining: data?.letters_remaining,
      plan: data?.plan_type
    })

  } catch (error) {
    return handleApiError(error, 'Check Allowance')
  }
}
