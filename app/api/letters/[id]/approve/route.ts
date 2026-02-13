/**
 * Letter approval endpoint
 * POST /api/letters/[id]/approve
 *
 * Uses consolidated admin action handler to reduce duplication
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminCSRFToken, handleAdminLetterAction } from '@/lib/api/admin-action-handler'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

// GET endpoint to provide CSRF token
export async function GET(
  request: NextRequest,
  _params: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting to prevent CSRF token spam
  const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 20, '5 m')
  if (rateLimitResponse) {
    return rateLimitResponse
  }
  
  return getAdminCSRFToken()
}

// POST endpoint to approve a letter
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return handleAdminLetterAction(request, { id }, 'approve')
}
