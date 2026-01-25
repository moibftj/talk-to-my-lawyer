/**
 * Subscription & Allowance API Tests
 *
 * Tests subscription management, allowance checking, and billing history
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, GET } from '../subscriptions/check-allowance/route'
import { POST as ActivatePOST } from '../subscriptions/activate/route'
import { GET as BillingGET } from '../subscriptions/billing-history/route'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/rate-limit-redis', () => ({
  safeApplyRateLimit: vi.fn(() => Promise.resolve(null)),
  apiRateLimit: {},
  authRateLimit: {},
  subscriptionRateLimit: {},
}))

vi.mock('@/lib/config', () => ({
  getRateLimitTuple: vi.fn((key: string) => [100, '1m']),
}))

vi.mock('@/lib/auth/authenticate-user', () => ({
  requireAuth: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/authenticate-user'
import { AuthenticationError } from '@/lib/api/api-error-handler'

const mockCreateClient = createClient as any
const mockRequireAuth = requireAuth as any

// Helper to create a Supabase query chain mock
function createMockQueryBuilder<T>(result: T) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    like: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    range: vi.fn(() => chain),
  }
  return {
    from: vi.fn(() => chain),
    rpc: vi.fn(() => Promise.resolve(result)),
    ...chain,
  }
}

describe('Subscription & Allowance API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/subscriptions/check-allowance', () => {
    it('should return allowance status for authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockAllowance = { has_allowance: true, remaining: 5 }

      mockRequireAuth.mockResolvedValue({ user: mockUser })

      // Mock checkLetterAllowance from allowance-service
      const allowanceService = await import('@/lib/services/allowance-service')
      vi.spyOn(allowanceService, 'checkLetterAllowance').mockResolvedValue(mockAllowance)

      const request = new Request('http://localhost:3000/api/subscriptions/check-allowance')
      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.hasAllowance).toBe(true)
      expect(data.remaining).toBe(5)
    })

    it('should return no allowance when user has no credits', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockAllowance = { has_allowance: false, remaining: 0 }

      mockRequireAuth.mockResolvedValue({ user: mockUser })

      const allowanceService = await import('@/lib/services/allowance-service')
      vi.spyOn(allowanceService, 'checkLetterAllowance').mockResolvedValue(mockAllowance)

      const request = new Request('http://localhost:3000/api/subscriptions/check-allowance')
      const response = await GET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.hasAllowance).toBe(false)
      expect(data.remaining).toBe(0)
    })

    it('should handle RPC errors gracefully', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }

      mockRequireAuth.mockResolvedValue({ user: mockUser })

      const allowanceService = await import('@/lib/services/allowance-service')
      vi.spyOn(allowanceService, 'checkLetterAllowance').mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = new Request('http://localhost:3000/api/subscriptions/check-allowance')
      const response = await GET(request as any)

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockRejectedValue(new AuthenticationError())

      const request = new Request('http://localhost:3000/api/subscriptions/check-allowance')
      const response = await GET(request as any)

      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/subscriptions/activate', () => {
    it('should activate a valid subscription', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockSubscription = {
        id: 'sub-123',
        user_id: 'user-123',
        status: 'pending',
      }

      const chainResult = {
        data: mockSubscription,
        error: null,
      }

      // Create a proper chain mock for .from().select().eq().eq().single()
      const singleMock = vi.fn().mockResolvedValue(chainResult)
      const eq2Mock = vi.fn(() => ({ single: singleMock }))
      const eq1Mock = vi.fn(() => ({ eq: eq2Mock }))
      const selectMock = vi.fn(() => ({ eq: eq1Mock }))
      const fromMock = vi.fn(() => ({ select: selectMock }))

      // Update chain
      const updateEqMock = vi.fn().mockResolvedValue({ error: null })
      const updateMock = vi.fn(() => ({ eq: updateEqMock }))

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: fromMock,
      }

      // Make the update work properly
      fromMock.mockImplementation((table: string) => {
        if (table === 'subscriptions') {
          return {
            select: selectMock,
            update: updateMock,
          }
        }
        return { select: selectMock }
      })

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/subscriptions/activate', {
        method: 'POST',
        body: JSON.stringify({
          subscriptionId: 'sub-123',
          planType: 'annual',
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({ subscriptionId: 'sub-123', planType: 'annual' }),
      } as any

      const response = await ActivatePOST(nextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toContain('activated successfully')
      expect(data.subscriptionId).toBe('sub-123')
    })

    it('should reject activation with missing parameters', async () => {
      const mockUser = { id: 'user-123' }
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/subscriptions/activate', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as any

      const response = await ActivatePOST(nextRequest)

      expect(response.status).toBe(400)
    })

    it('should verify subscription belongs to user', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }

      const chainResult = {
        data: null,
        error: { message: 'Not found' },
      }

      const singleMock = vi.fn().mockResolvedValue(chainResult)
      const eq2Mock = vi.fn(() => ({ single: singleMock }))
      const eq1Mock = vi.fn(() => ({ eq: eq2Mock }))
      const selectMock = vi.fn(() => ({ eq: eq1Mock }))
      const fromMock = vi.fn(() => ({ select: selectMock }))

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: fromMock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/subscriptions/activate', {
        method: 'POST',
        body: JSON.stringify({
          subscriptionId: 'sub-999',
          planType: 'professional',
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          subscriptionId: 'sub-999',
          planType: 'professional',
        }),
      } as any

      const response = await ActivatePOST(nextRequest)

      expect(response.status).toBe(404)
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

      const request = new Request('http://localhost:3000/api/subscriptions/activate', {
        method: 'POST',
        body: JSON.stringify({
          subscriptionId: 'sub-123',
          planType: 'annual',
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          subscriptionId: 'sub-123',
          planType: 'professional',
        }),
      } as any

      const response = await ActivatePOST(nextRequest)

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/subscriptions/billing-history', () => {
    it('should return billing history for authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockSubscriptions = [
        {
          id: 'sub-1',
          user_id: 'user-123',
          plan_type: 'professional',
          price: 99,
          discount: 10,
          coupon_code: 'SAVE10',
          status: 'active',
          credits_remaining: 5,
          stripe_subscription_id: 'stripe-123',
          current_period_start: '2025-01-01',
          current_period_end: '2025-02-01',
          created_at: '2025-01-01',
        },
      ]

      const orderMock = vi.fn().mockResolvedValue({
        data: mockSubscriptions,
        error: null,
      })
      const eqMock = vi.fn(() => ({ order: orderMock }))
      const selectMock = vi.fn(() => ({ eq: eqMock }))
      const fromMock = vi.fn(() => ({ select: selectMock }))

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: fromMock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/subscriptions/billing-history')
      const response = await BillingGET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.history).toHaveLength(1)
      expect(data.data.summary.totalTransactions).toBe(1)
      expect(data.data.summary.totalSpent).toBe(89) // 99 - 10
      expect(data.data.summary.totalDiscounts).toBe(10)
    })

    it('should calculate summary correctly', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockSubscriptions = [
        {
          id: 'sub-1',
          plan_type: 'professional',
          price: 99,
          discount: 10,
          coupon_code: 'SAVE10',
          status: 'active',
          credits_remaining: 5,
          created_at: '2025-01-01',
        },
        {
          id: 'sub-2',
          plan_type: 'monthly',
          price: 49,
          discount: 0,
          coupon_code: null,
          status: 'active',
          credits_remaining: 3,
          created_at: '2024-12-01',
        },
      ]

      const orderMock = vi.fn().mockResolvedValue({
        data: mockSubscriptions,
        error: null,
      })
      const eqMock = vi.fn(() => ({ order: orderMock }))
      const selectMock = vi.fn(() => ({ eq: eqMock }))
      const fromMock = vi.fn(() => ({ select: selectMock }))

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: fromMock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/subscriptions/billing-history')
      const response = await BillingGET(request as any)
      const data = await response.json()

      expect(data.data.summary.totalTransactions).toBe(2)
      expect(data.data.summary.totalSpent).toBe(138) // (99-10) + 49
      expect(data.data.summary.totalDiscounts).toBe(10)
    })

    it('should handle empty billing history', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }

      const orderMock = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })
      const eqMock = vi.fn(() => ({ order: orderMock }))
      const selectMock = vi.fn(() => ({ eq: eqMock }))
      const fromMock = vi.fn(() => ({ select: selectMock }))

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: fromMock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/subscriptions/billing-history')
      const response = await BillingGET(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.history).toHaveLength(0)
      expect(data.data.summary.totalTransactions).toBe(0)
      expect(data.data.summary.totalSpent).toBe(0)
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

      const request = new Request('http://localhost:3000/api/subscriptions/billing-history')
      const response = await BillingGET(request as any)

      expect(response.status).toBe(401)
    })

    it('should format plan types correctly', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockSubscriptions = [
        {
          id: 'sub-1',
          plan_type: 'monthly',
          price: 49,
          discount: 0,
          status: 'active',
          credits_remaining: 3,
          created_at: '2025-01-01',
        },
        {
          id: 'sub-2',
          plan_type: 'yearly',
          price: 499,
          discount: 0,
          status: 'active',
          credits_remaining: 50,
          created_at: '2025-01-02',
        },
        {
          id: 'sub-3',
          plan_type: 'one_time',
          price: 29,
          discount: 0,
          status: 'active',
          credits_remaining: 1,
          created_at: '2025-01-03',
        },
      ]

      const orderMock = vi.fn().mockResolvedValue({
        data: mockSubscriptions,
        error: null,
      })
      const eqMock = vi.fn(() => ({ order: orderMock }))
      const selectMock = vi.fn(() => ({ eq: eqMock }))
      const fromMock = vi.fn(() => ({ select: selectMock }))

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: fromMock,
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/subscriptions/billing-history')
      const response = await BillingGET(request as any)
      const data = await response.json()

      expect(data.data.history[0].description).toBe('Monthly Subscription')
      expect(data.data.history[1].description).toBe('Yearly Subscription')
      expect(data.data.history[2].description).toBe('One-Time Purchase')
    })
  })
})
