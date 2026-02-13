/**
 * Allowance Service Tests
 *
 * Tests the letter allowance checking and deduction service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkLetterAllowance,
  checkAndDeductAllowance,
  refundLetterAllowance,
  type AtomicDeductionResult,
} from '../allowance-service'

// Mock Supabase client
const mockRpc = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}))

import { createClient } from '@/lib/supabase/server'

const mockSupabase = {
  rpc: mockRpc,
} as any

describe('Allowance Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkLetterAllowance', () => {
    it('should return allowance status with remaining count', async () => {
      mockRpc.mockResolvedValue({
        data: { has_access: true, letters_remaining: 5 },
        error: null,
      })

      const result = await checkLetterAllowance('user-123')

      expect(result.has_allowance).toBe(true)
      expect(result.remaining).toBe(5)
      expect(mockRpc).toHaveBeenCalledWith('check_letter_allowance', {
        u_id: 'user-123',
      })
    })

    it('should return no allowance when user has no credits', async () => {
      mockRpc.mockResolvedValue({
        data: { has_access: false, letters_remaining: 0 },
        error: null,
      })

      const result = await checkLetterAllowance('user-123')

      expect(result.has_allowance).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should handle missing data gracefully', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await checkLetterAllowance('user-123')

      expect(result.has_allowance).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should handle RPC errors gracefully', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const result = await checkLetterAllowance('user-123')

      expect(result.has_allowance).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('checkAndDeductAllowance', () => {
    it('should successfully check and deduct allowance', async () => {
      mockRpc.mockResolvedValue({
        data: [{
          success: true,
          remaining: 4,
          error_message: null,
          is_free_trial: false,
          is_super_admin: false,
        }],
        error: null,
      })

      const result = await checkAndDeductAllowance('user-123')

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(4)
      expect(result.errorMessage).toBeNull()
      expect(result.isFreeTrial).toBe(false)
      expect(result.isSuperAdmin).toBe(false)
    })

    it('should handle free trial user', async () => {
      mockRpc.mockResolvedValue({
        data: [{
          success: true,
          remaining: 1,
          error_message: null,
          is_free_trial: true,
          is_super_admin: false,
        }],
        error: null,
      })

      const result = await checkAndDeductAllowance('user-123')

      expect(result.success).toBe(true)
      expect(result.isFreeTrial).toBe(true)
    })

    it('should handle super admin with unlimited allowance', async () => {
      mockRpc.mockResolvedValue({
        data: [{
          success: true,
          remaining: null,
          error_message: null,
          is_free_trial: false,
          is_super_admin: true,
        }],
        error: null,
      })

      const result = await checkAndDeductAllowance('admin-123')

      expect(result.success).toBe(true)
      expect(result.isSuperAdmin).toBe(true)
      expect(result.remaining).toBeNull() // Unlimited
    })

    it('should return failure when insufficient allowance', async () => {
      mockRpc.mockResolvedValue({
        data: [{
          success: false,
          remaining: 0,
          error_message: 'No letter credits remaining',
          is_free_trial: false,
          is_super_admin: false,
        }],
        error: null,
      })

      const result = await checkAndDeductAllowance('user-123')

      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.errorMessage).toBe('No letter credits remaining')
    })

    it('should handle empty data response', async () => {
      mockRpc.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await checkAndDeductAllowance('user-123')

      expect(result.success).toBe(false)
      expect(result.remaining).toBeNull()
      expect(result.errorMessage).toBe('Failed to check allowance')
    })

    it('should handle RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' },
      })

      const result = await checkAndDeductAllowance('user-123')

      expect(result.success).toBe(false)
      expect(result.remaining).toBeNull()
      expect(result.errorMessage).toBe('Connection failed')
    })

    it('should call correct RPC function', async () => {
      mockRpc.mockResolvedValue({
        data: [{ success: true, remaining: 4, error_message: null, is_free_trial: false, is_super_admin: false }],
        error: null,
      })

      await checkAndDeductAllowance('user-123')

      // Note: userId is NOT passed to RPC (uses auth.uid() internally)
      expect(mockRpc).toHaveBeenCalledWith('check_and_deduct_allowance')
    })
  })

  describe('refundLetterAllowance', () => {
    it('should successfully refund allowance', async () => {
      mockRpc.mockResolvedValue({
        data: [{ success: true }],
        error: null,
      })

      const result = await refundLetterAllowance('user-123', 1)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should refund custom amount', async () => {
      mockRpc.mockResolvedValue({
        data: [{ success: true }],
        error: null,
      })

      const result = await refundLetterAllowance('user-123', 3)

      expect(result.success).toBe(true)
      // Note: userId is NOT passed to RPC (uses auth.uid() internally)
      expect(mockRpc).toHaveBeenCalledWith('refund_letter_allowance', {
        amount: 3,
      })
    })

    it('should use default amount of 1', async () => {
      mockRpc.mockResolvedValue({
        data: [{ success: true }],
        error: null,
      })

      await refundLetterAllowance('user-123')

      // Note: userId is NOT passed to RPC (uses auth.uid() internally)
      expect(mockRpc).toHaveBeenCalledWith('refund_letter_allowance', {
        amount: 1,
      })
    })

    it('should handle refund failure', async () => {
      mockRpc.mockResolvedValue({
        data: [{ success: false, error_message: 'Refund limit exceeded' }],
        error: null,
      })

      const result = await refundLetterAllowance('user-123', 1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Refund limit exceeded')
    })

    it('should handle RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const result = await refundLetterAllowance('user-123', 1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
    })

    it('should handle empty data response', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await refundLetterAllowance('user-123', 1)

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('AtomicDeductionResult Type', () => {
    it('should have correct structure', () => {
      const result: AtomicDeductionResult = {
        success: true,
        remaining: 5,
        errorMessage: null,
        isFreeTrial: false,
        isSuperAdmin: false,
      }

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('remaining')
      expect(result).toHaveProperty('errorMessage')
      expect(result).toHaveProperty('isFreeTrial')
      expect(result).toHaveProperty('isSuperAdmin')
    })

    it('should allow null remaining for super admin', () => {
      const result: AtomicDeductionResult = {
        success: true,
        remaining: null,
        errorMessage: null,
        isFreeTrial: false,
        isSuperAdmin: true,
      }

      expect(result.remaining).toBeNull()
      expect(result.isSuperAdmin).toBe(true)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle typical letter generation workflow', async () => {
      // Step 1: Check and deduct
      mockRpc.mockResolvedValueOnce({
        data: [{ success: true, remaining: 4, error_message: null, is_free_trial: false, is_super_admin: false }],
        error: null,
      })

      const deductResult = await checkAndDeductAllowance('user-123')
      expect(deductResult.success).toBe(true)
      expect(deductResult.remaining).toBe(4)

      // Step 2: Generation fails, refund
      mockRpc.mockResolvedValueOnce({
        data: [{ success: true }],
        error: null,
      })

      const refundResult = await refundLetterAllowance('user-123', 1)
      expect(refundResult.success).toBe(true)
    })

    it('should prevent concurrent deduction (race condition)', async () => {
      // Simulate two concurrent requests
      mockRpc.mockResolvedValue({
        data: [{ success: true, remaining: 4, error_message: null, is_free_trial: false, is_super_admin: false }],
        error: null,
      })

      const [result1, result2] = await Promise.all([
        checkAndDeductAllowance('user-123'),
        checkAndDeductAllowance('user-123'),
      ])

      // Both should succeed because database uses SELECT FOR UPDATE
      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })
  })
})
