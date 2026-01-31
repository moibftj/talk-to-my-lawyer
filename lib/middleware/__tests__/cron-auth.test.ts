/**
 * Cron Authentication Middleware Tests
 *
 * Tests the authentication for cron job endpoints:
 * - Authorization header validation
 * - x-cron-secret header validation
 * - Query parameter validation
 * - Development mode bypass
 * - withCronAuth higher-order function
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth, withCronAuth } from '../cron-auth'

describe('Cron Authentication Middleware', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, CRON_SECRET: 'test-cron-secret-12345' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('verifyCronAuth', () => {
    describe('Authorization Header', () => {
      it('should allow valid Bearer token in Authorization header', () => {
        const request = new NextRequest('http://localhost:3000/api/cron/test', {
          headers: {
            Authorization: 'Bearer test-cron-secret-12345',
          },
        })

        const result = verifyCronAuth(request)

        expect(result).toBeNull()
      })

      it('should reject invalid Bearer token', () => {
        const request = new NextRequest('http://localhost:3000/api/cron/test', {
          headers: {
            Authorization: 'Bearer wrong-secret',
          },
        })

        const result = verifyCronAuth(request)

        expect(result).toBeInstanceOf(NextResponse)
        expect(result?.status).toBe(401)
      })

      it('should reject malformed Authorization header', () => {
        const request = new NextRequest('http://localhost:3000/api/cron/test', {
          headers: {
            Authorization: 'test-cron-secret-12345', // Missing Bearer prefix
          },
        })

        const result = verifyCronAuth(request)

        expect(result).toBeInstanceOf(NextResponse)
        expect(result?.status).toBe(401)
      })

      it('should reject Basic auth scheme', () => {
        const request = new NextRequest('http://localhost:3000/api/cron/test', {
          headers: {
            Authorization: 'Basic dGVzdC1jcm9uLXNlY3JldC0xMjM0NQ==',
          },
        })

        const result = verifyCronAuth(request)

        expect(result).toBeInstanceOf(NextResponse)
        expect(result?.status).toBe(401)
      })
    })

    describe('x-cron-secret Header', () => {
      it('should allow valid x-cron-secret header', () => {
        const request = new NextRequest('http://localhost:3000/api/cron/test', {
          headers: {
            'x-cron-secret': 'test-cron-secret-12345',
          },
        })

        const result = verifyCronAuth(request)

        expect(result).toBeNull()
      })

      it('should reject invalid x-cron-secret header', () => {
        const request = new NextRequest('http://localhost:3000/api/cron/test', {
          headers: {
            'x-cron-secret': 'wrong-secret',
          },
        })

        const result = verifyCronAuth(request)

        expect(result).toBeInstanceOf(NextResponse)
        expect(result?.status).toBe(401)
      })
    })

    describe('Query Parameter', () => {
      it('should allow valid secret query parameter', () => {
        const request = new NextRequest(
          'http://localhost:3000/api/cron/test?secret=test-cron-secret-12345'
        )

        const result = verifyCronAuth(request)

        expect(result).toBeNull()
      })

      it('should reject invalid secret query parameter', () => {
        const request = new NextRequest(
          'http://localhost:3000/api/cron/test?secret=wrong-secret'
        )

        const result = verifyCronAuth(request)

        expect(result).toBeInstanceOf(NextResponse)
        expect(result?.status).toBe(401)
      })

      it('should reject missing secret query parameter', () => {
        const request = new NextRequest('http://localhost:3000/api/cron/test')

        const result = verifyCronAuth(request)

        expect(result).toBeInstanceOf(NextResponse)
        expect(result?.status).toBe(401)
      })
    })

    describe('Authentication Method Priority', () => {
      it('should check Authorization header first', () => {
        const request = new NextRequest(
          'http://localhost:3000/api/cron/test?secret=wrong-secret',
          {
            headers: {
              Authorization: 'Bearer test-cron-secret-12345',
              'x-cron-secret': 'wrong-secret',
            },
          }
        )

        const result = verifyCronAuth(request)

        // Should pass because Authorization header is valid
        expect(result).toBeNull()
      })

      it('should check x-cron-secret if Authorization fails', () => {
        const request = new NextRequest(
          'http://localhost:3000/api/cron/test?secret=wrong-secret',
          {
            headers: {
              Authorization: 'Bearer wrong-secret',
              'x-cron-secret': 'test-cron-secret-12345',
            },
          }
        )

        const result = verifyCronAuth(request)

        // Should pass because x-cron-secret header is valid
        expect(result).toBeNull()
      })

      it('should check query parameter as last fallback', () => {
        const request = new NextRequest(
          'http://localhost:3000/api/cron/test?secret=test-cron-secret-12345',
          {
            headers: {
              Authorization: 'Bearer wrong-secret',
              'x-cron-secret': 'wrong-secret',
            },
          }
        )

        const result = verifyCronAuth(request)

        // Should pass because query parameter is valid
        expect(result).toBeNull()
      })
    })

    describe('Development Mode', () => {
      it('should allow access when CRON_SECRET is not configured', () => {
        delete process.env.CRON_SECRET

        const request = new NextRequest('http://localhost:3000/api/cron/test')

        const result = verifyCronAuth(request)

        // Should allow in development when secret not configured
        expect(result).toBeNull()
      })

      it('should allow access with empty CRON_SECRET', () => {
        process.env.CRON_SECRET = ''

        const request = new NextRequest('http://localhost:3000/api/cron/test')

        const result = verifyCronAuth(request)

        // Empty string is falsy, so should allow
        expect(result).toBeNull()
      })
    })

    describe('Error Response', () => {
      it('should return proper error format', async () => {
        const request = new NextRequest('http://localhost:3000/api/cron/test')

        const result = verifyCronAuth(request)

        expect(result).toBeInstanceOf(NextResponse)
        expect(result?.status).toBe(401)

        const json = await result?.json()
        expect(json.error).toBe('Unauthorized')
      })
    })
  })

  describe('withCronAuth', () => {
    it('should call handler when authentication succeeds', async () => {
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const wrappedHandler = withCronAuth(mockHandler)

      const request = new NextRequest('http://localhost:3000/api/cron/test', {
        headers: {
          Authorization: 'Bearer test-cron-secret-12345',
        },
      })

      const response = await wrappedHandler(request)
      const json = await response.json()

      expect(mockHandler).toHaveBeenCalledWith(request)
      expect(json.success).toBe(true)
    })

    it('should return 401 without calling handler when authentication fails', async () => {
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const wrappedHandler = withCronAuth(mockHandler)

      const request = new NextRequest('http://localhost:3000/api/cron/test', {
        headers: {
          Authorization: 'Bearer wrong-secret',
        },
      })

      const response = await wrappedHandler(request)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(401)
    })

    it('should preserve handler response headers', async () => {
      const mockHandler = vi.fn().mockResolvedValue(
        new NextResponse(JSON.stringify({ data: 'test' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'custom-value',
          },
        })
      )

      const wrappedHandler = withCronAuth(mockHandler)

      const request = new NextRequest('http://localhost:3000/api/cron/test', {
        headers: {
          'x-cron-secret': 'test-cron-secret-12345',
        },
      })

      const response = await wrappedHandler(request)

      expect(response.headers.get('X-Custom-Header')).toBe('custom-value')
    })

    it('should handle handler errors', async () => {
      const mockHandler = vi.fn().mockRejectedValue(new Error('Handler error'))

      const wrappedHandler = withCronAuth(mockHandler)

      const request = new NextRequest('http://localhost:3000/api/cron/test', {
        headers: {
          Authorization: 'Bearer test-cron-secret-12345',
        },
      })

      // The error should propagate
      await expect(wrappedHandler(request)).rejects.toThrow('Handler error')
    })
  })

  describe('Security Considerations', () => {
    it('should not expose secret in error messages', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/cron/test?secret=attacker-guess'
      )

      const result = verifyCronAuth(request)
      const json = await result?.json()

      expect(JSON.stringify(json)).not.toContain('test-cron-secret-12345')
      expect(JSON.stringify(json)).not.toContain('attacker-guess')
    })

    it('should reject requests with partial secret match', () => {
      const request = new NextRequest('http://localhost:3000/api/cron/test', {
        headers: {
          Authorization: 'Bearer test-cron-secret', // Partial match
        },
      })

      const result = verifyCronAuth(request)

      expect(result?.status).toBe(401)
    })

    it('should reject requests with secret + extra characters', () => {
      const request = new NextRequest('http://localhost:3000/api/cron/test', {
        headers: {
          Authorization: 'Bearer test-cron-secret-12345-extra',
        },
      })

      const result = verifyCronAuth(request)

      expect(result?.status).toBe(401)
    })

    it('should be case-sensitive', () => {
      const request = new NextRequest('http://localhost:3000/api/cron/test', {
        headers: {
          Authorization: 'Bearer TEST-CRON-SECRET-12345',
        },
      })

      const result = verifyCronAuth(request)

      expect(result?.status).toBe(401)
    })
  })
})
