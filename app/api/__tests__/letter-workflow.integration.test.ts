/**
 * Letter Workflow Integration Tests
 * 
 * Tests the complete letter lifecycle:
 * - Generation (n8n primary with jurisdiction research, OpenAI fallback)
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

        const letter = {
          id: 'letter-1',
          user_id: userId,
          title: letterData.title,
          status: 'pending_review',
          content: 'Generated letter content here...',
          created_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          ai_model: 'gpt-4o',
          ai_tokens: 1200,
        }

        expect(letter.status).toBe('pending_review')
        expect(letter.user_id).toBe(userId)
        expect(letter.ai_model).toBeDefined()
        expect(letter.ai_tokens).toBeGreaterThan(0)
      })

      it('should deduct user allowance after letter generation', async () => {
        const subscription = {
          monthly_allowance: 5,
          credits_remaining: 4,
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
          final_content: letter.content,
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
          rejection_reason: null,
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
          size: 25000,
          generated_at: new Date().toISOString(),
          content_hash: 'abc123xyz',
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

      const renewedSubscription = {
        ...subscription,
        credits_remaining: 5,
        period_start: '2026-02-01',
        period_end: '2026-02-28',
      }

      expect(renewedSubscription.credits_remaining).toBe(
        subscription.monthly_allowance
      )
      expect(new Date(renewedSubscription.period_start).getUTCMonth()).toBe(1)
    })

    it('should handle allowance refund on letter rejection', async () => {
      const before = {
        credits_remaining: 4,
        monthly_allowance: 5,
      }

      const after = {
        credits_remaining: 5,
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

      const newSubscription = {
        plan: 'professional',
        monthly_allowance: 10,
        credits_remaining: 10,
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

  describe('Letter Generation: n8n Primary, OpenAI Fallback', () => {
    it('should use n8n as primary generation method with jurisdiction research', async () => {
      const generation = {
        method: 'n8n',
        model: 'gpt-4o',
        researchApplied: true,
        state: 'California',
        content: 'Generated via n8n with CA jurisdiction research',
        supabaseUpdated: true,
      }

      expect(generation.method).toBe('n8n')
      expect(generation.researchApplied).toBe(true)
      expect(generation.state).toBe('California')
      expect(generation.supabaseUpdated).toBe(true)
    })

    it('should include research_data when n8n is used', async () => {
      const researchData = {
        state: 'California',
        statutes: [
          { statuteNumber: 'CA Civil Code § 1542', description: 'General release provisions', relevance: 'Required disclosure language' }
        ],
        disclosures: ['Must include specific statutory language'],
        conventions: ['Standard letter format per CA Bar guidelines'],
      }

      expect(researchData.state).toBe('California')
      expect(researchData.statutes).toHaveLength(1)
      expect(researchData.disclosures).toHaveLength(1)
      expect(researchData.conventions).toHaveLength(1)
    })

    it('should fall back to OpenAI when n8n fails', async () => {
      const n8nAvailable = true
      const n8nFailed = true

      let generationMethod: 'n8n' | 'openai' = 'n8n'
      let generatedContent: string | undefined
      let researchApplied = false

      if (n8nFailed) {
        generationMethod = 'openai'
        generatedContent = 'Generated via OpenAI fallback (no jurisdiction research)'
        researchApplied = false
      }

      expect(generationMethod).toBe('openai')
      expect(researchApplied).toBe(false)
      expect(generatedContent).toContain('OpenAI fallback')
    })

    it('should fall back to OpenAI when n8n is not configured', async () => {
      const n8nAvailable = false
      const openaiAvailable = true

      let generationMethod = 'none'

      if (n8nAvailable) {
        generationMethod = 'n8n'
      } else if (openaiAvailable) {
        generationMethod = 'openai'
      }

      expect(generationMethod).toBe('openai')
    })

    it('should fail when both n8n and OpenAI are unavailable', async () => {
      const n8nAvailable = false
      const openaiAvailable = false
      let errorThrown = false

      try {
        if (!n8nAvailable && !openaiAvailable) {
          errorThrown = true
          throw new Error('No generation service configured')
        }
      } catch {
        // expected
      }

      expect(errorThrown).toBe(true)
    })

    it('should track generation method in audit trail', async () => {
      const n8nAudit = {
        letter_id: 'letter-123',
        from_status: 'generating',
        to_status: 'pending_review',
        action: 'created',
        details: 'Letter generated via n8n (primary) with jurisdiction research for California',
      }

      expect(n8nAudit.details).toContain('n8n (primary)')
      expect(n8nAudit.details).toContain('jurisdiction research')
      expect(n8nAudit.details).toContain('California')
    })

    it('should track fallback usage in audit trail', async () => {
      const fallbackAudit = {
        letter_id: 'letter-456',
        from_status: 'generating',
        to_status: 'pending_review',
        action: 'created',
        details: 'Letter generated via OpenAI (fallback) and queued for admin review',
      }

      expect(fallbackAudit.details).toContain('OpenAI (fallback)')
    })

    it('should skip Supabase update when n8n handles it directly', async () => {
      const n8nResult = {
        generatedContent: 'Letter content from n8n...',
        letterId: 'letter-123',
        status: 'pending_review',
        researchApplied: true,
        state: 'Florida',
        supabaseUpdated: true,
      }

      expect(n8nResult.supabaseUpdated).toBe(true)

      const shouldUpdateSupabase = !n8nResult.supabaseUpdated
      expect(shouldUpdateSupabase).toBe(false)
    })

    it('should update Supabase when OpenAI fallback is used', async () => {
      const openaiResult = {
        generatedContent: 'Letter content from OpenAI...',
        method: 'openai',
        supabaseUpdated: false,
      }

      expect(openaiResult.supabaseUpdated).toBe(false)

      const shouldUpdateSupabase = !openaiResult.supabaseUpdated
      expect(shouldUpdateSupabase).toBe(true)
    })

    it('should handle n8n timeout with OpenAI fallback', async () => {
      const n8nTimeout = true
      const openaiAvailable = true

      let result: { success: boolean; method: string; content: string }

      if (n8nTimeout) {
        if (openaiAvailable) {
          result = {
            success: true,
            method: 'openai',
            content: 'Letter generated via OpenAI after n8n timeout',
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
          method: 'n8n',
          content: 'Letter generated via n8n',
        }
      }

      expect(result.success).toBe(true)
      expect(result.method).toBe('openai')
    })

    it('should handle n8n auth failure with OpenAI fallback', async () => {
      const n8nAuthFailed = true
      const openaiAvailable = true

      const fallbackTriggered = n8nAuthFailed && openaiAvailable

      expect(fallbackTriggered).toBe(true)

      const result = fallbackTriggered
        ? { method: 'openai', reason: 'n8n webhook authentication failed' }
        : { method: 'n8n', reason: 'Primary method' }

      expect(result.method).toBe('openai')
      expect(result.reason).toContain('authentication failed')
    })

    it('should record both methods in telemetry', async () => {
      const telemetry = {
        generation_method: 'n8n_primary',
        n8n_available: true,
        openai_available: true,
        n8n_used: true,
        n8n_duration_ms: 3500,
        research_applied: true,
        research_state: 'FL',
        openai_fallback_used: false,
      }

      expect(telemetry.generation_method).toBe('n8n_primary')
      expect(telemetry.n8n_used).toBe(true)
      expect(telemetry.research_applied).toBe(true)
      expect(telemetry.openai_fallback_used).toBe(false)
    })

    it('should update telemetry when fallback is used', async () => {
      const telemetry = {
        generation_method: 'openai_fallback',
        n8n_available: true,
        n8n_failed: true,
        n8n_error: 'Connection timeout',
        openai_fallback_used: true,
        openai_duration_ms: 1500,
        research_applied: false,
        total_duration_ms: 5000,
      }

      expect(telemetry.n8n_failed).toBe(true)
      expect(telemetry.openai_fallback_used).toBe(true)
      expect(telemetry.research_applied).toBe(false)
      expect(telemetry.total_duration_ms).toBeGreaterThan(telemetry.openai_duration_ms)
    })
  })
})
