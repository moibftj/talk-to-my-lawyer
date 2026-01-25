/**
 * Audit Service Tests
 *
 * Tests the audit logging service for tracking letter state changes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  logLetterAudit,
  logLetterStatusChange,
  logLetterAction,
  type LetterAuditAction,
} from '../audit-service'

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

describe('Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ error: null })
  })

  describe('logLetterAudit', () => {
    it('should log an audit entry successfully', async () => {
      mockRpc.mockResolvedValue({ error: null })

      await logLetterAudit(mockSupabase, {
        letterId: 'letter-123',
        action: 'created',
        oldStatus: null,
        newStatus: 'draft',
        notes: 'Letter created from template',
      })

      expect(mockRpc).toHaveBeenCalledWith('log_letter_audit', {
        p_letter_id: 'letter-123',
        p_action: 'created',
        p_old_status: null,
        p_new_status: 'draft',
        p_notes: 'Letter created from template',
        p_metadata: null,
      })
    })

    it('should log audit with metadata', async () => {
      mockRpc.mockResolvedValue({ error: null })

      const metadata = {
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      }

      await logLetterAudit(mockSupabase, {
        letterId: 'letter-123',
        action: 'approved',
        oldStatus: 'pending_review',
        newStatus: 'approved',
        metadata,
      })

      expect(mockRpc).toHaveBeenCalledWith('log_letter_audit', {
        p_letter_id: 'letter-123',
        p_action: 'approved',
        p_old_status: 'pending_review',
        p_new_status: 'approved',
        p_notes: null,
        p_metadata: metadata,
      })
    })

    it('should throw error when RPC fails', async () => {
      mockRpc.mockResolvedValue({
        error: { message: 'Database connection failed' },
      })

      await expect(
        logLetterAudit(mockSupabase, {
          letterId: 'letter-123',
          action: 'created',
        })
      ).rejects.toThrow('Failed to log audit entry')
    })

    it('should handle all valid audit actions', async () => {
      const validActions: LetterAuditAction[] = [
        'created',
        'updated',
        'submitted',
        'review_started',
        'approved',
        'rejected',
        'resubmitted',
        'completed',
        'deleted',
        'improved',
        'pdf_generated',
        'email_sent',
        'generation_failed',
      ]

      mockRpc.mockResolvedValue({ error: null })

      for (const action of validActions) {
        await logLetterAudit(mockSupabase, {
          letterId: 'letter-123',
          action,
        })
      }

      expect(mockRpc).toHaveBeenCalledTimes(validActions.length)
    })
  })

  describe('logLetterStatusChange', () => {
    it('should log status change with all parameters', async () => {
      mockRpc.mockResolvedValue({ error: null })

      await logLetterStatusChange(
        mockSupabase,
        'letter-123',
        'draft',
        'pending_review',
        'submitted',
        'User submitted for review'
      )

      expect(mockRpc).toHaveBeenCalledWith('log_letter_audit', {
        p_letter_id: 'letter-123',
        p_action: 'submitted',
        p_old_status: 'draft',
        p_new_status: 'pending_review',
        p_notes: 'User submitted for review',
        p_metadata: null,
      })
    })

    it('should log status change without notes', async () => {
      mockRpc.mockResolvedValue({ error: null })

      await logLetterStatusChange(
        mockSupabase,
        'letter-123',
        'pending_review',
        'approved',
        'approved'
      )

      expect(mockRpc).toHaveBeenCalledWith('log_letter_audit', {
        p_letter_id: 'letter-123',
        p_action: 'approved',
        p_old_status: 'pending_review',
        p_new_status: 'approved',
        p_notes: null, // undefined is converted to null by the implementation
        p_metadata: null,
      })
    })

    it('should track approval workflow', async () => {
      mockRpc.mockResolvedValue({ error: null })

      const workflow = [
        { from: 'draft' as const, to: 'pending_review' as const, action: 'submitted' as const },
        { from: 'pending_review' as const, to: 'under_review' as const, action: 'review_started' as const },
        { from: 'under_review' as const, to: 'approved' as const, action: 'approved' as const },
      ]

      for (const step of workflow) {
        await logLetterStatusChange(
          mockSupabase,
          'letter-123',
          step.from,
          step.to,
          step.action
        )
      }

      expect(mockRpc).toHaveBeenCalledTimes(3)
    })

    it('should track rejection workflow', async () => {
      mockRpc.mockResolvedValue({ error: null })

      await logLetterStatusChange(
        mockSupabase,
        'letter-123',
        'pending_review',
        'rejected',
        'rejected',
        'Content needs revision'
      )

      expect(mockRpc).toHaveBeenCalledWith('log_letter_audit', expect.objectContaining({
        p_action: 'rejected',
        p_new_status: 'rejected',
        p_notes: 'Content needs revision',
      }))
    })
  })

  describe('logLetterAction', () => {
    it('should log action without status change', async () => {
      mockRpc.mockResolvedValue({ error: null })

      await logLetterAction(
        mockSupabase,
        'letter-123',
        'pdf_generated',
        'PDF downloaded by user'
      )

      expect(mockRpc).toHaveBeenCalledWith('log_letter_audit', {
        p_letter_id: 'letter-123',
        p_action: 'pdf_generated',
        p_old_status: null,
        p_new_status: null,
        p_notes: 'PDF downloaded by user',
        p_metadata: null,
      })
    })

    it('should log action with metadata', async () => {
      mockRpc.mockResolvedValue({ error: null })

      const metadata = {
        recipient: 'recipient@example.com',
        delivery_method: 'email',
      }

      await logLetterAction(
        mockSupabase,
        'letter-123',
        'email_sent',
        'Letter sent via email',
        metadata
      )

      expect(mockRpc).toHaveBeenCalledWith('log_letter_audit', {
        p_letter_id: 'letter-123',
        p_action: 'email_sent',
        p_old_status: null,
        p_new_status: null,
        p_notes: 'Letter sent via email',
        p_metadata: metadata,
      })
    })

    it('should log action without notes', async () => {
      mockRpc.mockResolvedValue({ error: null })

      await logLetterAction(
        mockSupabase,
        'letter-123',
        'improved'
      )

      expect(mockRpc).toHaveBeenCalledWith('log_letter_audit', {
        p_letter_id: 'letter-123',
        p_action: 'improved',
        p_old_status: null,
        p_new_status: null,
        p_notes: null, // undefined is converted to null by the implementation
        p_metadata: null,
      })
    })

    it('should log generation failure', async () => {
      mockRpc.mockResolvedValue({ error: null })

      const errorMetadata = {
        error_message: 'OpenAI API timeout',
        retry_attempt: 3,
      }

      await logLetterAction(
        mockSupabase,
        'letter-123',
        'generation_failed',
        'Failed after 3 retries',
        errorMetadata
      )

      expect(mockRpc).toHaveBeenCalledWith('log_letter_audit', expect.objectContaining({
        p_action: 'generation_failed',
        p_notes: 'Failed after 3 retries',
        p_metadata: errorMetadata,
      }))
    })
  })

  describe('Letter Audit Action Types', () => {
    it('should support all action types', () => {
      const actions: LetterAuditAction[] = [
        'created',
        'updated',
        'submitted',
        'review_started',
        'approved',
        'rejected',
        'resubmitted',
        'completed',
        'deleted',
        'improved',
        'pdf_generated',
        'email_sent',
        'generation_failed',
      ]

      expect(actions).toHaveLength(13)
      expect(actions).toContain('created')
      expect(actions).toContain('approved')
      expect(actions).toContain('rejected')
      expect(actions).toContain('deleted')
    })
  })
})
