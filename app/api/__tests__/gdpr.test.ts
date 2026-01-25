/**
 * GDPR API Tests
 *
 * Tests GDPR compliance endpoints for data export, deletion, and privacy policy
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, GET as ExportGET } from '../gdpr/export-data/route'
import { POST as DeletePOST, GET as DeleteGET, DELETE as DeleteDELETE } from '../gdpr/delete-account/route'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getServiceRoleClient: vi.fn(),
}))

vi.mock('@/lib/auth/admin-session', () => ({
  requireSuperAdminAuth: vi.fn(() => Promise.resolve(null)),
  getAdminSession: vi.fn(() => Promise.resolve({
    userId: 'admin-123',
    email: 'admin@example.com',
    subRole: 'super_admin',
  })),
}))

vi.mock('@/lib/rate-limit-redis', () => ({
  safeApplyRateLimit: vi.fn(() => Promise.resolve(null)),
  apiRateLimit: {},
}))

vi.mock('@/lib/config', () => ({
  getRateLimitTuple: vi.fn((key: string) => [100, '1m']),
}))

import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'
import { requireSuperAdminAuth, getAdminSession } from '@/lib/auth/admin-session'

const mockCreateClient = createClient as any
const mockGetServiceRoleClient = getServiceRoleClient as any
const mockRequireSuperAdminAuth = requireSuperAdminAuth as any
const mockGetAdminSession = getAdminSession as any

describe('GDPR API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/gdpr/export-data', () => {
    it('should create and complete data export request', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockExportData = {
        profile: { id: 'user-123', email: 'user@example.com' },
        letters: [],
        subscriptions: [],
      }

      // Mock order chain for checking recent requests
      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null })
      const gteMock = vi.fn(() => ({ order: orderMock }))
      const eq1Mock = vi.fn(() => ({ gte: gteMock }))
      const select1Mock = vi.fn(() => ({ eq: eq1Mock }))
      const from1Mock = vi.fn((table: string) => {
        if (table === 'data_export_requests') {
          return { select: select1Mock }
        }
        return {}
      })

      // Mock insert chain
      const single1Mock = vi.fn().mockResolvedValue({
        data: { id: 'export-123', user_id: 'user-123', status: 'pending' },
        error: null,
      })
      const select2Mock = vi.fn(() => ({ single: single1Mock }))
      const insertMock = vi.fn(() => ({ select: select2Mock }))

      // Mock rpc for update
      const eq2Mock = vi.fn(() => Promise.resolve({ error: null }))
      const updateMock = vi.fn(() => ({ eq: eq2Mock }))
      const from2Mock = vi.fn((table: string) => {
        if (table === 'data_export_requests') {
          return { update: updateMock }
        }
        return {}
      })

      // Mock rpc for data export and logging
      const rpcMock = vi.fn()
        .mockResolvedValueOnce({ data: mockExportData, error: null }) // export_user_data
        .mockResolvedValueOnce({ error: null }) // log_data_access

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: from2Mock,
        rpc: rpcMock,
      }

      // Make from work for both the check and insert
      from2Mock.mockImplementation((table: string) => {
        if (table === 'data_export_requests') {
          return {
            select: select1Mock, // For checking recent requests
            insert: insertMock, // For inserting new request
            update: updateMock, // For updating status
          }
        }
        return {}
      })

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/gdpr/export-data', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
        headers: request.headers,
      } as any

      const response = await POST(nextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('completed')
      expect(data.data).toBeDefined()
    })

    it('should reject duplicate export requests within 24 hours', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }

      const orderMock = vi.fn().mockResolvedValue({
        data: [{
          id: 'export-existing',
          status: 'pending',
          requested_at: new Date().toISOString(),
        }],
        error: null,
      })
      const gteMock = vi.fn(() => ({ order: orderMock }))
      const eq1Mock = vi.fn(() => ({ gte: gteMock }))
      const select1Mock = vi.fn(() => ({ eq: eq1Mock }))
      const from1Mock = vi.fn(() => ({ select: select1Mock }))

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: from1Mock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/gdpr/export-data', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
        headers: request.headers,
      } as any

      const response = await POST(nextRequest)

      expect(response.status).toBe(429)
    })

    it('should require authentication', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' },
          }),
        },
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/gdpr/export-data', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
        headers: request.headers,
      } as any

      const response = await POST(nextRequest)

      expect(response.status).toBe(401)
    })

    it('should handle export errors and update request status', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }

      const orderMock = vi.fn().mockResolvedValue({ data: [], error: null })
      const gteMock = vi.fn(() => ({ order: orderMock }))
      const eq1Mock = vi.fn(() => ({ gte: gteMock }))
      const select1Mock = vi.fn(() => ({ eq: eq1Mock }))

      const single1Mock = vi.fn().mockResolvedValue({
        data: { id: 'export-123', user_id: 'user-123', status: 'pending' },
        error: null,
      })
      const select2Mock = vi.fn(() => ({ single: single1Mock }))
      const insertMock = vi.fn(() => ({ select: select2Mock }))

      const eq2Mock = vi.fn(() => Promise.resolve({ error: null }))
      const updateMock = vi.fn(() => ({ eq: eq2Mock }))

      const rpcMock = vi.fn().mockRejectedValue(new Error('Export failed'))

      const fromMock = vi.fn((table: string) => {
        if (table === 'data_export_requests') {
          return {
            select: select1Mock,
            insert: insertMock,
            update: updateMock,
          }
        }
        return {}
      })

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: fromMock,
        rpc: rpcMock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/gdpr/export-data', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
        headers: request.headers,
      } as any

      const response = await POST(nextRequest)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('GET /api/gdpr/export-data', () => {
    it('should return list of export requests for user', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockExportRequests = [
        {
          id: 'export-1',
          user_id: 'user-123',
          status: 'completed',
          requested_at: '2025-01-15',
        },
        {
          id: 'export-2',
          user_id: 'user-123',
          status: 'completed',
          requested_at: '2024-12-01',
        },
      ]

      const limitMock = vi.fn().mockResolvedValue({
        data: mockExportRequests,
        error: null,
      })
      const orderMock = vi.fn(() => ({ limit: limitMock }))
      const eq1Mock = vi.fn(() => ({ order: orderMock }))
      const select1Mock = vi.fn(() => ({ eq: eq1Mock }))
      const from1Mock = vi.fn(() => ({ select: select1Mock }))

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: from1Mock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/gdpr/export-data')
      const response = await ExportGET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.requests).toHaveLength(2)
    })

    it('should require authentication', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' },
          }),
        },
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/gdpr/export-data')
      const response = await ExportGET(request as any)

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/gdpr/delete-account', () => {
    it('should create account deletion request with email confirmation', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }

      const single1Mock = vi.fn().mockResolvedValue({
        data: { email: 'user@example.com' },
        error: null,
      })
      const eq1Mock = vi.fn(() => ({ single: single1Mock }))
      const select1Mock = vi.fn(() => ({ eq: eq1Mock }))
      const from1Mock = vi.fn((table: string) => {
        if (table === 'profiles') {
          return { select: select1Mock }
        }
        return {}
      })

      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })
      const inMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
      const eq2Mock = vi.fn(() => ({ in: inMock }))
      const select2Mock = vi.fn(() => ({ eq: eq2Mock }))

      const single2Mock = vi.fn().mockResolvedValue({
        data: {
          id: 'delete-123',
          user_id: 'user-123',
          status: 'pending',
        },
        error: null,
      })
      const select3Mock = vi.fn(() => ({ single: single2Mock }))
      const insertMock = vi.fn(() => ({ select: select3Mock }))

      const rpcMock = vi.fn().mockResolvedValue({ error: null })

      const fromMock = vi.fn((table: string) => {
        if (table === 'profiles') {
          return { select: select1Mock }
        }
        if (table === 'data_deletion_requests') {
          return { select: select2Mock, insert: insertMock }
        }
        return {}
      })

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: fromMock,
        rpc: rpcMock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/gdpr/delete-account', {
        method: 'POST',
        body: JSON.stringify({
          confirmEmail: 'user@example.com',
          reason: 'No longer need service',
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          confirmEmail: 'user@example.com',
          reason: 'No longer need service',
        }),
        headers: request.headers,
      } as any

      const response = await DeletePOST(nextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('pending')
    })

    it('should verify email confirmation matches account email', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }

      const single1Mock = vi.fn().mockResolvedValue({
        data: { email: 'user@example.com' },
        error: null,
      })
      const eq1Mock = vi.fn(() => ({ single: single1Mock }))
      const select1Mock = vi.fn(() => ({ eq: eq1Mock }))
      const from1Mock = vi.fn(() => ({ select: select1Mock }))

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: from1Mock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/gdpr/delete-account', {
        method: 'POST',
        body: JSON.stringify({
          confirmEmail: 'wrong@example.com',
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          confirmEmail: 'wrong@example.com',
        }),
        headers: request.headers,
      } as any

      const response = await DeletePOST(nextRequest)

      expect(response.status).toBe(400)
    })

    it('should be case-insensitive for email confirmation', async () => {
      const mockUser = { id: 'user-123', email: 'User@Example.com' }

      const single1Mock = vi.fn().mockResolvedValue({
        data: { email: 'User@Example.com' },
        error: null,
      })
      const eq1Mock = vi.fn(() => ({ single: single1Mock }))
      const select1Mock = vi.fn(() => ({ eq: eq1Mock }))
      const from1Mock = vi.fn((table: string) => {
        if (table === 'profiles') {
          return { select: select1Mock }
        }
        return {}
      })

      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      })
      const inMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
      const eq2Mock = vi.fn(() => ({ in: inMock }))
      const select2Mock = vi.fn(() => ({ eq: eq2Mock }))

      const single2Mock = vi.fn().mockResolvedValue({
        data: { id: 'delete-123', status: 'pending' },
        error: null,
      })
      const select3Mock = vi.fn(() => ({ single: single2Mock }))
      const insertMock = vi.fn(() => ({ select: select3Mock }))

      const rpcMock = vi.fn().mockResolvedValue({ error: null })

      const fromMock = vi.fn((table: string) => {
        if (table === 'profiles') {
          return { select: select1Mock }
        }
        if (table === 'data_deletion_requests') {
          return { select: select2Mock, insert: insertMock }
        }
        return {}
      })

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: fromMock,
        rpc: rpcMock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/gdpr/delete-account', {
        method: 'POST',
        body: JSON.stringify({
          confirmEmail: 'user@example.com', // Different case
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          confirmEmail: 'user@example.com',
        }),
        headers: request.headers,
      } as any

      const response = await DeletePOST(nextRequest)

      expect(response.status).toBe(200)
    })
  })

  describe('DELETE /api/gdpr/delete-account (admin execution)', () => {
    it('should execute account deletion for super admin', async () => {
      const mockServiceRoleSupabase = {
        from: vi.fn((table: string) => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
        auth: {
          admin: {
            deleteUser: vi.fn().mockResolvedValue({ error: null }),
          },
        },
      }

      mockGetServiceRoleClient.mockReturnValue(mockServiceRoleSupabase)

      const request = new Request('http://localhost:3000/api/gdpr/delete-account', {
        method: 'DELETE',
        body: JSON.stringify({
          requestId: 'delete-123',
          userId: 'user-123',
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          requestId: 'delete-123',
          userId: 'user-123',
        }),
      } as any

      const response = await DeleteDELETE(nextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('permanently deleted')
    })

    it('should require requestId and userId', async () => {
      const request = new Request('http://localhost:3000/api/gdpr/delete-account', {
        method: 'DELETE',
        body: JSON.stringify({
          requestId: 'delete-123',
          // Missing userId
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          requestId: 'delete-123',
        }),
      } as any

      const response = await DeleteDELETE(nextRequest)

      expect(response.status).toBe(400)
    })

    it('should require super admin authentication', async () => {
      mockRequireSuperAdminAuth.mockResolvedValue({
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      } as any)

      const request = new Request('http://localhost:3000/api/gdpr/delete-account', {
        method: 'DELETE',
        body: JSON.stringify({
          requestId: 'delete-123',
          userId: 'user-123',
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          requestId: 'delete-123',
          userId: 'user-123',
        }),
      } as any

      const response = await DeleteDELETE(nextRequest)

      expect(response.status).toBe(401)
    })
  })
})
