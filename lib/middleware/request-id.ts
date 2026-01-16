/**
 * Request ID generation and middleware
 *
 * Provides unique request IDs for log correlation and debugging
 */

import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export const REQUEST_ID_HEADER = 'x-request-id'

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return nanoid(16)
}

/**
 * Get or generate request ID from request
 */
export function getRequestId(request: NextRequest): string {
  const existingId = request.headers.get(REQUEST_ID_HEADER)
  return existingId || generateRequestId()
}

/**
 * Add request ID to response headers
 */
export function addRequestIdToResponse(
  response: NextResponse,
  requestId: string
): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId)
  return response
}

/**
 * Middleware wrapper that adds request ID to all responses
 */
export function withRequestId(
  handler: (request: NextRequest, requestId: string) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = getRequestId(request)
    const response = await handler(request, requestId)
    return addRequestIdToResponse(response, requestId)
  }
}

/**
 * Create a logger with request context
 */
export function createRequestLogger(requestId: string, context: string) {
  const prefix = `[${context}][${requestId}]`

  return {
    info: (message: string, data?: unknown) => {
      console.log(`${prefix} ${message}`, data ? JSON.stringify(data) : '')
    },
    warn: (message: string, data?: unknown) => {
      console.warn(`${prefix} ${message}`, data ? JSON.stringify(data) : '')
    },
    error: (message: string, error?: unknown) => {
      if (error instanceof Error) {
        console.error(`${prefix} ${message}`, {
          error: error.message,
          stack: error.stack,
          requestId,
        })
      } else {
        console.error(`${prefix} ${message}`, error)
      }
    },
    debug: (message: string, data?: unknown) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`${prefix} ${message}`, data ? JSON.stringify(data) : '')
      }
    },
  }
}
