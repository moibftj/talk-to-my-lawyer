/**
 * Letter Audit & Resubmit API Tests
 *
 * Tests letter audit trail retrieval and resubmission workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '../letters/[id]/audit/route'
import { POST } from '../letters/[id]/resubmit/route'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/rate-limit-redis', () => ({
  safeApplyRateLimit: vi.fn(() => Promise.resolve(null)),
  letterGenerationRateLimit: {},
}))

vi.mock('@/lib/config', () => ({
  getRateLimitTuple: vi.fn((key: string) => [100, '1m']),
}))

vi.mock('@/lib/auth/authenticate-user', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/services/allowance-service', () => ({
  checkAndDeductAllowance: vi.fn(),
  refundLetterAllowance: vi.fn(),
}))

vi.mock('@/lib/ai/openai-client', () => ({
  getOpenAIModel: vi.fn(() => ({
    text: 'test model',
  })),
}))

vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/authenticate-user'
import { checkAndDeductAllowance, refundLetterAllowance } from '@/lib/services/allowance-service'
import { generateText } from 'ai'

const mockCreateClient = createClient as any
const mockRequireAuth = requireAuth as any
const mockCheckAndDeductAllowance = checkAndDeductAllowance as any
const mockRefundLetterAllowance = refundLetterAllowance as any
const mockGenerateText = generateText as any

describe('Letter Audit & Resubmit API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/letters/[id]/audit', () => {
    it('should return audit trail for admin user', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@example.com' }
      const mockAuditTrail = [
        {
          id: 'audit-1',
          letter_id: 'letter-123',
          action: 'created',
          old_status: null,
          new_status: 'draft',
          created_at: '2025-01-15T10:00:00Z',
          performer: {
            id: 'user-123',
            email: 'user@example.com',
            full_name: 'Test User',
          },
        },
        {
          id: 'audit-2',
          letter_id: 'letter-123',
          action: 'approved',
          old_status: 'pending_review',
          new_status: 'approved',
          created_at: '2025-01-15T11:00:00Z',
          performer: {
            id: 'admin-123',
            email: 'admin@example.com',
            full_name: 'Admin User',
          },
        },
      ]

      // Create fresh query builders for each from() call
      const createProfilesQuery = () => ({
        select: () => createProfilesQuery(),
        eq: () => createProfilesQuery(),
        single: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
      })

      const createAuditTrailQuery = () => {
        const result = { data: mockAuditTrail, error: null }
        const queryBuilder = {
          select: () => queryBuilder,
          eq: () => queryBuilder,
          order: () => queryBuilder,
          then: (resolve: any) => resolve(result),
          catch: () => queryBuilder,
        }
        return queryBuilder
      }

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'profiles') return createProfilesQuery()
          if (table === 'letter_audit_trail') return createAuditTrailQuery()
          return createProfilesQuery()
        }),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/audit')
      const response = await GET(request as any, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.auditTrail).toHaveLength(2)
      expect(data.auditTrail[0].action).toBe('created')
      expect(data.auditTrail[1].action).toBe('approved')
    })

    it('should return audit trail for employee with relationship', async () => {
      const mockUser = { id: 'emp-123', email: 'emp@example.com' }
      const mockAuditTrail = [
        {
          id: 'audit-1',
          letter_id: 'letter-123',
          action: 'created',
          performer: { id: 'user-123', email: 'user@example.com', full_name: 'User' },
        },
      ]

      let queryCount = 0
      const createQuery = () => {
        const auditResult = { data: mockAuditTrail, error: null }
        const queryBuilder = {
          select: () => queryBuilder,
          eq: () => queryBuilder,
          limit: () => queryBuilder,
          single: () => {
            queryCount++
            if (queryCount === 1) return Promise.resolve({ data: { role: 'employee' }, error: null })
            if (queryCount === 2) return Promise.resolve({ data: { user_id: 'user-123' }, error: null })
            return Promise.resolve({ data: { id: 'sub-123' }, error: null })
          },
          order: () => queryBuilder,
          then: (resolve: any) => resolve(auditResult),
          catch: () => queryBuilder,
        }
        return queryBuilder
      }

      const mockSupabase = {
        from: vi.fn(() => createQuery()),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/audit')
      const response = await GET(request as any, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.auditTrail).toHaveLength(1)
    })

    it('should deny employee access without relationship', async () => {
      const mockUser = { id: 'emp-123', email: 'emp@example.com' }

      let queryCount = 0
      const createQuery = () => {
        const queryBuilder = {
          select: () => queryBuilder,
          eq: () => queryBuilder,
          limit: () => queryBuilder,
          single: () => {
            queryCount++
            if (queryCount === 1) return Promise.resolve({ data: { role: 'employee' }, error: null })
            if (queryCount === 2) return Promise.resolve({ data: { user_id: 'user-123' }, error: null })
            return Promise.resolve({ data: null, error: null }) // No relationship
          },
          order: () => queryBuilder,
        }
        return Object.assign(queryBuilder, Promise.resolve({ data: [], error: null }))
      }

      const mockSupabase = {
        from: vi.fn(() => createQuery()),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/audit')
      const response = await GET(request as any, { params })

      expect(response.status).toBe(403)
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/audit')
      const response = await GET(request as any, { params })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should return empty audit trail for new letter', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@example.com' }

      const createProfilesQuery = () => ({
        select: () => createProfilesQuery(),
        eq: () => createProfilesQuery(),
        single: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
      })

      const createAuditTrailQuery = () => {
        const result = { data: [], error: null }
        const queryBuilder = {
          select: () => queryBuilder,
          eq: () => queryBuilder,
          order: () => queryBuilder,
          then: (resolve: any) => resolve(result),
          catch: () => queryBuilder,
        }
        return queryBuilder
      }

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'profiles') return createProfilesQuery()
          return createAuditTrailQuery()
        }),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/audit')
      const response = await GET(request as any, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.auditTrail).toHaveLength(0)
    })
  })

  describe('POST /api/letters/[id]/resubmit', () => {
    it('should resubmit a rejected letter successfully', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockLetter = {
        id: 'letter-123',
        user_id: 'user-123',
        status: 'rejected',
        rejection_reason: 'Content needs revision',
        ai_draft_content: 'Original content',
        intake_data: { type: 'employment', details: 'Test' },
      }

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockLetter,
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
        rpc: vi.fn().mockResolvedValue({ error: null }),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })
      mockCheckAndDeductAllowance.mockResolvedValue({
        success: true,
        remaining: 4,
        errorMessage: null,
        isFreeTrial: false,
        isSuperAdmin: false,
      })
      mockGenerateText.mockResolvedValue({
        text: 'Improved content based on feedback',
      })

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/resubmit', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as any

      const response = await POST(nextRequest, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('pending_review')
      expect(data.aiDraft).toContain('Improved content')
    })

    it('should only allow resubmit of rejected letters', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockLetter = {
        id: 'letter-123',
        user_id: 'user-123',
        status: 'approved', // Not rejected
      }

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockLetter,
          error: null,
        }),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/resubmit', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as any

      const response = await POST(nextRequest, { params })

      expect(response.status).toBe(400)
    })

    it('should verify letter ownership', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null, // Letter not found
          error: { message: 'Not found' },
        }),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })

      const params = Promise.resolve({ id: 'letter-999' })
      const request = new Request('http://localhost:3000/api/letters/letter-999/resubmit', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as any

      const response = await POST(nextRequest, { params })

      expect(response.status).toBe(404)
    })

    it('should check and deduct allowance', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockLetter = {
        id: 'letter-123',
        user_id: 'user-123',
        status: 'rejected',
        rejection_reason: 'Needs work',
        ai_draft_content: 'Original',
        intake_data: {},
      }

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockLetter,
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
        rpc: vi.fn().mockResolvedValue({ error: null }),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })
      mockCheckAndDeductAllowance.mockResolvedValue({
        success: true,
        remaining: 4,
        errorMessage: null,
        isFreeTrial: false,
        isSuperAdmin: false,
      })
      mockGenerateText.mockResolvedValue({
        text: 'Improved content',
      })

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/resubmit', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as any

      const response = await POST(nextRequest, { params })

      expect(mockCheckAndDeductAllowance).toHaveBeenCalledWith('user-123')
      expect(response.status).toBe(200)
    })

    it('should reject when insufficient allowance', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockLetter = {
        id: 'letter-123',
        user_id: 'user-123',
        status: 'rejected',
      }

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockLetter,
          error: null,
        }),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })
      mockCheckAndDeductAllowance.mockResolvedValue({
        success: false,
        remaining: 0,
        errorMessage: 'No credits remaining',
        isFreeTrial: false,
        isSuperAdmin: false,
      })

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/resubmit', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as any

      const response = await POST(nextRequest, { params })

      expect(response.status).toBe(403)
    })

    it('should refund allowance on generation failure', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockLetter = {
        id: 'letter-123',
        user_id: 'user-123',
        status: 'rejected',
        rejection_reason: 'Needs work',
        ai_draft_content: 'Original',
        intake_data: {},
      }

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockLetter,
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
        rpc: vi.fn().mockResolvedValue({ error: null }),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })
      mockCheckAndDeductAllowance.mockResolvedValue({
        success: true,
        remaining: 4,
        errorMessage: null,
        isFreeTrial: false,
        isSuperAdmin: false,
      })
      mockGenerateText.mockRejectedValue(new Error('AI service unavailable'))
      mockRefundLetterAllowance.mockResolvedValue({ success: true })

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/resubmit', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as any

      const response = await POST(nextRequest, { params })

      expect(mockRefundLetterAllowance).toHaveBeenCalledWith('user-123', 1)
      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it('should log audit trail for resubmission', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' }
      const mockLetter = {
        id: 'letter-123',
        user_id: 'user-123',
        status: 'rejected',
        rejection_reason: 'Needs work',
        ai_draft_content: 'Original',
        intake_data: {},
      }

      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockLetter,
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
        rpc: vi.fn().mockResolvedValue({ error: null }),
      }

      mockRequireAuth.mockResolvedValue({ user: mockUser, supabase: mockSupabase })
      mockCheckAndDeductAllowance.mockResolvedValue({
        success: true,
        remaining: 4,
        errorMessage: null,
        isFreeTrial: false,
        isSuperAdmin: false,
      })
      mockGenerateText.mockResolvedValue({
        text: 'Improved content',
      })

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/resubmit', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as any

      await POST(nextRequest, { params })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('log_letter_audit', expect.objectContaining({
        p_action: 'resubmitted',
        p_old_status: 'rejected',
        p_new_status: 'pending_review',
      }))
    })

    it('should require authentication', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))

      const params = Promise.resolve({ id: 'letter-123' })
      const request = new Request('http://localhost:3000/api/letters/letter-123/resubmit', {
        method: 'POST',
      })
      const nextRequest = {
        ...request,
        json: () => Promise.resolve({}),
      } as any

      const response = await POST(nextRequest, { params })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })
})
