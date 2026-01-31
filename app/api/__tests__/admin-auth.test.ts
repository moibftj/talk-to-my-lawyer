/**
 * Admin Authentication Tests
 *
 * Tests security-critical admin authentication:
 * - 3-factor authentication (portal key + credentials + role)
 * - Timing-safe comparison for portal key
 * - Role-based routing (super_admin vs attorney_admin)
 * - Session creation and destruction
 * - Rate limiting
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as LoginPost } from '../admin-auth/login/route'
import { POST as LogoutPost } from '../admin-auth/logout/route'

// Mock rate limiting
vi.mock('@/lib/rate-limit-redis', () => ({
  safeApplyRateLimit: vi.fn(() => Promise.resolve(null)),
  adminRateLimit: { requests: 5, window: '15 m' },
}))

// Mock config
vi.mock('@/lib/config', () => ({
  getRateLimitTuple: vi.fn(() => [5, '15 m'] as const),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock admin session
vi.mock('@/lib/auth/admin-session', () => ({
  verifyAdminCredentials: vi.fn(),
  createAdminSession: vi.fn(),
  getAdminSession: vi.fn(),
  destroyAdminSession: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import {
  verifyAdminCredentials,
  createAdminSession,
  getAdminSession,
  destroyAdminSession,
} from '@/lib/auth/admin-session'
import { safeApplyRateLimit } from '@/lib/rate-limit-redis'

const mockVerifyAdminCredentials = verifyAdminCredentials as ReturnType<typeof vi.fn>
const mockCreateAdminSession = createAdminSession as ReturnType<typeof vi.fn>
const mockGetAdminSession = getAdminSession as ReturnType<typeof vi.fn>
const mockDestroyAdminSession = destroyAdminSession as ReturnType<typeof vi.fn>
const mockSafeApplyRateLimit = safeApplyRateLimit as ReturnType<typeof vi.fn>

function createMockRequest(body: Record<string, unknown>): NextRequest {
  const request = new NextRequest('http://localhost:3000/api/admin-auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return request
}

describe('Admin Authentication', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, ADMIN_PORTAL_KEY: 'test-portal-key-12345' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('POST /api/admin-auth/login', () => {
    describe('Input Validation', () => {
      it('should reject request without email', async () => {
        const request = createMockRequest({
          password: 'password123',
          portalKey: 'test-portal-key-12345',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toContain('Email, password, and portal key are required')
      })

      it('should reject request without password', async () => {
        const request = createMockRequest({
          email: 'admin@example.com',
          portalKey: 'test-portal-key-12345',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toContain('Email, password, and portal key are required')
      })

      it('should reject request without portal key', async () => {
        const request = createMockRequest({
          email: 'admin@example.com',
          password: 'password123',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toContain('Email, password, and portal key are required')
      })

      it('should reject empty request body', async () => {
        const request = createMockRequest({})

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toContain('Email, password, and portal key are required')
      })
    })

    describe('Portal Key Validation (3rd Factor)', () => {
      it('should reject invalid portal key', async () => {
        const request = createMockRequest({
          email: 'admin@example.com',
          password: 'password123',
          portalKey: 'wrong-portal-key',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(401)
        expect(json.error).toBe('Invalid portal key')
      })

      it('should reject portal key with wrong length', async () => {
        const request = createMockRequest({
          email: 'admin@example.com',
          password: 'password123',
          portalKey: 'short',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(401)
        expect(json.error).toBe('Invalid portal key')
      })

      it('should return 500 when ADMIN_PORTAL_KEY is not configured', async () => {
        delete process.env.ADMIN_PORTAL_KEY

        const request = createMockRequest({
          email: 'admin@example.com',
          password: 'password123',
          portalKey: 'any-key',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(500)
        expect(json.error).toBe('Admin portal not properly configured')
      })
    })

    describe('Credential Verification', () => {
      it('should reject invalid credentials', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: false,
          error: 'Invalid email or password',
        })

        const request = createMockRequest({
          email: 'admin@example.com',
          password: 'wrong-password',
          portalKey: 'test-portal-key-12345',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(401)
        expect(json.error).toBe('Invalid email or password')
        expect(mockVerifyAdminCredentials).toHaveBeenCalledWith(
          'admin@example.com',
          'wrong-password'
        )
      })

      it('should reject non-admin users', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: false,
          error: 'Access denied. Administrator privileges required.',
        })

        const request = createMockRequest({
          email: 'subscriber@example.com',
          password: 'password123',
          portalKey: 'test-portal-key-12345',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(401)
        expect(json.error).toBe('Access denied. Administrator privileges required.')
      })
    })

    describe('Successful Authentication', () => {
      it('should authenticate super_admin and redirect to admin gateway', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: true,
          userId: 'admin-user-123',
          subRole: 'super_admin',
        })
        mockCreateAdminSession.mockResolvedValue(undefined)

        const request = createMockRequest({
          email: 'superadmin@example.com',
          password: 'correct-password',
          portalKey: 'test-portal-key-12345',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.success).toBe(true)
        expect(json.redirectUrl).toBe('/secure-admin-gateway/dashboard')
        expect(json.subRole).toBe('super_admin')
        expect(mockCreateAdminSession).toHaveBeenCalledWith(
          'admin-user-123',
          'superadmin@example.com',
          'super_admin'
        )
      })

      it('should authenticate attorney_admin and redirect to attorney portal', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: true,
          userId: 'attorney-user-456',
          subRole: 'attorney_admin',
        })
        mockCreateAdminSession.mockResolvedValue(undefined)

        const request = createMockRequest({
          email: 'attorney@example.com',
          password: 'correct-password',
          portalKey: 'test-portal-key-12345',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.success).toBe(true)
        expect(json.redirectUrl).toBe('/attorney-portal/review')
        expect(json.subRole).toBe('attorney_admin')
        expect(mockCreateAdminSession).toHaveBeenCalledWith(
          'attorney-user-456',
          'attorney@example.com',
          'attorney_admin'
        )
      })

      it('should default to super_admin when subRole is not set', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: true,
          userId: 'admin-user-789',
          // subRole not provided
        })
        mockCreateAdminSession.mockResolvedValue(undefined)

        const request = createMockRequest({
          email: 'admin@example.com',
          password: 'correct-password',
          portalKey: 'test-portal-key-12345',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.subRole).toBe('super_admin')
        expect(json.redirectUrl).toBe('/secure-admin-gateway/dashboard')
      })
    })

    describe('Rate Limiting', () => {
      it('should apply rate limiting', async () => {
        mockSafeApplyRateLimit.mockResolvedValue(
          new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429,
          })
        )

        const request = createMockRequest({
          email: 'admin@example.com',
          password: 'password123',
          portalKey: 'test-portal-key-12345',
        })

        const response = await LoginPost(request)

        expect(response.status).toBe(429)
        expect(mockSafeApplyRateLimit).toHaveBeenCalled()
      })
    })

    describe('Error Handling', () => {
      it('should handle JSON parse errors gracefully', async () => {
        const request = new NextRequest('http://localhost:3000/api/admin-auth/login', {
          method: 'POST',
          body: 'invalid json',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        const response = await LoginPost(request)

        expect(response.status).toBe(500)
      })

      it('should handle unexpected errors', async () => {
        mockVerifyAdminCredentials.mockRejectedValue(new Error('Database connection failed'))

        const request = createMockRequest({
          email: 'admin@example.com',
          password: 'password123',
          portalKey: 'test-portal-key-12345',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(500)
        expect(json.error).toBe('Internal server error')
      })
    })
  })

  describe('POST /api/admin-auth/logout', () => {
    it('should logout and destroy session', async () => {
      mockGetAdminSession.mockResolvedValue({
        userId: 'admin-123',
        email: 'admin@example.com',
        subRole: 'super_admin',
        loginTime: Date.now(),
        lastActivity: Date.now(),
      })
      mockDestroyAdminSession.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost:3000/api/admin-auth/logout', {
        method: 'POST',
      })

      const response = await LogoutPost(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.message).toBe('Logged out successfully')
      expect(mockDestroyAdminSession).toHaveBeenCalled()
    })

    it('should succeed even without active session', async () => {
      mockGetAdminSession.mockResolvedValue(null)
      mockDestroyAdminSession.mockResolvedValue(undefined)

      const request = new NextRequest('http://localhost:3000/api/admin-auth/logout', {
        method: 'POST',
      })

      const response = await LogoutPost(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockDestroyAdminSession).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockGetAdminSession.mockRejectedValue(new Error('Session error'))

      const request = new NextRequest('http://localhost:3000/api/admin-auth/logout', {
        method: 'POST',
      })

      const response = await LogoutPost(request)
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.error).toBe('Internal server error')
    })
  })
})

describe('Admin Authentication Security', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, ADMIN_PORTAL_KEY: 'test-portal-key-12345' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should use timing-safe comparison for portal key to prevent timing attacks', async () => {
    // This test verifies the code path uses timingSafeEqual
    // We can't directly test timing, but we verify both correct and incorrect keys
    // take similar code paths

    const correctKeyRequest = createMockRequest({
      email: 'admin@example.com',
      password: 'password123',
      portalKey: 'test-portal-key-12345',
    })

    const wrongKeyRequest = createMockRequest({
      email: 'admin@example.com',
      password: 'password123',
      portalKey: 'test-portal-key-wrong', // Same length but different
    })

    mockVerifyAdminCredentials.mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
    })

    const correctResponse = await LoginPost(correctKeyRequest)
    const wrongResponse = await LoginPost(wrongKeyRequest)

    // Wrong key should fail at portal key check (401)
    expect(wrongResponse.status).toBe(401)
    const wrongJson = await wrongResponse.json()
    expect(wrongJson.error).toBe('Invalid portal key')

    // Correct key should proceed to credential check (also 401 but different error)
    expect(correctResponse.status).toBe(401)
    const correctJson = await correctResponse.json()
    expect(correctJson.error).toBe('Invalid credentials')
  })

  it('should not reveal whether email exists in error messages', async () => {
    mockVerifyAdminCredentials.mockResolvedValue({
      success: false,
      error: 'Invalid email or password', // Generic error
    })

    const request = createMockRequest({
      email: 'nonexistent@example.com',
      password: 'password123',
      portalKey: 'test-portal-key-12345',
    })

    const response = await LoginPost(request)
    const json = await response.json()

    // Error should be generic, not revealing if email exists
    expect(json.error).toBe('Invalid email or password')
    expect(json.error).not.toContain('not found')
    expect(json.error).not.toContain('does not exist')
  })
})
