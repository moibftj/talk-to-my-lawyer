/**
 * CSRF Protection Tests
 *
 * Tests CSRF token generation, validation, and middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateCSRFToken,
  createCSRFToken,
  signCSRFToken,
  verifySignedCSRFToken,
  validateCSRFToken,
  generateCSRFResponse,
  requiresCSRFProtection,
  getCSRFSecret,
  createCSRFMiddleware,
  validateAdminRequest,
  generateAdminCSRF,
  type CSRFToken,
  type CSRFValidationResult,
} from '../csrf'

// Mock environment
const originalEnv = process.env

describe('CSRF Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CSRF_SECRET = 'test-secret-key-for-csrf-protection'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('generateCSRFToken', () => {
    it('should generate a random hex token', () => {
      const token = generateCSRFToken()

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.length).toBe(64) // 32 bytes = 64 hex chars
    })

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken()
      const token2 = generateCSRFToken()

      expect(token1).not.toBe(token2)
    })

    it('should only contain hexadecimal characters', () => {
      const token = generateCSRFToken()
      const hexRegex = /^[0-9a-f]+$/

      expect(token).toMatch(hexRegex)
    })
  })

  describe('createCSRFToken', () => {
    it('should create token with expiration', () => {
      const tokenData = createCSRFToken()

      expect(tokenData.token).toBeTruthy()
      expect(tokenData.expiresAt).toBeGreaterThan(Date.now())
      expect(typeof tokenData.expiresAt).toBe('number')
    })

    it('should set expiration 24 hours in the future', () => {
      const tokenData = createCSRFToken()
      const twentyFourHoursFromNow = Date.now() + 24 * 60 * 60 * 1000

      expect(tokenData.expiresAt).toBeLessThanOrEqual(twentyFourHoursFromNow)
      expect(tokenData.expiresAt).toBeGreaterThan(twentyFourHoursFromNow - 1000)
    })
  })

  describe('signCSRFToken', () => {
    it('should sign token with timestamp and signature', () => {
      const token = generateCSRFToken()
      const signed = signCSRFToken(token, 'test-secret')

      expect(signed).toBeTruthy()
      expect(typeof signed).toBe('string')

      const parts = signed.split(':')
      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe(token)
      expect(parts[1]).toMatch(/^\d+$/) // Timestamp
      expect(parts[2]).toMatch(/^[0-9a-f]+$/) // Signature
    })

    it('should create different signatures for different secrets', () => {
      const token = generateCSRFToken()
      const signed1 = signCSRFToken(token, 'secret1')
      const signed2 = signCSRFToken(token, 'secret2')

      const sig1 = signed1.split(':')[2]
      const sig2 = signed2.split(':')[2]

      expect(sig1).not.toBe(sig2)
    })
  })

  describe('verifySignedCSRFToken', () => {
    it('should verify valid signed token', () => {
      const token = generateCSRFToken()
      const secret = 'test-secret'
      const signed = signCSRFToken(token, secret)

      const result = verifySignedCSRFToken(signed, secret)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject invalid format', () => {
      const result = verifySignedCSRFToken('invalid-token', 'test-secret')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid token format')
    })

    it('should reject expired tokens', () => {
      const token = generateCSRFToken()
      const secret = 'test-secret'
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
      const signed = `${token}:${oldTimestamp}:${Buffer.from('test').toString('hex')}`

      const result = verifySignedCSRFToken(signed, secret)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Token expired')
    })

    it('should reject tokens with invalid signature', () => {
      const token = generateCSRFToken()
      const secret = 'test-secret'
      const signed = `${token}:${Date.now()}:invalid-signature`

      const result = verifySignedCSRFToken(signed, secret)

      expect(result.valid).toBe(false)
      // Invalid hex signature will fail verification and return 'Token verification failed'
      expect(result.error).toMatch(/Token verification failed|Invalid token/)
    })

    it('should reject tokens signed with different secret', () => {
      const token = generateCSRFToken()
      const signed = signCSRFToken(token, 'secret1')
      const result = verifySignedCSRFToken(signed, 'secret2')

      expect(result.valid).toBe(false)
    })
  })

  describe('validateCSRFToken', () => {
    it('should validate token from header', () => {
      const token = generateCSRFToken()
      const secret = 'test-secret'
      const signed = signCSRFToken(token, secret)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': signed,
        },
      })

      const result = validateCSRFToken(request, '', secret)

      expect(result.valid).toBe(true)
    })

    it('should validate token from parameter', () => {
      const token = generateCSRFToken()
      const secret = 'test-secret'
      const signed = signCSRFToken(token, secret)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
      })

      const result = validateCSRFToken(request, signed, secret)

      expect(result.valid).toBe(true)
    })

    it('should prefer header over parameter', () => {
      const secret = 'test-secret'
      const headerToken = signCSRFToken(generateCSRFToken(), secret)
      const paramToken = signCSRFToken(generateCSRFToken(), 'wrong-secret')

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': headerToken,
        },
      })

      const result = validateCSRFToken(request, paramToken, secret)

      expect(result.valid).toBe(true)
    })

    it('should reject when no token provided', () => {
      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
      })

      const result = validateCSRFToken(request, '', 'test-secret')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('CSRF token missing')
    })
  })

  describe('generateCSRFResponse', () => {
    it('should generate complete CSRF response', () => {
      const secret = 'test-secret'
      const response = generateCSRFResponse(secret)

      expect(response.token).toBeTruthy()
      expect(response.signedToken).toBeTruthy()
      expect(response.expiresAt).toBeGreaterThan(Date.now())
      expect(response.signedToken).toContain(response.token)
    })

    it('should include signed token', () => {
      const secret = 'test-secret'
      const response = generateCSRFResponse(secret)

      const parts = response.signedToken.split(':')
      expect(parts[0]).toBe(response.token)
      expect(parts).toHaveLength(3)
    })
  })

  describe('createCSRFMiddleware', () => {
    it('should skip CSRF for GET requests', async () => {
      const secret = 'test-secret'
      const middleware = createCSRFMiddleware(secret)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'GET',
      })

      const result = await middleware(request)

      expect(result.valid).toBe(true)
    })

    it('should skip CSRF for HEAD requests', async () => {
      const secret = 'test-secret'
      const middleware = createCSRFMiddleware(secret)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'HEAD',
      })

      const result = await middleware(request)

      expect(result.valid).toBe(true)
    })

    it('should skip CSRF for OPTIONS requests', async () => {
      const secret = 'test-secret'
      const middleware = createCSRFMiddleware(secret)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'OPTIONS',
      })

      const result = await middleware(request)

      expect(result.valid).toBe(true)
    })

    it('should validate CSRF for POST requests', async () => {
      const secret = 'test-secret'
      const middleware = createCSRFMiddleware(secret)
      const signed = signCSRFToken(generateCSRFToken(), secret)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': signed,
        },
      })

      const result = await middleware(request)

      expect(result.valid).toBe(true)
    })

    it('should reject invalid CSRF for POST requests', async () => {
      const secret = 'test-secret'
      const middleware = createCSRFMiddleware(secret)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'invalid-token',
        },
      })

      const result = await middleware(request)

      expect(result.valid).toBe(false)
    })

    it('should validate CSRF for PUT requests', async () => {
      const secret = 'test-secret'
      const middleware = createCSRFMiddleware(secret)
      const signed = signCSRFToken(generateCSRFToken(), secret)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'PUT',
        headers: {
          'x-csrf-token': signed,
        },
      })

      const result = await middleware(request)

      expect(result.valid).toBe(true)
    })

    it('should validate CSRF for DELETE requests', async () => {
      const secret = 'test-secret'
      const middleware = createCSRFMiddleware(secret)
      const signed = signCSRFToken(generateCSRFToken(), secret)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'DELETE',
        headers: {
          'x-csrf-token': signed,
        },
      })

      const result = await middleware(request)

      expect(result.valid).toBe(true)
    })

    it('should validate CSRF for PATCH requests', async () => {
      const secret = 'test-secret'
      const middleware = createCSRFMiddleware(secret)
      const signed = signCSRFToken(generateCSRFToken(), secret)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'PATCH',
        headers: {
          'x-csrf-token': signed,
        },
      })

      const result = await middleware(request)

      expect(result.valid).toBe(true)
    })
  })

  describe('requiresCSRFProtection', () => {
    it('should return false for GET requests', () => {
      const request = new Request('http://localhost:3000/api/test', {
        method: 'GET',
      })

      expect(requiresCSRFProtection(request)).toBe(false)
    })

    it('should return true for POST requests', () => {
      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
      })

      expect(requiresCSRFProtection(request)).toBe(true)
    })

    it('should return false for webhook endpoints', () => {
      const request = new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
      })

      expect(requiresCSRFProtection(request)).toBe(false)
    })

    it('should return false for cron endpoints', () => {
      const request = new Request('http://localhost:3000/api/cron/process-email-queue', {
        method: 'POST',
      })

      expect(requiresCSRFProtection(request)).toBe(false)
    })

    it('should return false for health endpoints', () => {
      const request = new Request('http://localhost:3000/api/health', {
        method: 'POST',
      })

      expect(requiresCSRFProtection(request)).toBe(false)
    })

    it('should return true for other POST endpoints', () => {
      const request = new Request('http://localhost:3000/api/letters/submit', {
        method: 'POST',
      })

      expect(requiresCSRFProtection(request)).toBe(true)
    })
  })

  describe('getCSRFSecret', () => {
    it('should return secret from environment', () => {
      process.env.CSRF_SECRET = 'my-secret'

      expect(getCSRFSecret()).toBe('my-secret')
    })

    it('should throw error when secret not set', () => {
      delete process.env.CSRF_SECRET

      expect(() => getCSRFSecret()).toThrow('CSRF_SECRET environment variable is not set')
    })
  })

  describe('validateAdminRequest', () => {
    it('should skip CSRF for GET requests', async () => {
      const request = new Request('http://localhost:3000/api/admin/test', {
        method: 'GET',
      })

      const result = await validateAdminRequest(request)

      expect(result.valid).toBe(true)
    })

    it('should validate CSRF for POST requests', async () => {
      const secret = 'test-secret'
      process.env.CSRF_SECRET = secret
      const signed = signCSRFToken(generateCSRFToken(), secret)

      const request = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': signed,
        },
      })

      const result = await validateAdminRequest(request)

      expect(result.valid).toBe(true)
    })

    it('should return error for missing CSRF secret', async () => {
      delete process.env.CSRF_SECRET

      const request = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
      })

      const result = await validateAdminRequest(request)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('CSRF configuration error')
    })
  })

  describe('generateAdminCSRF', () => {
    it('should generate complete admin CSRF data', () => {
      process.env.CSRF_SECRET = 'test-secret'

      const result = generateAdminCSRF()

      expect(result.token).toBeTruthy()
      expect(result.signedToken).toBeTruthy()
      expect(result.expiresAt).toBeGreaterThan(Date.now())
      expect(result.cookieHeader).toBeTruthy()
      expect(result.cookieHeader).toContain('csrf_token=')
      expect(result.cookieHeader).toContain('HttpOnly')
      expect(result.cookieHeader).toContain('SameSite=Strict')
    })

    it('should include cookie header with proper attributes', () => {
      process.env.CSRF_SECRET = 'test-secret'

      const result = generateAdminCSRF()

      expect(result.cookieHeader).toContain('Path=/')
      expect(result.cookieHeader).toContain('HttpOnly')
      expect(result.cookieHeader).toContain('SameSite=Strict')
      expect(result.cookieHeader).toContain('Max-Age=')
    })

    it('should throw error when CSRF secret not set', () => {
      delete process.env.CSRF_SECRET

      expect(() => generateAdminCSRF()).toThrow()
    })
  })
})
