/**
 * Mock Supabase client for testing
 */

import { vi } from 'vitest'

// Mock user types
export interface MockUser {
  id: string
  email: string
  role: 'subscriber' | 'admin' | 'employee' | 'super_admin' | 'attorney_admin'
  subscription_tier?: string | null
}

// Default mock user
export const mockSubscriber: MockUser = {
  id: 'test-subscriber-id',
  email: 'subscriber@test.com',
  role: 'subscriber',
  subscription_tier: 'basic',
}

export const mockAdmin: MockUser = {
  id: 'test-admin-id',
  email: 'admin@test.com',
  role: 'super_admin',
  subscription_tier: null,
}

export const mockAttorneyAdmin: MockUser = {
  id: 'test-attorney-id',
  email: 'attorney@test.com',
  role: 'attorney_admin',
  subscription_tier: null,
}

export const mockEmployee: MockUser = {
  id: 'test-employee-id',
  email: 'employee@test.com',
  role: 'employee',
  subscription_tier: null,
}

// Mock Supabase client
export const createMockSupabaseClient = (user: MockUser | null = null) => {
  const mockClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: user ? { id: user.id, email: user.email } : null },
        error: user ? null : { message: 'Not authenticated' },
      }),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: user
            ? {
                access_token: 'mock-token',
                user: { id: user.id, email: user.email },
              }
            : null,
        },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: user,
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: user,
          error: null,
        }),
        range: vi.fn().mockReturnThis(),
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }

      // Mock specific table behaviors
      if (table === 'profiles') {
        mockQuery.single = vi.fn().mockResolvedValue({
          data: user ? { id: user.id, role: user.role, email: user.email } : null,
          error: user ? null : { message: 'No rows found' },
        })
      }

      if (table === 'letters') {
        mockQuery.select = vi.fn().mockReturnThis()
        mockQuery.order = vi.fn().mockReturnThis()
        mockQuery.limit = vi.fn().mockResolvedValue({
          data: [],
          error: null,
        })
        mockQuery.single = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        })
      }

      if (table === 'subscriptions') {
        mockQuery.single = vi.fn().mockResolvedValue({
          data: user
            ? {
                user_id: user.id,
                tier: user.subscription_tier || 'free',
                allowance_remaining: 5,
              }
            : null,
          error: user ? null : { message: 'No subscription found' },
        })
      }

      return mockQuery
    }),
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  }

  return mockClient
}

// Mock NextRequest
export const createMockRequest = (
  body: unknown = {},
  headers: Record<string, string> = {}
): Request => {
  return {
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(headers),
    url: 'http://localhost:3000/api/test',
    method: 'POST',
  } as unknown as Request
}

// Mock Response helpers
export const createMockResponse = () => {
  return {
    status: 200,
    data: null,
    headers: new Headers(),
  }
}
