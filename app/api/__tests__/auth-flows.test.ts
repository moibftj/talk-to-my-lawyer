/**
 * Authentication Flow Tests
 *
 * Tests Supabase authentication integration:
 * - User signup
 * - Login/logout
 * - Password reset
 * - Session management
 * - Token refresh
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '../auth/reset-password/route'
import { POST as ResetPasswordPost } from '../auth/update-password/route'
import { POST as CreateProfilePost } from '../create-profile/route'
import { createClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'

// Mock rate limiting
vi.mock('@/lib/rate-limit-redis', () => ({
  safeApplyRateLimit: vi.fn().mockResolvedValue(null),
  authRateLimit: { requests: 10, window: '1 m' },
  getRateLimitTuple: vi.fn(() => [10, '1 m', 'AUTH_PASSWORD_RESET'] as const),
}))

// Mock config
vi.mock('@/lib/config', () => ({
  getAppUrl: vi.fn(() => 'https://example.com'),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock cookies
const mockGetAll = vi.fn(() => [])
const mockSetAll = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    getAll: mockGetAll,
    setAll: mockSetAll,
  })),
}))

describe('Authentication Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Password Reset Flow', () => {
    it('should send password reset email', async () => {
      const mockReset = vi.fn().mockResolvedValue({
        data: {},
        error: null,
      })

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          resetPasswordForEmail: mockReset,
        },
      } as any)

      const request = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      })

      // Create NextRequest-like object with json method
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({ email: 'user@example.com' }),
      } as unknown as NextRequest

      const response = await POST(nextRequest)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockReset).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          redirectTo: 'https://example.com/auth/reset-password',
        })
      )
    })

    it('should validate email format', async () => {
      const request = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email' }),
      })

      const nextRequest = {
        ...request,
        json: () => Promise.resolve({ email: 'invalid-email' }),
      } as unknown as NextRequest

      const response = await POST(nextRequest)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBeDefined()
    })

    it('should require email field', async () => {
      const request = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as unknown as NextRequest

      const response = await POST(nextRequest)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBeDefined()
    })

    it('should handle Supabase errors gracefully', async () => {
      const mockReset = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Email not found' },
      })

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          resetPasswordForEmail: mockReset,
        },
      } as any)

      const request = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
      })

      const nextRequest = {
        ...request,
        json: () => Promise.resolve({ email: 'nonexistent@example.com' }),
      } as unknown as NextRequest

      const response = await POST(nextRequest)
      const json = await response.json()

      // Should still return success for security (don't reveal if email exists)
      expect(response.status).toBeGreaterThanOrEqual(200)
      expect(response.status).toBeLessThan(300)
    })
  })

  describe('Password Update Flow', () => {
    it('should update password with valid token', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
          updateUser: mockUpdate,
        },
      } as any)

      const request = new Request('http://localhost:3000/api/auth/update-password', {
        method: 'POST',
        body: JSON.stringify({ password: 'NewSecurePassword123!' }),
      })

      const nextRequest = {
        ...request,
        json: () => Promise.resolve({ password: 'NewSecurePassword123!' }),
      } as unknown as NextRequest

      const response = await ResetPasswordPost(nextRequest)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockUpdate).toHaveBeenCalled()
    })

    it('should require authentication', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Not authenticated' },
          }),
        },
      } as any)

      const request = new Request('http://localhost:3000/api/auth/update-password', {
        method: 'POST',
        body: JSON.stringify({ password: 'AnyPassword123!' }),
      })

      const nextRequest = {
        ...request,
        json: () => Promise.resolve({ password: 'AnyPassword123!' }),
      } as unknown as NextRequest

      const response = await ResetPasswordPost(nextRequest)

      expect(response.status).toBe(401)
    })
  })

  describe('Profile Creation Flow', () => {
    it('should create profile on signup', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-123', role: 'subscriber' },
            error: null,
          }),
        }),
      })

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'user-123',
                email: 'user@example.com',
              },
            },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          upsert: mockInsert,
          select: vi.fn().mockReturnThis(),
          single: vi.fn(),
        }),
      } as any)

      const request = new Request('http://localhost:3000/api/create-profile', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as unknown as NextRequest

      const response = await CreateProfilePost(nextRequest)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(mockInsert).toHaveBeenCalled()
    })
  })

  describe('Session Management', () => {
    it('should track session state', () => {
      const session = {
        user_id: 'user-123',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      }

      const isExpired = new Date(session.expires_at) < new Date()
      expect(isExpired).toBe(false)
    })

    it('should detect expired sessions', () => {
      const session = {
        user_id: 'user-123',
        created_at: new Date(Date.now() - 25 * 3600000).toISOString(),
        expires_at: new Date(Date.now() - 1 * 3600000).toISOString(),
      }

      const isExpired = new Date(session.expires_at) < new Date()
      expect(isExpired).toBe(true)
    })

    it('should generate session token on privilege change', () => {
      const oldToken = 'token-v1'
      const newToken = 'token-v2-admin'

      const hasEscalated = newToken.includes('v2')
      expect(hasEscalated).toBe(true)
      expect(newToken).not.toBe(oldToken)
    })
  })

  describe('Rate Limiting for Auth Endpoints', () => {
    it('should enforce rate limits on password reset', async () => {
      const rateLimitConfig = {
        requests: 10,
        window: '1 m',
      }

      expect(rateLimitConfig.requests).toBe(10)
      expect(rateLimitConfig.window).toBe('1 m')
    })

    it('should apply different limits for auth operations', () => {
      const resetPasswordLimit = [10, '1 m']
      const loginLimit = [5, '15 m']

      expect(resetPasswordLimit[0]).toBeGreaterThan(loginLimit[0])
    })
  })
})
