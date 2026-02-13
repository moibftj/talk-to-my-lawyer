import { NextRequest } from 'next/server'
import { getAdminCSRFToken } from '@/lib/api/admin-action-handler'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

export async function GET(request: NextRequest) {
  // Apply rate limiting to prevent CSRF token spam
  const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 20, '5 m')
  if (rateLimitResponse) {
    return rateLimitResponse
  }
  
  return getAdminCSRFToken()
}
