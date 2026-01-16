/**
 * Standardized error handling for API routes
 * Provides consistent error responses and proper error logging
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { isDevelopment } from '@/lib/config/env'

/**
 * Custom error classes for different error types
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public override message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR')
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details)
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND')
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded') {
    super(429, message, 'RATE_LIMIT_ERROR')
  }
}

export class ExternalServiceError extends ApiError {
  constructor(service: string, message?: string) {
    super(502, message || `External service ${service} unavailable`, 'EXTERNAL_SERVICE_ERROR')
  }
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: string
  code?: string
  details?: unknown
  requestId?: string
  stack?: string // Only in development
}

/**
 * Handle API errors and return appropriate NextResponse
 */
export function handleApiError(
  error: unknown,
  context?: string,
  requestId?: string
): NextResponse {
  const dev = isDevelopment()

  // Log all errors with context and request ID
  const errorContext = context ? `[${context}]` : ''
  const requestContext = requestId ? `[${requestId}]` : ''
  const logPrefix = `${errorContext}${requestContext}`

  if (error instanceof Error) {
    console.error(`${logPrefix} Error:`, {
      name: error.name,
      message: error.message,
      requestId,
      stack: dev ? error.stack : undefined,
    })
  } else {
    console.error(`${logPrefix} Unknown error:`, {error, requestId})
  }

  // Handle known ApiErrors
  if (error instanceof ApiError) {
    const response: ErrorResponse = {
      error: error.message,
      code: error.code,
      requestId,
    }

    if (error.details) {
      response.details = error.details
    }

    if (dev && error.stack) {
      response.stack = error.stack
    }

    return NextResponse.json(response, { status: error.statusCode })
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.issues,
      requestId,
    }

    if (dev) {
      response.stack = error.stack
    }

    return NextResponse.json(response, { status: 400 })
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    error: dev ? (error as Error).message || 'An unexpected error occurred' : 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId,
  }

  if (dev && error instanceof Error && error.stack) {
    response.stack = error.stack
  }

  return NextResponse.json(response, { status: 500 })
}

/**
 * Type-safe async handler wrapper that catches and formats errors
 */
export function withApiHandler<T extends NextResponse>(
  handler: () => Promise<T>,
  context?: string
): Promise<NextResponse> {
  return handler().catch((error) => handleApiError(error, context))
}

/**
 * Wrap a route handler with error handling
 * Use this in API routes to automatically handle errors
 */
export function apiRouteHandler(
  handler: (request: Request, context?: unknown) => Promise<NextResponse>,
  contextName?: string
) {
  return async (request: Request, routeContext?: unknown): Promise<NextResponse> => {
    try {
      return await handler(request, routeContext)
    } catch (error) {
      return handleApiError(error, contextName)
    }
  }
}

/**
 * Success response helper
 */
export function successResponse<T = unknown>(
  data: T,
  status: number = 200
): NextResponse<T> {
  return NextResponse.json(data, { status })
}

/**
 * Common error response helpers
 */
export const errorResponses = {
  unauthorized: (message = 'Unauthorized') =>
    NextResponse.json({ error: message, code: 'UNAUTHORIZED' }, { status: 401 }),

  forbidden: (message = 'Forbidden') =>
    NextResponse.json({ error: message, code: 'FORBIDDEN' }, { status: 403 }),

  notFound: (resource = 'Resource') =>
    NextResponse.json({ error: `${resource} not found`, code: 'NOT_FOUND' }, { status: 404 }),

  validation: (message: string, details?: unknown) =>
    NextResponse.json({ error: message, code: 'VALIDATION_ERROR', details }, { status: 400 }),

  serverError: (message = 'Internal server error') =>
    NextResponse.json({ error: message, code: 'INTERNAL_ERROR' }, { status: 500 }),

  rateLimited: (message = 'Rate limit exceeded') =>
    NextResponse.json({ error: message, code: 'RATE_LIMITED' }, { status: 429 }),
} as const
