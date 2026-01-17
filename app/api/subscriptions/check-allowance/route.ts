import { NextRequest } from "next/server"
import { requireAuth } from '@/lib/auth/authenticate-user'
import { handleApiError, successResponse } from '@/lib/api/api-error-handler'
import { safeApplyRateLimit, apiRateLimit } from '@/lib/rate-limit-redis'
import { getRateLimitTuple } from '@/lib/config'
import { checkLetterAllowance } from '@/lib/services/allowance-service'

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for read-heavy endpoint
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, ...getRateLimitTuple('API_READ'))
    if (rateLimitResponse) return rateLimitResponse
    const { user } = await requireAuth()
    const allowance = await checkLetterAllowance(user.id)

    return successResponse({
      hasAllowance: allowance.has_allowance,
      remaining: allowance.remaining,
    })

  } catch (error) {
    return handleApiError(error, 'Check Allowance')
  }
}
