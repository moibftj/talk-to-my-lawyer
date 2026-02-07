/**
 * Admin Analytics & Coupon API Tests
 *
 * Tests admin analytics endpoint and coupon management API routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '../admin/analytics/route'
import { POST, PATCH } from '../admin/coupons/create/route'

// Helper to create a Next.js-compatible request
function createNextRequest(url: string, options?: RequestInit): any {
  const request = new Request(url, options) as any
  request.nextUrl = new URL(url)
  return request
}

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/rate-limit-redis', () => ({
  safeApplyRateLimit: vi.fn(() => Promise.resolve(null)),
  adminRateLimit: {},
}))

vi.mock('@/lib/config', () => ({
  getRateLimitTuple: vi.fn((key: string) => [100, '1m']),
}))

vi.mock('@/lib/admin/letter-actions', () => ({
  validateSystemAdminAction: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@/lib/auth/admin-session', () => ({
  requireSuperAdminAuth: vi.fn(() => Promise.resolve(undefined)),
}))

import { createClient } from '@/lib/supabase/server'
import { validateSystemAdminAction } from '@/lib/admin/letter-actions'
import { requireSuperAdminAuth } from '@/lib/auth/admin-session'

const mockCreateClient = createClient as any
const mockValidateSystemAdminAction = validateSystemAdminAction as any
const mockRequireSuperAdminAuth = requireSuperAdminAuth as any

describe('Admin Analytics & Coupon API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/analytics', () => {
    it('should return analytics data for super admin', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((fnName) => {
          const responses: Record<string, { data: any; error: null }> = {
            'get_admin_dashboard_stats': {
              data: [{
                total_users: 150,
                total_subscribers: 75,
                total_employees: 5,
                pending_letters: 10,
                approved_letters_today: 25,
                total_revenue: 15000,
                pending_commissions: 500,
              }],
              error: null,
            },
            'get_letter_statistics': {
              data: [{
                total_letters: 500,
                pending_count: 10,
                approved_count: 450,
                rejected_count: 30,
                failed_count: 10,
                avg_review_time_hours: 2.5,
              }],
              error: null,
            },
            'get_subscription_analytics': {
              data: [{
                active_subscriptions: 75,
                monthly_subscriptions: 50,
                yearly_subscriptions: 20,
                one_time_purchases: 5,
                total_credits_remaining: 300,
                avg_credits_per_user: 4,
              }],
              error: null,
            },
            'get_revenue_summary': {
              data: [
                { month: '2025-01', revenue: 5000 },
                { month: '2024-12', revenue: 4500 },
                { month: '2024-11', revenue: 4000 },
              ],
              error: null,
            },
          }
          return Promise.resolve(responses[fnName] || { data: null, error: null })
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = createNextRequest('http://localhost:3000/api/admin/analytics')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.dashboard.total_users).toBe(150)
      expect(data.data.letters.total_letters).toBe(500)
      expect(data.data.subscriptions.active_subscriptions).toBe(75)
      expect(data.data.revenue).toHaveLength(3)
    })

    it('should support custom days and months parameters', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: [{ total_letters: 100 }],
          error: null,
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = createNextRequest('http://localhost:3000/api/admin/analytics?days=7&months=3')
      await GET(request)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_letter_statistics', { days_back: 7 })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_revenue_summary', { months_back: 3 })
    })

    it('should use default values when parameters are missing', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: [{}],
          error: null,
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = createNextRequest('http://localhost:3000/api/admin/analytics')
      await GET(request)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_letter_statistics', { days_back: 30 })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_revenue_summary', { months_back: 12 })
    })

    it('should handle RPC errors gracefully', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = createNextRequest('http://localhost:3000/api/admin/analytics')
      const response = await GET(request)
      const data = await response.json()

      // Should return default empty values when RPC fails
      expect(response.status).toBe(200)
      expect(data.data.dashboard.total_users).toBe(0)
      expect(data.data.letters.total_letters).toBe(0)
    })
  })

  describe('POST /api/admin/coupons/create', () => {
    it('should create a new promo coupon', async () => {
      const mockCoupon = {
        id: 'coupon-123',
        code: 'PROMOABC123',
        discount_percent: 20,
        is_active: true,
        created_at: '2025-01-01',
      }

      // Proper query builder chain mock
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: mockCoupon,
                error: null,
              }),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'admin-123' } },
            error: null,
          }),
        },
      } as any

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/admin/coupons/create', {
        method: 'POST',
        body: JSON.stringify({
          discountPercent: 20,
          description: 'Spring sale',
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          discountPercent: 20,
          description: 'Spring sale',
        }),
      } as any

      const response = await POST(nextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.coupon.discount_percent).toBe(20)
    })

    it('should validate discount percent range', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'admin-123' } },
            error: null,
          }),
        },
      } as any

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/admin/coupons/create', {
        method: 'POST',
        body: JSON.stringify({
          discountPercent: 150, // Invalid: > 100
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({ discountPercent: 150 }),
      } as any

      const response = await POST(nextRequest)

      expect(response.status).toBe(400)
    })

    it('should reject zero discount percent', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'admin-123' } },
            error: null,
          }),
        },
      } as any

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/admin/coupons/create', {
        method: 'POST',
        body: JSON.stringify({
          discountPercent: 0,
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({ discountPercent: 0 }),
      } as any

      const response = await POST(nextRequest)

      expect(response.status).toBe(400)
    })

    it('should check for existing coupon codes', async () => {
      const existingCoupon = {
        id: 'existing-coupon',
        code: 'EXISTING',
      }

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: existingCoupon,
                error: null,
              }),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'admin-123' } },
            error: null,
          }),
        },
      } as any

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/admin/coupons/create', {
        method: 'POST',
        body: JSON.stringify({
          code: 'EXISTING',
          discountPercent: 15,
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          code: 'EXISTING',
          discountPercent: 15,
        }),
      } as any

      const response = await POST(nextRequest)

      expect(response.status).toBe(409)
    })

    it('should generate code if not provided', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'coupon-123',
                  code: 'PROMOXYZ789',
                  discount_percent: 25,
                },
                error: null,
              }),
            })),
          })),
        })),
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'admin-123' } },
            error: null,
          }),
        },
      } as any

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/admin/coupons/create', {
        method: 'POST',
        body: JSON.stringify({
          discountPercent: 25,
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({ discountPercent: 25 }),
      } as any

      const response = await POST(nextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.coupon.code).toBeTruthy()
      expect(data.coupon.code.length).toBeGreaterThan(4)
    })
  })

  describe('PATCH /api/admin/coupons/create (toggle active)', () => {
    it('should activate a coupon', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'coupon-123',
                    code: 'PROMO',
                    is_active: true,
                  },
                  error: null,
                }),
              })),
            })),
          })),
        })),
      } as any

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/admin/coupons/create', {
        method: 'PATCH',
        body: JSON.stringify({
          couponId: 'coupon-123',
          isActive: true,
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          couponId: 'coupon-123',
          isActive: true,
        }),
      } as any

      const response = await PATCH(nextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('activated')
    })

    it('should deactivate a coupon', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'coupon-123',
                    code: 'PROMO',
                    is_active: false,
                  },
                  error: null,
                }),
              })),
            })),
          })),
        })),
      } as any

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/admin/coupons/create', {
        method: 'PATCH',
        body: JSON.stringify({
          couponId: 'coupon-123',
          isActive: false,
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({
          couponId: 'coupon-123',
          isActive: false,
        }),
      } as any

      const response = await PATCH(nextRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toContain('deactivated')
    })

    it('should require couponId', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              })),
            })),
          })),
        })),
      } as any

      mockCreateClient.mockResolvedValue(mockSupabase)

      const request = new Request('http://localhost:3000/api/admin/coupons/create', {
        method: 'PATCH',
        body: JSON.stringify({
          isActive: true,
        }),
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({ isActive: true }),
      } as any

      const response = await PATCH(nextRequest)

      expect(response.status).toBe(400)
    })
  })
})
