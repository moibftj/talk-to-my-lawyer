/**
 * Admin Session Management Tests
 *
 * Tests admin session lifecycle:
 * - Session creation with proper cookie settings
 * - Session verification and timeout
 * - Session destruction
 * - Role verification from database
 * - Sub-role access control
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NextResponse } from 'next/server'
import { createSessionToken, verifySessionToken } from '@/lib/security/jwt'

const TEST_JWT_SECRET = 'test-jwt-secret-for-admin-session-tests'

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

import {
  verifyAdminSession,
  destroyAdminSession,
  verifyAdminCredentials,
  verifyAdminRole,
  getAdminSession,
  isAdminAuthenticated,
  requireAdminAuth,
  requireSuperAdminAuth,
  requireAttorneyAdminAccess,
  isSuperAdmin,
  isAttorneyAdmin,
  getAdminSubRole,
  getCurrentAdminSubRole,
  type AdminSession,
} from '../admin-session'

function createTestToken(session: AdminSession): string {
  return createSessionToken(
    session.userId,
    session.email,
    session.subRole,
    30,
    TEST_JWT_SECRET
  )
}

function createExpiredToken(session: AdminSession): string {
  return createSessionToken(
    session.userId,
    session.email,
    session.subRole,
    -1,
    TEST_JWT_SECRET
  )
}

describe('Admin Session Management', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      ADMIN_SESSION_SECRET: TEST_JWT_SECRET,
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // Note: createAdminSession was removed - admin auth now uses standard Supabase auth

  describe('verifyAdminSession', () => {
    it('should return null when no session cookie exists', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const session = await verifyAdminSession()

      expect(session).toBeNull()
    })

    it('should return session when valid and not expired', async () => {
      const validSession: AdminSession = {
        userId: 'user-123',
        email: 'admin@example.com',
        subRole: 'super_admin',
        loginTime: Date.now() - 10 * 60 * 1000,
        lastActivity: Date.now() - 5 * 60 * 1000,
      }

      const token = createTestToken(validSession)
      mockCookieStore.get.mockReturnValue({ value: token })

      const session = await verifyAdminSession()

      expect(session).not.toBeNull()
      expect(session?.userId).toBe('user-123')
      expect(session?.subRole).toBe('super_admin')
    })

    it('should return null and destroy session when expired', async () => {
      const expiredSession: AdminSession = {
        userId: 'user-123',
        email: 'admin@example.com',
        subRole: 'super_admin',
        loginTime: Date.now() - 60 * 60 * 1000,
        lastActivity: Date.now() - 35 * 60 * 1000,
      }

      const token = createExpiredToken(expiredSession)
      mockCookieStore.get.mockReturnValue({ value: token })

      const session = await verifyAdminSession()

      expect(session).toBeNull()
      expect(mockCookieStore.delete).toHaveBeenCalledWith('admin_session')
    })

    it('should update lastActivity on valid session access', async () => {
      const validSession: AdminSession = {
        userId: 'user-123',
        email: 'admin@example.com',
        subRole: 'super_admin',
        loginTime: Date.now() - 10 * 60 * 1000,
        lastActivity: Date.now() - 5 * 60 * 1000,
      }

      const token = createTestToken(validSession)
      mockCookieStore.get.mockReturnValue({ value: token })

      await verifyAdminSession()

      expect(mockCookieStore.set).toHaveBeenCalled()
      const newToken = mockCookieStore.set.mock.calls[0][1]
      const updatedSession = verifySessionToken(newToken, TEST_JWT_SECRET)
      expect(updatedSession!.lastActivity).toBeGreaterThanOrEqual(validSession.lastActivity)
    })

    it('should handle malformed session token', async () => {
      mockCookieStore.get.mockReturnValue({
        value: 'not valid jwt token',
      })

      const session = await verifyAdminSession()

      expect(session).toBeNull()
      expect(mockCookieStore.delete).toHaveBeenCalledWith('admin_session')
    })
  })

  // Note: verifyAdminSessionFromRequest was removed - middleware now uses Supabase auth directly

  describe('destroyAdminSession', () => {
    it('should delete the session cookie', async () => {
      await destroyAdminSession()

      expect(mockCookieStore.delete).toHaveBeenCalledWith('admin_session')
    })
  })

  describe('verifyAdminCredentials', () => {
    it('should return success for valid admin credentials', async () => {
      const mockSupabase = {
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'user-123',
                  role: 'admin',
                  admin_sub_role: 'super_admin',
                  full_name: 'Admin User',
                },
                error: null,
              }),
            }),
          }),
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const result = await verifyAdminCredentials('admin@example.com', 'password123')

      expect(result.success).toBe(true)
      expect(result.userId).toBe('user-123')
      expect(result.subRole).toBe('super_admin')
    })

    it('should return failure for invalid credentials', async () => {
      const mockSupabase = {
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid login credentials' },
          }),
        },
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const result = await verifyAdminCredentials('admin@example.com', 'wrong-password')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email or password')
    })

    it('should return failure for non-admin user', async () => {
      const mockSupabase = {
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-456' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'user-456',
                  role: 'subscriber',
                  full_name: 'Regular User',
                },
                error: null,
              }),
            }),
          }),
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const result = await verifyAdminCredentials('subscriber@example.com', 'password123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Access denied. Administrator privileges required.')
    })

    it('should default to super_admin when admin_sub_role is not set', async () => {
      const mockSupabase = {
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-789' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'user-789',
                  role: 'admin',
                  admin_sub_role: null,
                  full_name: 'Admin User',
                },
                error: null,
              }),
            }),
          }),
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const result = await verifyAdminCredentials('admin@example.com', 'password123')

      expect(result.success).toBe(true)
      expect(result.subRole).toBe('super_admin')
    })
  })

  describe('verifyAdminRole', () => {
    it('should return true for admin role', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'admin' },
                error: null,
              }),
            }),
          }),
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const result = await verifyAdminRole('user-123')

      expect(result).toBe(true)
    })

    it('should return false for non-admin role', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'subscriber' },
                error: null,
              }),
            }),
          }),
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const result = await verifyAdminRole('user-456')

      expect(result).toBe(false)
    })
  })

  describe('requireSuperAdminAuth', () => {
    it('should return 401 when not authenticated', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const result = await requireSuperAdminAuth()

      expect(result).toBeInstanceOf(NextResponse)
      expect(result?.status).toBe(401)
    })

    it('should return 403 when authenticated as attorney_admin', async () => {
      const attorneySession: AdminSession = {
        userId: 'user-123',
        email: 'attorney@example.com',
        subRole: 'attorney_admin',
        loginTime: Date.now(),
        lastActivity: Date.now(),
      }

      const token = createTestToken(attorneySession)
      mockCookieStore.get.mockReturnValue({ value: token })

      const result = await requireSuperAdminAuth()

      expect(result).toBeInstanceOf(NextResponse)
      expect(result?.status).toBe(403)
    })

    it('should return undefined when authenticated as super_admin', async () => {
      const superAdminSession: AdminSession = {
        userId: 'user-456',
        email: 'superadmin@example.com',
        subRole: 'super_admin',
        loginTime: Date.now(),
        lastActivity: Date.now(),
      }

      const token = createTestToken(superAdminSession)
      mockCookieStore.get.mockReturnValue({ value: token })

      const result = await requireSuperAdminAuth()

      expect(result).toBeUndefined()
    })
  })

  describe('requireAttorneyAdminAccess', () => {
    it('should return 401 when not authenticated', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const result = await requireAttorneyAdminAccess()

      expect(result).toBeInstanceOf(NextResponse)
      expect(result?.status).toBe(401)
    })

    it('should return undefined for attorney_admin', async () => {
      const attorneySession: AdminSession = {
        userId: 'user-123',
        email: 'attorney@example.com',
        subRole: 'attorney_admin',
        loginTime: Date.now(),
        lastActivity: Date.now(),
      }

      const token = createTestToken(attorneySession)
      mockCookieStore.get.mockReturnValue({ value: token })

      const result = await requireAttorneyAdminAccess()

      expect(result).toBeUndefined()
    })

    it('should return undefined for super_admin', async () => {
      const superAdminSession: AdminSession = {
        userId: 'user-456',
        email: 'superadmin@example.com',
        subRole: 'super_admin',
        loginTime: Date.now(),
        lastActivity: Date.now(),
      }

      const token = createTestToken(superAdminSession)
      mockCookieStore.get.mockReturnValue({ value: token })

      const result = await requireAttorneyAdminAccess()

      expect(result).toBeUndefined()
    })
  })

  describe('isSuperAdmin / isAttorneyAdmin', () => {
    it('should return true for super_admin', async () => {
      const superAdminSession: AdminSession = {
        userId: 'user-123',
        email: 'superadmin@example.com',
        subRole: 'super_admin',
        loginTime: Date.now(),
        lastActivity: Date.now(),
      }

      const token = createTestToken(superAdminSession)
      mockCookieStore.get.mockReturnValue({ value: token })

      expect(await isSuperAdmin()).toBe(true)
      expect(await isAttorneyAdmin()).toBe(false)
    })

    it('should return true for attorney_admin', async () => {
      const attorneySession: AdminSession = {
        userId: 'user-456',
        email: 'attorney@example.com',
        subRole: 'attorney_admin',
        loginTime: Date.now(),
        lastActivity: Date.now(),
      }

      const token = createTestToken(attorneySession)
      mockCookieStore.get.mockReturnValue({ value: token })

      expect(await isSuperAdmin()).toBe(false)
      expect(await isAttorneyAdmin()).toBe(true)
    })

    it('should return false when not authenticated', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      expect(await isSuperAdmin()).toBe(false)
      expect(await isAttorneyAdmin()).toBe(false)
    })
  })
})
