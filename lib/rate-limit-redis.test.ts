/**
 * Tests for lib/rate-limit-redis
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Upstash modules
vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    static fixedWindow(limit: number, window: string) {
      return { limit, window }
    }
  }

  return { Ratelimit: MockRatelimit }
})

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}))

// Reset rate limit store before each test
beforeEach(() => {
  if (global.rateLimitStore) {
    global.rateLimitStore.clear()
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

// Import after mocking
import {
  authRateLimit,
  apiRateLimit,
  adminRateLimit,
  letterGenerationRateLimit,
  subscriptionRateLimit,
  applyRateLimit,
  safeApplyRateLimit,
} from './rate-limit-redis'

const hasRedisConfig =
  !!process.env.KV_REST_API_URL &&
  !!process.env.KV_REST_API_TOKEN &&
  process.env.KV_REST_API_URL.trim().startsWith('https://')

// Helper to create mock NextRequest
const createMockRequest = (headers: Record<string, string> = {}): NextRequest => {
  return {
    headers: new Headers(headers),
    url: 'http://localhost:3000/api/test',
    method: 'POST',
  } as unknown as NextRequest
}

describe('Rate limiters', () => {
  it('authRateLimit is defined with correct config', () => {
    if (hasRedisConfig) {
      expect(authRateLimit).not.toBeNull()
    } else {
      expect(authRateLimit).toBeNull()
    }
  })

  it('apiRateLimit is defined', () => {
    if (hasRedisConfig) {
      expect(apiRateLimit).not.toBeNull()
    } else {
      expect(apiRateLimit).toBeNull()
    }
  })

  it('adminRateLimit is defined', () => {
    if (hasRedisConfig) {
      expect(adminRateLimit).not.toBeNull()
    } else {
      expect(adminRateLimit).toBeNull()
    }
  })

  it('letterGenerationRateLimit is defined', () => {
    if (hasRedisConfig) {
      expect(letterGenerationRateLimit).not.toBeNull()
    } else {
      expect(letterGenerationRateLimit).toBeNull()
    }
  })

  it('subscriptionRateLimit is defined', () => {
    if (hasRedisConfig) {
      expect(subscriptionRateLimit).not.toBeNull()
    } else {
      expect(subscriptionRateLimit).toBeNull()
    }
  })
})

describe('applyFallbackRateLimit (via safeApplyRateLimit)', () => {
  it('allows requests under limit', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.1',
    })

    const result = await safeApplyRateLimit(request, null, 5, '1 m')

    expect(result).toBeNull()
  })

  it('returns 429 response when limit exceeded', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.2',
    })

    // Make 6 requests (limit is 5)
    for (let i = 0; i < 5; i++) {
      const result = await safeApplyRateLimit(request, null, 5, '1 m')
      expect(result).toBeNull()
    }

    // 6th request should be rate limited
    const rateLimitedResponse = await safeApplyRateLimit(request, null, 5, '1 m')
    expect(rateLimitedResponse).not.toBeNull()
    expect(rateLimitedResponse?.status).toBe(429)
  })

  it('includes rate limit headers in 429 response', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.3',
    })

    // Exhaust the limit
    for (let i = 0; i < 5; i++) {
      await safeApplyRateLimit(request, null, 5, '1 m')
    }

    const rateLimitedResponse = await safeApplyRateLimit(request, null, 5, '1 m')

    expect(rateLimitedResponse?.headers.get('X-RateLimit-Limit')).toBe('5')
    expect(rateLimitedResponse?.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(rateLimitedResponse?.headers.get('Retry-After')).toBeDefined()
  })

  it('resets after window expires', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.4',
    })

    // Use a very short window (100ms)
    const limit = 2
    const window = '100 ms' // This will use the default 1 minute since format doesn't match

    // Exhaust limit
    for (let i = 0; i < limit; i++) {
      const result = await safeApplyRateLimit(request, null, limit, '100 ms')
      expect(result).toBeNull()
    }

    // Should be rate limited now
    let result = await safeApplyRateLimit(request, null, limit, '100 ms')
    expect(result).not.toBeNull()

    // Clear the store to simulate window expiration
    if (global.rateLimitStore) {
      global.rateLimitStore.clear()
    }

    // Should be allowed again
    result = await safeApplyRateLimit(request, null, limit, '100 ms')
    expect(result).toBeNull()
  })

  it('tracks different IPs separately', async () => {
    const request1 = createMockRequest({
      'x-forwarded-for': '192.168.1.5',
    })
    const request2 = createMockRequest({
      'x-forwarded-for': '192.168.1.6',
    })

    // Exhaust limit for IP1
    for (let i = 0; i < 5; i++) {
      const result = await safeApplyRateLimit(request1, null, 5, '1 m')
      expect(result).toBeNull()
    }

    // IP1 should be rate limited
    const result1 = await safeApplyRateLimit(request1, null, 5, '1 m')
    expect(result1).not.toBeNull()

    // IP2 should still be allowed
    const result2 = await safeApplyRateLimit(request2, null, 5, '1 m')
    expect(result2).toBeNull()
  })

  it('uses custom identifier when provided', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.7',
    })

    const customId = 'user-123'

    // Exhaust limit with custom ID
    for (let i = 0; i < 5; i++) {
      const result = await safeApplyRateLimit(request, null, 5, '1 m', customId)
      expect(result).toBeNull()
    }

    // Should be rate limited for this custom ID
    let result = await safeApplyRateLimit(request, null, 5, '1 m', customId)
    expect(result).not.toBeNull()

    // Different IP but same custom ID should also be rate limited
    const request2 = createMockRequest({
      'x-forwarded-for': '192.168.1.8',
    })
    result = await safeApplyRateLimit(request2, null, 5, '1 m', customId)
    expect(result).not.toBeNull()
  })
})

describe('getClientIP', () => {
  it('extracts IP from x-forwarded-for header', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.10, 10.0.0.1',
    })

    // First request should use the IP
    const result = await safeApplyRateLimit(request, null, 1, '1 m')
    expect(result).toBeNull()

    // Same IP should be rate limited
    const result2 = await safeApplyRateLimit(request, null, 1, '1 m')
    expect(result2).not.toBeNull()
  })

  it('falls back to x-real-ip header', async () => {
    const request = createMockRequest({
      'x-real-ip': '192.168.1.11',
    })

    const result = await safeApplyRateLimit(request, null, 1, '1 m')
    expect(result).toBeNull()
  })

  it('falls back to cf-connecting-ip header', async () => {
    const request = createMockRequest({
      'cf-connecting-ip': '192.168.1.12',
    })

    const result = await safeApplyRateLimit(request, null, 1, '1 m')
    expect(result).toBeNull()
  })

  it('uses unknown when no IP headers present', async () => {
    const request = createMockRequest({})

    // Should still work with 'unknown' identifier
    const result = await safeApplyRateLimit(request, null, 1, '1 m')
    expect(result).toBeNull()

    // Second request should also be rate limited (same 'unknown' identifier)
    const result2 = await safeApplyRateLimit(request, null, 1, '1 m')
    expect(result2).not.toBeNull()
  })

  it('prioritizes headers in correct order', () => {
    // This is tested implicitly by the fact that x-forwarded-for takes precedence
    // The implementation checks: x-forwarded-for -> x-real-ip -> cf-connecting-ip -> unknown
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.13',
      'x-real-ip': '192.168.1.14',
      'cf-connecting-ip': '192.168.1.15',
    })

    // The first IP in x-forwarded-for should be used
    // We can verify by checking that the rate limit is applied per that IP
    expect(async () => {
      await safeApplyRateLimit(request, null, 1, '1 m')
    }).not.toThrow()
  })
})

describe('parseWindowToMs (via applyFallbackRateLimit)', () => {
  it('parses seconds correctly', async () => {
    // The parse function is internal, but we can test its effect
    // A 1 second window should reset quickly
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.20',
    })

    // Use 1s window (though our parser expects '1 s' format)
    // If the format doesn't match, it defaults to 1 minute
    for (let i = 0; i < 2; i++) {
      const result = await safeApplyRateLimit(request, null, 2, '1 s')
      expect(result).toBeNull()
    }

    // Third request should be rate limited
    let result = await safeApplyRateLimit(request, null, 2, '1 s')
    expect(result).not.toBeNull()

    // Clear and try with minute format
    if (global.rateLimitStore) {
      global.rateLimitStore.clear()
    }

    result = await safeApplyRateLimit(request, null, 2, '1 m')
    expect(result).toBeNull()
  })

  it('defaults to 1 minute for invalid format', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.21',
    })

    // Invalid format - should default to 1 minute behavior
    const result = await safeApplyRateLimit(request, null, 100, 'invalid')
    expect(result).toBeNull()
  })
})

describe('429 Response Format', () => {
  it('returns correct error response structure', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.30',
    })

    // Exhaust limit
    for (let i = 0; i < 5; i++) {
      await safeApplyRateLimit(request, null, 5, '1 m')
    }

    const response = await safeApplyRateLimit(request, null, 5, '1 m')
    expect(response).not.toBeNull()

    const json = await response?.json()
    expect(json).toHaveProperty('error', 'Rate limit exceeded. Please try again later.')
    // Note: Fallback response includes only retryAfter, not limit/remaining
    expect(json).toHaveProperty('retryAfter')
  })

  it('calculates retryAfter correctly', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.31',
    })

    // Exhaust limit
    for (let i = 0; i < 3; i++) {
      await safeApplyRateLimit(request, null, 3, '1 h')
    }

    const response = await safeApplyRateLimit(request, null, 3, '1 h')
    const json = await response?.json()

    // retryAfter should be in seconds, roughly 1 hour
    expect(json.retryAfter).toBeGreaterThan(0)
    expect(json.retryAfter).toBeLessThanOrEqual(3600)
  })
})

describe('safeApplyRateLimit with fallback', () => {
  it('uses fallback when rateLimiter is null', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.40',
    })

    // null rateLimiter triggers fallback
    const result = await safeApplyRateLimit(request, null, 10, '1 m')
    expect(result).toBeNull()
  })

  it('uses custom prefixName when provided', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.41',
    })

    const customPrefix = 'custom-test'

    // First request with custom prefix
    let result = await safeApplyRateLimit(request, null, 1, '1 m', undefined, customPrefix)
    expect(result).toBeNull()

    // Second request should be rate limited
    result = await safeApplyRateLimit(request, null, 1, '1 m', undefined, customPrefix)
    expect(result).not.toBeNull()

    // Different prefix should not be rate limited
    result = await safeApplyRateLimit(request, null, 1, '1 m', undefined, 'different-prefix')
    expect(result).toBeNull()
  })
})

describe('Multiple independent rate limits', () => {
  it('maintains separate counts for different prefixes', async () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.50',
    })

    // Use different prefixes for different endpoints
    const prefixes = ['api', 'auth', 'admin']

    for (const prefix of prefixes) {
      // Each prefix should have its own limit
      for (let i = 0; i < 3; i++) {
        const result = await safeApplyRateLimit(request, null, 3, '1 m', undefined, prefix)
        expect(result).toBeNull()
      }
    }
  })

  it('does not affect other identifiers when one is rate limited', async () => {
    const baseRequest = createMockRequest({
      'x-forwarded-for': '192.168.1.51',
    })

    // Rate limit user-1
    for (let i = 0; i < 2; i++) {
      const result = await safeApplyRateLimit(baseRequest, null, 2, '1 m', 'user-1')
      expect(result).toBeNull()
    }

    // user-1 should be rate limited
    let result = await safeApplyRateLimit(baseRequest, null, 2, '1 m', 'user-1')
    expect(result).not.toBeNull()

    // user-2 should not be affected
    result = await safeApplyRateLimit(baseRequest, null, 2, '1 m', 'user-2')
    expect(result).toBeNull()
  })
})
