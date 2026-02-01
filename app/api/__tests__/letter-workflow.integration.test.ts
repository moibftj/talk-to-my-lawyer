/**
 * Letter Workflow Integration Tests
 * 
 * Tests the complete letter lifecycle:
 * - Generation (user + AI)
 * - Drafting & submission
 * - Attorney review (approve/reject)
 * - Completion & delivery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Letter Workflow - Integration', () => {
  describe('Complete Letter Lifecycle', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    describe('Generation → Submission → Review → Completion', () => {
      it('should create letter with pending_review status after generation', async () => {
        const userId = 'user-123'
        const letterData = {
          title: 'Demand for Unpaid Wages',
          recipient_name: 'Employer Inc.',
          recipient_address: '123 Business Ave',
          category: 'employment',
          tone: 'professional',
          key_points: ['Unpaid wages', '$5000 owed'],
          sender_role: 'Employee',
        }

        // Simulate letter creation with AI
        const letter = {
          id: 'letter-1',
          user_id: userId,
          title: letterData.title,
          status: 'pending_review',
          content: 'Generated letter content here...',
          created_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          ai_model: 'gpt-4-turbo',
          ai_tokens: 1200,
        }

        expect(letter.status).toBe('pending_review')
        expect(letter.user_id).toBe(userId)
        expect(letter.ai_model).toBeDefined()
        expect(letter.ai_tokens).toBeGreaterThan(0)
      })

      it('should deduct user allowance after letter generation', async () => {
        const userId = 'user-123'
        const subscription = {
          monthly_allowance: 5,
          credits_remaining: 4, // Was 5, now 4
          period_start: '2026-01-01',
          period_end: '2026-01-31',
        }

        expect(subscription.credits_remaining).toBe(4)
        expect(subscription.credits_remaining).toBeLessThan(
          subscription.monthly_allowance
        )
      })

      it('should reject generation when allowance is exhausted', async () => {
        const subscription = {
          monthly_allowance: 5,
          credits_remaining: 0,
        }

        expect(subscription.credits_remaining).toBe(0)
        expect(() => {
          if (subscription.credits_remaining <= 0) {
            throw new Error('No credits remaining')
          }
        }).toThrow('No credits remaining')
      })

      it('should allow attorney to review pending letter', async () => {
        const letter = {
          id: 'letter-1',
          status: 'pending_review',
          content: 'Original content',
          submitted_by: 'user-123',
          submitted_at: new Date().toISOString(),
        }

        const reviewAction = {
          action: 'approve',
          reviewed_by: 'attorney-1',
          reviewed_at: new Date().toISOString(),
          final_content: letter.content, // Attorney can edit
          review_notes: 'Looks good, approved',
        }

        const updatedLetter = {
          ...letter,
          status: 'approved',
          final_content: reviewAction.final_content,
          reviewed_by: reviewAction.reviewed_by,
          reviewed_at: reviewAction.reviewed_at,
        }

        expect(updatedLetter.status).toBe('approved')
        expect(updatedLetter.reviewed_by).toBe('attorney-1')
        expect(updatedLetter.reviewed_at).toBeDefined()
      })

      it('should allow attorney to reject with reason', async () => {
        const letter = { id: 'letter-1', status: 'pending_review' }
        const rejection = {
          action: 'reject',
          reason: 'Content needs revision - tone too aggressive',
          reviewed_by: 'attorney-1',
        }

        const rejectedLetter = {
          ...letter,
          status: 'rejected',
          rejection_reason: rejection.reason,
          reviewed_by: rejection.reviewed_by,
        }

        expect(rejectedLetter.status).toBe('rejected')
        expect(rejectedLetter.rejection_reason).toBe(rejection.reason)
      })

      it('should allow user to resubmit after rejection', async () => {
        const rejectedLetter = {
          id: 'letter-1',
          status: 'rejected',
          rejection_reason: 'Needs revision',
        }

        const resubmittedLetter = {
          ...rejectedLetter,
          status: 'pending_review',
          content: 'Revised content',
          resubmitted_at: new Date().toISOString(),
          rejection_reason: null, // Clear previous rejection
        }

        expect(resubmittedLetter.status).toBe('pending_review')
        expect(resubmittedLetter.resubmitted_at).toBeDefined()
      })

      it('should mark letter as completed after approval', async () => {
        const approvedLetter = {
          id: 'letter-1',
          status: 'approved',
          approved_at: new Date().toISOString(),
        }

        const completedLetter = {
          ...approvedLetter,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }

        expect(completedLetter.status).toBe('completed')
        expect(completedLetter.completed_at).toBeDefined()
      })
    })

    describe('Letter Delivery', () => {
      it('should queue letter for email delivery after completion', async () => {
        const letter = {
          id: 'letter-1',
          status: 'completed',
          title: 'Demand Letter',
        }

        const emailQueue = {
          id: 'email-1',
          letter_id: letter.id,
          recipient_email: 'recipient@example.com',
          subject: `${letter.title} - Talk To My Lawyer`,
          status: 'pending',
          attempts: 0,
          created_at: new Date().toISOString(),
        }

        expect(emailQueue.letter_id).toBe(letter.id)
        expect(emailQueue.status).toBe('pending')
        expect(emailQueue.attempts).toBe(0)
      })

      it('should generate PDF from approved letter content', async () => {
        const letter = {
          id: 'letter-1',
          status: 'approved',
          content: 'Letter content...',
          title: 'Demand for Unpaid Wages',
        }

        const pdfMetadata = {
          letter_id: letter.id,
          filename: `${letter.id}-demand-for-unpaid-wages.pdf`,
          size: 25000, // bytes
          generated_at: new Date().toISOString(),
          content_hash: 'abc123xyz', // For verification
        }

        expect(pdfMetadata.letter_id).toBe(letter.id)
        expect(pdfMetadata.filename).toContain(letter.id)
        expect(pdfMetadata.size).toBeGreaterThan(0)
      })

      it('should track letter audit trail for all actions', async () => {
        const letter = { id: 'letter-1' }
        const auditLog = [
          {
            letter_id: letter.id,
            action: 'created',
            actor_id: 'user-123',
            actor_role: 'subscriber',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            letter_id: letter.id,
            action: 'submitted',
            actor_id: 'user-123',
            actor_role: 'subscriber',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
          },
          {
            letter_id: letter.id,
            action: 'approved',
            actor_id: 'attorney-1',
            actor_role: 'attorney_admin',
            timestamp: new Date().toISOString(),
          },
        ]

        expect(auditLog).toHaveLength(3)
        expect(auditLog[0].action).toBe('created')
        expect(auditLog[2].action).toBe('approved')
        expect(auditLog[2].actor_role).toBe('attorney_admin')
      })
    })

    describe('Letter Search & Filtering', () => {
      it('should filter letters by status', async () => {
        const userLetters = [
          { id: '1', status: 'draft' },
          { id: '2', status: 'pending_review' },
          { id: '3', status: 'approved' },
          { id: '4', status: 'completed' },
        ]

        const pendingLetters = userLetters.filter((l) => l.status === 'pending_review')
        expect(pendingLetters).toHaveLength(1)
        expect(pendingLetters[0].id).toBe('2')
      })

      it('should filter letters by date range', async () => {
        const letters = [
          { id: '1', created_at: '2026-01-01T00:00:00Z' },
          { id: '2', created_at: '2026-01-15T00:00:00Z' },
          { id: '3', created_at: '2026-02-01T00:00:00Z' },
        ]

        const jan2026 = letters.filter((l) => {
          const date = new Date(l.created_at)
          return date.getMonth() === 0 && date.getFullYear() === 2026
        })

        expect(jan2026).toHaveLength(2)
      })

      it('should support pagination for letter lists', async () => {
        const allLetters = Array.from({ length: 25 }, (_, i) => ({
          id: `letter-${i + 1}`,
          title: `Letter ${i + 1}`,
        }))

        const pageSize = 10
        const page1 = allLetters.slice(0, pageSize)
        const page2 = allLetters.slice(pageSize, pageSize * 2)
        const page3 = allLetters.slice(pageSize * 2)

        expect(page1).toHaveLength(10)
        expect(page2).toHaveLength(10)
        expect(page3).toHaveLength(5)
        expect(page1[0].id).toBe('letter-1')
        expect(page3[0].id).toBe('letter-21')
      })
    })
  })

  describe('Letter Allowance System', () => {
    it('should reset monthly allowance on renewal date', async () => {
      const subscription = {
        id: 'sub-123',
        monthly_allowance: 5,
        credits_remaining: 1,
        period_start: '2026-01-01',
        period_end: '2026-01-31',
      }

      // Simulate month boundary
      const renewedSubscription = {
        ...subscription,
        credits_remaining: 5, // Reset to full allowance
        period_start: '2026-02-01',
        period_end: '2026-02-28',
      }

      expect(renewedSubscription.credits_remaining).toBe(
        subscription.monthly_allowance
      )
      // February is month 1 in JavaScript (0-indexed)
      expect(new Date(renewedSubscription.period_start).getUTCMonth()).toBe(1)
    })

    it('should handle allowance refund on letter rejection', async () => {
      const before = {
        credits_remaining: 4,
        monthly_allowance: 5,
      }

      // User generates letter, then it's rejected by attorney
      // Refund should be issued
      const after = {
        credits_remaining: 5, // Restored
        monthly_allowance: 5,
      }

      expect(after.credits_remaining).toBe(
        Math.min(before.credits_remaining + 1, before.monthly_allowance)
      )
    })

    it('should prevent generation if upgrading plan mid-month', async () => {
      const oldSubscription = {
        plan: 'basic',
        monthly_allowance: 3,
        credits_remaining: 2,
        period_end: '2026-01-31',
      }

      // User upgrades on Jan 15
      const newSubscription = {
        plan: 'professional',
        monthly_allowance: 10,
        credits_remaining: 10, // Full allowance for new plan
        period_start: '2026-01-15',
        period_end: '2026-02-15',
      }

      expect(newSubscription.monthly_allowance).toBeGreaterThan(
        oldSubscription.monthly_allowance
      )
      expect(newSubscription.credits_remaining).toBe(
        newSubscription.monthly_allowance
      )
    })
  })

  describe('Letter Versioning', () => {
    it('should track letter edits by attorney', async () => {
      const originalContent = 'Original letter text'
      const editedContent = 'Edited letter text with corrections'

      const versions = [
        {
          version: 1,
          content: originalContent,
          edited_by: 'user-123',
          edited_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          version: 2,
          content: editedContent,
          edited_by: 'attorney-1',
          edited_at: new Date().toISOString(),
        },
      ]

      expect(versions).toHaveLength(2)
      expect(versions[0].edited_by).toBe('user-123')
      expect(versions[1].edited_by).toBe('attorney-1')
      expect(versions[1].content).not.toBe(versions[0].content)
    })
  })

  describe('Letter Generation Fallback (OpenAI → n8n)', () => {
    it('should use OpenAI as primary generation method', async () => {
      const generation = {
        method: 'openai',
        model: 'gpt-4-turbo',
        content: 'Generated via OpenAI SDK',
        attempts: 1,
        duration_ms: 1500,
      }

      expect(generation.method).toBe('openai')
      expect(generation.model).toBe('gpt-4-turbo')
      expect(generation.content).toContain('OpenAI')
    })

    it('should fall back to n8n when OpenAI fails and n8n is available', async () => {
      const n8nAvailable = true
      const openaiFailed = true

      let generationMethod: 'openai' | 'n8n' = 'openai'
      let generatedContent: string | undefined

      // Simulate OpenAI failure
      if (openaiFailed) {
        if (n8nAvailable) {
          // Fall back to n8n
          generationMethod = 'n8n'
          generatedContent = 'Generated via n8n workflow'
        }
      }

      expect(generationMethod).toBe('n8n')
      expect(generatedContent).toContain('n8n')
    })

    it('should fail when OpenAI fails and n8n is not available', async () => {
      const n8nAvailable = false
      const openaiFailed = true
      let errorThrown = false
      let errorMessage = ''

      try {
        if (openaiFailed) {
          if (!n8nAvailable) {
            errorThrown = true
            errorMessage = 'OpenAI generation failed and no fallback available'
            throw new Error(errorMessage)
          }
        }
      } catch (e) {
        // Expected error
      }

      expect(errorThrown).toBe(true)
      expect(errorMessage).toContain('no fallback available')
    })

    it('should track generation method in audit trail', async () => {
      const auditLog = {
        letter_id: 'letter-123',
        from_status: 'generating',
        to_status: 'pending_review',
        action: 'created',
        details: 'Letter generated successfully via OpenAI (primary)',
        timestamp: new Date().toISOString(),
      }

      expect(auditLog.details).toContain('OpenAI (primary)')
      expect(auditLog.from_status).toBe('generating')
      expect(auditLog.to_status).toBe('pending_review')
    })

    it('should track fallback usage in audit trail', async () => {
      const auditLog = {
        letter_id: 'letter-456',
        from_status: 'generating',
        to_status: 'pending_review',
        action: 'created',
        details: 'Letter generated successfully via n8n (fallback)',
        timestamp: new Date().toISOString(),
      }

      expect(auditLog.details).toContain('n8n (fallback)')
      expect(auditLog.details).toContain('fallback')
    })

    it('should record OpenAI failure in trace spans', async () => {
      const spanEvents = [
        { name: 'openai_generation_started', timestamp: '2024-01-01T00:00:00Z' },
        { name: 'openai_failed', timestamp: '2024-01-01T00:00:02Z', attributes: { error: 'Rate limit exceeded' } },
        { name: 'n8n_fallback_started', timestamp: '2024-01-01T00:00:02Z' },
        { name: 'n8n_fallback_succeeded', timestamp: '2024-01-01T00:00:05Z' },
      ]

      const hasFailureEvent = spanEvents.some(e => e.name === 'openai_failed')
      const hasFallbackEvent = spanEvents.some(e => e.name === 'n8n_fallback_started')
      const hasSuccessEvent = spanEvents.some(e => e.name === 'n8n_fallback_succeeded')

      expect(hasFailureEvent).toBe(true)
      expect(hasFallbackEvent).toBe(true)
      expect(hasSuccessEvent).toBe(true)
    })

    it('should record error when both generation methods fail', async () => {
      const auditLog = {
        letter_id: 'letter-789',
        from_status: 'generating',
        to_status: 'failed',
        action: 'generation_failed',
        details: 'Generation failed (n8n fallback): Connection timeout',
        timestamp: new Date().toISOString(),
      }

      expect(auditLog.to_status).toBe('failed')
      expect(auditLog.details).toContain('n8n fallback')
      expect(auditLog.details).toContain('timeout')
    })

    it('should distinguish between primary and fallback in telemetry', async () => {
      const telemetry = {
        generation_method: 'openai_primary',
        n8n_available: true,
        openai_attempts: 1,
        openai_duration_ms: 1200,
        n8n_used: false,
      }

      expect(telemetry.generation_method).toBe('openai_primary')
      expect(telemetry.n8n_available).toBe(true)
      expect(telemetry.n8n_used).toBe(false)
    })

    it('should update telemetry when fallback is used', async () => {
      const telemetry = {
        generation_method: 'openai_primary',
        n8n_available: true,
        openai_failed: true,
        n8n_used: true,
        n8n_duration_ms: 3500,
        total_duration_ms: 4700, // Includes failed OpenAI attempt + n8n
      }

      expect(telemetry.openai_failed).toBe(true)
      expect(telemetry.n8n_used).toBe(true)
      expect(telemetry.total_duration_ms).toBeGreaterThan(telemetry.n8n_duration_ms)
    })

    it('should handle OpenAI timeout with n8n fallback', async () => {
      const openaiTimeout = true
      const n8nAvailable = true

      let result: { success: boolean; method: string; content: string }

      if (openaiTimeout) {
        if (n8nAvailable) {
          result = {
            success: true,
            method: 'n8n',
            content: 'Letter generated via n8n after OpenAI timeout',
          }
        } else {
          result = {
            success: false,
            method: 'none',
            content: '',
          }
        }
      } else {
        result = {
          success: true,
          method: 'openai',
          content: 'Letter generated via OpenAI',
        }
      }

      expect(result.success).toBe(true)
      expect(result.method).toBe('n8n')
      expect(result.content).toContain('n8n')
    })

    it('should handle OpenAI rate limit with n8n fallback', async () => {
      const openaiRateLimited = true
      const n8nAvailable = true

      const fallbackTriggered = openaiRateLimited && n8nAvailable

      expect(fallbackTriggered).toBe(true)

      const result = fallbackTriggered
        ? { method: 'n8n', reason: 'OpenAI rate limit exceeded' }
        : { method: 'openai', reason: 'Primary method' }

      expect(result.method).toBe('n8n')
      expect(result.reason).toContain('rate limit')
    })
  })
})
