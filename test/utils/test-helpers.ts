/**
 * Test helper utilities
 */

import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Custom render function that includes providers if needed
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // In the future, wrap with QueryClient, Theme providers, etc.
  return render(ui, options)
}

// Mock delay for async tests
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

// Wait for async assertions
export const waitFor = async (
  condition: () => boolean | void,
  timeout = 5000
): Promise<void> => {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    try {
      const result = condition()
      if (result) return
    } catch {
      // Continue trying
    }
    await delay(50)
  }
  throw new Error(`Condition not met within ${timeout}ms`)
}

// Generate mock request with IP
export const mockRequestWithIP = (
  body: unknown,
  ip: string
): { request: Request; ip: string } => ({
  request: {
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers({
      'x-forwarded-for': ip,
      'x-real-ip': ip,
    }),
    url: 'http://localhost:3000/api/test',
    method: 'POST',
  } as unknown as Request,
  ip,
})

// Suppress console output during specific tests
export const suppressConsoleError = (
  fn: () => void | Promise<void>
): void | Promise<void> => {
  const originalError = console.error
  console.error = () => {}
  try {
    return fn()
  } finally {
    console.error = originalError
  }
}

// Check if response is a NextResponse
export const isNextResponse = (response: unknown): boolean => {
  return (
    response !== null &&
    typeof response === 'object' &&
    'status' in response &&
    'json' in response
  )
}

// Extract JSON from NextResponse
export const extractResponseJson = async (
  response: Response
): Promise<unknown> => {
  return response.json()
}

// Helper to verify rate limit headers
export const hasRateLimitHeaders = (
  headers: Headers
): { hasLimit: boolean; hasRemaining: boolean; hasReset: boolean } => {
  return {
    hasLimit: headers.has('X-RateLimit-Limit'),
    hasRemaining: headers.has('X-RateLimit-Remaining'),
    hasReset: headers.has('X-RateLimit-Reset'),
  }
}
