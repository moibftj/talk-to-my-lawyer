/**
 * Admin Authentication Tests
 *
 * Tests security-critical admin authentication:
 * - 2-factor authentication (credentials + role verification)
 * - Role-based routing (super_admin vs attorney_admin)
 * - JWT token issuance for session setup
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

// Mock JWT utilities
vi.mock('@/lib/security/jwt', () => ({
  getJWTSecret: vi.fn(() => 'test-jwt-secret'),
  createSessionToken: vi.fn((userId: string, email: string, subRole: string, expiresInMinutes: number) => {
    return `jwt-${userId}-${email}-${subRole}-${expiresInMinutes}`
  }),
}))

// Mock admin session
vi.mock('@/lib/auth/admin-session', () => ({
  verifyAdminCredentials: vi.fn(),
  getAdminSession: vi.fn(),
  destroyAdminSession: vi.fn(),
}))

import {
  verifyAdminCredentials,
  getAdminSession,
  destroyAdminSession,
} from '@/lib/auth/admin-session'
import { safeApplyRateLimit } from '@/lib/rate-limit-redis'

const mockVerifyAdminCredentials = verifyAdminCredentials as ReturnType<typeof vi.fn>
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
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('POST /api/admin-auth/login', () => {
    describe('Input Validation', () => {
      it('should reject request without email', async () => {
        const request = createMockRequest({
          password: 'password123',
          intendedRole: 'super_admin',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toContain('Email and password are required')
      })

      it('should reject request without password', async () => {
        const request = createMockRequest({
          email: 'admin@example.com',
          intendedRole: 'super_admin',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toContain('Email and password are required')
      })

      it('should reject empty request body', async () => {
        const request = createMockRequest({})

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toContain('Email and password are required')
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
          intendedRole: 'super_admin',
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
          intendedRole: 'super_admin',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(401)
        expect(json.error).toBe('Access denied. Administrator privileges required.')
      })
    })

    describe('Role Validation', () => {
      it('should reject when intended role does not match actual role', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: true,
          userId: 'attorney-456',
          subRole: 'attorney_admin', // User is attorney_admin
        })

        const request = createMockRequest({
          email: 'attorney@example.com',
          password: 'correct-password',
          intendedRole: 'super_admin', // But selected super_admin
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(403)
        expect(json.error).toContain('You do not have Super Admin access')
        expect(json.error).toContain('Your role is Attorney Admin')
      })

      it('should reject super admin trying to access attorney admin role', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: true,
          userId: 'admin-123',
          subRole: 'super_admin',
        })

        const request = createMockRequest({
          email: 'superadmin@example.com',
          password: 'correct-password',
          intendedRole: 'attorney_admin',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(403)
        expect(json.error).toContain('You do not have Attorney Admin access')
      })
    })

    describe('Successful Authentication', () => {
      it('should authenticate super_admin and return JWT token with redirect', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: true,
          userId: 'admin-user-123',
          subRole: 'super_admin',
        })

        const request = createMockRequest({
          email: 'superadmin@example.com',
          password: 'correct-password',
          intendedRole: 'super_admin',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.success).toBe(true)
        expect(json.redirectUrl).toBe('/secure-admin-gateway/dashboard')
        expect(json.subRole).toBe('super_admin')
        expect(json.token).toBeDefined()
      })

      it('should authenticate attorney_admin and return JWT token with redirect', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: true,
          userId: 'attorney-user-456',
          subRole: 'attorney_admin',
        })

        const request = createMockRequest({
          email: 'attorney@example.com',
          password: 'correct-password',
          intendedRole: 'attorney_admin',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.success).toBe(true)
        expect(json.redirectUrl).toBe('/attorney-portal/review')
        expect(json.subRole).toBe('attorney_admin')
        expect(json.token).toBeDefined()
      })

      it('should default to super_admin when intendedRole is not provided', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: true,
          userId: 'admin-user-789',
          subRole: 'super_admin',
        })

        const request = createMockRequest({
          email: 'admin@example.com',
          password: 'correct-password',
          // No intendedRole provided
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.subRole).toBe('super_admin')
        expect(json.redirectUrl).toBe('/secure-admin-gateway/dashboard')
      })

      it('should default intendedRole to super_admin when role matches', async () => {
        mockVerifyAdminCredentials.mockResolvedValue({
          success: true,
          userId: 'admin-user-789',
          subRole: 'super_admin',
        })

        const request = createMockRequest({
          email: 'admin@example.com',
          password: 'correct-password',
          intendedRole: 'super_admin',
        })

        const response = await LoginPost(request)
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.subRole).toBe('super_admin')
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
          intendedRole: 'super_admin',
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
          intendedRole: 'super_admin',
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
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should not reveal whether email exists in error messages', async () => {
    mockVerifyAdminCredentials.mockResolvedValue({
      success: false,
      error: 'Invalid email or password', // Generic error
    })

    const request = createMockRequest({
      email: 'nonexistent@example.com',
      password: 'password123',
      intendedRole: 'super_admin',
    })

    const response = await LoginPost(request)
    const json = await response.json()

    // Error should be generic, not revealing if email exists
    expect(json.error).toBe('Invalid email or password')
    expect(json.error).not.toContain('not found')
    expect(json.error).not.toContain('does not exist')
  })

  it('should validate role server-side to prevent client bypass', async () => {
    // Simulate client-side manipulation: user claims to be super_admin
    // but database shows they are only attorney_admin
    mockVerifyAdminCredentials.mockResolvedValue({
      success: true,
      userId: 'attorney-123',
      subRole: 'attorney_admin', // Server-side truth
    })

    const request = createMockRequest({
      email: 'attorney@example.com',
      password: 'correct-password',
      intendedRole: 'super_admin', // Client-side claim (manipulated)
    })

    const response = await LoginPost(request)
    const json = await response.json()

    // Should reject because server-side validation catches the mismatch
    expect(response.status).toBe(403)
    expect(json.error).toContain('You do not have Super Admin access')
  })
})
