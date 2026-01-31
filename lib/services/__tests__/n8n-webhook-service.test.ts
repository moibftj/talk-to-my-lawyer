/**
 * n8n Webhook Service Tests
 *
 * Tests the n8n integration for letter generation:
 * - Configuration checks
 * - Letter generation workflow
 * - Retry logic and timeouts
 * - Data transformation
 * - Event notifications
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

import {
  isN8nConfigured,
  n8nConfig,
  generateLetterViaN8n,
  transformIntakeToN8nFormat,
  sendN8nEvent,
  notifyN8nLetterCompleted,
  notifyN8nLetterFailed,
  type N8nLetterFormData,
  type N8nGenerationResponse,
} from '../n8n-webhook-service'

describe('n8n Webhook Service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.useRealTimers()
  })

  describe('n8nConfig', () => {
    it('should return webhookUrl from environment', () => {
      process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook/letter'

      expect(n8nConfig.webhookUrl).toBe('https://n8n.example.com/webhook/letter')
    })

    it('should return isConfigured true when URL is set', () => {
      process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook/letter'

      expect(n8nConfig.isConfigured).toBe(true)
    })

    it('should return isConfigured false when URL is not set', () => {
      delete process.env.N8N_WEBHOOK_URL

      expect(n8nConfig.isConfigured).toBe(false)
    })

    it('should have correct timeout setting', () => {
      expect(n8nConfig.timeout).toBe(60000) // 60 seconds
    })

    it('should have correct maxRetries setting', () => {
      expect(n8nConfig.maxRetries).toBe(2)
    })
  })

  describe('isN8nConfigured', () => {
    it('should return true when N8N_WEBHOOK_URL is set', () => {
      process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook'

      expect(isN8nConfigured()).toBe(true)
    })

    it('should return false when N8N_WEBHOOK_URL is not set', () => {
      delete process.env.N8N_WEBHOOK_URL

      expect(isN8nConfigured()).toBe(false)
    })

    it('should return false for empty string', () => {
      process.env.N8N_WEBHOOK_URL = ''

      expect(isN8nConfigured()).toBe(false)
    })
  })

  describe('generateLetterViaN8n', () => {
    const validFormData: N8nLetterFormData = {
      letterType: 'demand-letter',
      letterId: 'letter-123',
      userId: 'user-456',
      senderName: 'John Doe',
      senderAddress: '123 Main St',
      senderState: 'CA',
      senderEmail: 'john@example.com',
      recipientName: 'Jane Smith',
      recipientAddress: '456 Oak Ave',
      recipientState: 'NY',
      issueDescription: 'Breach of contract',
      desiredOutcome: 'Full refund of $5000',
    }

    beforeEach(() => {
      process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook/letter'
    })

    it('should throw error when n8n is not configured', async () => {
      delete process.env.N8N_WEBHOOK_URL

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        'n8n webhook is not configured'
      )
    })

    it('should successfully generate letter', async () => {
      const mockResponse: N8nGenerationResponse = {
        success: true,
        generatedContent: 'Dear Ms. Smith,\n\nThis letter serves as formal notice...',
        letterId: 'letter-123',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await generateLetterViaN8n(validFormData)

      expect(result).toBe(mockResponse.generatedContent)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/letter',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Source': 'talk-to-my-lawyer',
            'X-Letter-Id': 'letter-123',
          }),
        })
      )
    })

    it('should include all form data in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            generatedContent: 'Generated letter content',
          }),
      })

      await generateLetterViaN8n(validFormData)

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)

      expect(callBody.letterType).toBe('demand-letter')
      expect(callBody.letterId).toBe('letter-123')
      expect(callBody.userId).toBe('user-456')
      expect(callBody.senderName).toBe('John Doe')
      expect(callBody.recipientName).toBe('Jane Smith')
      expect(callBody.issueDescription).toBe('Breach of contract')
      expect(callBody.source).toBe('talk-to-my-lawyer')
      expect(callBody.timestamp).toBeDefined()
    })

    it('should throw error for 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      })

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        'n8n workflow not found'
      )
    })

    it('should retry on 500 server errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Server error'),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              generatedContent: 'Generated after retry',
            }),
        })

      const resultPromise = generateLetterViaN8n(validFormData)

      // Fast-forward through the delay
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise

      expect(result).toBe('Generated after retry')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should fail after max retries on server errors', async () => {
      vi.useRealTimers() // Use real timers for this test

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Persistent server error'),
      })

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow('n8n request failed (500)')
      expect(mockFetch).toHaveBeenCalledTimes(2) // maxRetries = 2

      vi.useFakeTimers() // Restore fake timers
    })

    it('should handle AbortError from timeout', async () => {
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'

      // Mock fetch to immediately reject with abort error on all attempts
      mockFetch.mockRejectedValue(abortError)

      vi.useRealTimers() // Use real timers to avoid timing issues

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow('n8n request timed out')

      vi.useFakeTimers() // Restore fake timers
    })

    it('should throw error when n8n returns success:false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: false,
            error: 'AI generation failed',
          }),
      })

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        'AI generation failed'
      )
    })

    it('should throw error when no content returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            generatedContent: '', // Empty content
          }),
      })

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        'n8n returned success but no generated content'
      )
    })

    it('should throw error when content is undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            // generatedContent not included
          }),
      })

      await expect(generateLetterViaN8n(validFormData)).rejects.toThrow(
        'n8n returned success but no generated content'
      )
    })
  })

  describe('transformIntakeToN8nFormat', () => {
    it('should transform intake data to n8n format', () => {
      const intakeData = {
        senderName: 'John Doe',
        senderAddress: '123 Main St',
        senderState: 'CA',
        senderEmail: 'john@example.com',
        senderPhone: '555-1234',
        recipientName: 'Jane Smith',
        recipientAddress: '456 Oak Ave',
        recipientState: 'NY',
        recipientEmail: 'jane@example.com',
        issueDescription: 'Contract breach',
        desiredOutcome: 'Full refund',
        additionalDetails: 'See attached documents',
        amountDemanded: 5000,
        deadlineDate: '2024-03-01',
        incidentDate: '2024-01-15',
        courtType: 'small-claims',
      }

      const result = transformIntakeToN8nFormat(
        'letter-123',
        'user-456',
        'demand-letter',
        intakeData
      )

      expect(result.letterId).toBe('letter-123')
      expect(result.userId).toBe('user-456')
      expect(result.letterType).toBe('demand-letter')
      expect(result.senderName).toBe('John Doe')
      expect(result.senderEmail).toBe('john@example.com')
      expect(result.recipientName).toBe('Jane Smith')
      expect(result.issueDescription).toBe('Contract breach')
      expect(result.amountDemanded).toBe(5000)
      expect(result.deadline).toBe('2024-03-01')
      expect(result.courtType).toBe('small-claims')
    })

    it('should handle missing optional fields', () => {
      const intakeData = {
        senderName: 'John Doe',
        senderAddress: '123 Main St',
        senderState: 'CA',
        recipientName: 'Jane Smith',
        recipientAddress: '456 Oak Ave',
        recipientState: 'NY',
        issueDescription: 'Issue',
        desiredOutcome: 'Resolution',
      }

      const result = transformIntakeToN8nFormat(
        'letter-123',
        'user-456',
        'demand-letter',
        intakeData
      )

      expect(result.senderEmail).toBeUndefined()
      expect(result.senderPhone).toBeUndefined()
      expect(result.recipientEmail).toBeUndefined()
      expect(result.additionalDetails).toBeUndefined()
      expect(result.amountDemanded).toBeUndefined()
      expect(result.deadline).toBeUndefined()
    })

    it('should convert non-string values to strings', () => {
      const intakeData = {
        senderName: 123, // number instead of string
        senderAddress: true, // boolean
        senderState: null,
        recipientName: undefined,
        recipientAddress: { street: '123' }, // object
        recipientState: 'NY',
        issueDescription: 'Issue',
        desiredOutcome: 'Resolution',
      }

      const result = transformIntakeToN8nFormat(
        'letter-123',
        'user-456',
        'demand-letter',
        intakeData as any
      )

      expect(result.senderName).toBe('123')
      expect(result.senderAddress).toBe('true')
      expect(result.senderState).toBe('')
      expect(result.recipientName).toBe('')
    })

    it('should only include amountDemanded if it is a number', () => {
      const withNumber = transformIntakeToN8nFormat('l1', 'u1', 'type', {
        senderName: 'A',
        senderAddress: 'B',
        senderState: 'C',
        recipientName: 'D',
        recipientAddress: 'E',
        recipientState: 'F',
        issueDescription: 'G',
        desiredOutcome: 'H',
        amountDemanded: 5000,
      })

      const withString = transformIntakeToN8nFormat('l2', 'u2', 'type', {
        senderName: 'A',
        senderAddress: 'B',
        senderState: 'C',
        recipientName: 'D',
        recipientAddress: 'E',
        recipientState: 'F',
        issueDescription: 'G',
        desiredOutcome: 'H',
        amountDemanded: '5000', // string
      })

      expect(withNumber.amountDemanded).toBe(5000)
      expect(withString.amountDemanded).toBeUndefined()
    })
  })

  describe('sendN8nEvent', () => {
    beforeEach(() => {
      process.env.N8N_EVENTS_WEBHOOK_URL = 'https://n8n.example.com/webhook/events'
    })

    it('should return false when events webhook is not configured', async () => {
      delete process.env.N8N_EVENTS_WEBHOOK_URL

      const result = await sendN8nEvent({
        event: 'letter.generation.completed',
        timestamp: new Date().toISOString(),
        letterId: 'letter-123',
      })

      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should send event to webhook', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const result = await sendN8nEvent({
        event: 'letter.generation.completed',
        timestamp: '2024-01-15T10:00:00Z',
        letterId: 'letter-123',
        letterType: 'demand-letter',
        userId: 'user-456',
      })

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://n8n.example.com/webhook/events',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Webhook-Event': 'letter.generation.completed',
          }),
        })
      )
    })

    it('should return false on failed response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

      const result = await sendN8nEvent({
        event: 'letter.generation.failed',
        timestamp: new Date().toISOString(),
        letterId: 'letter-123',
        error: 'Generation failed',
      })

      expect(result).toBe(false)
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await sendN8nEvent({
        event: 'letter.submitted',
        timestamp: new Date().toISOString(),
        letterId: 'letter-123',
      })

      expect(result).toBe(false)
    })

    it('should handle fetch errors gracefully', async () => {
      // AbortError simulates a timeout
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'
      mockFetch.mockRejectedValueOnce(abortError)

      const result = await sendN8nEvent({
        event: 'letter.approved',
        timestamp: new Date().toISOString(),
        letterId: 'letter-123',
      })

      expect(result).toBe(false)
    })
  })

  describe('notifyN8nLetterCompleted', () => {
    beforeEach(() => {
      process.env.N8N_EVENTS_WEBHOOK_URL = 'https://n8n.example.com/webhook/events'
    })

    it('should send completion event with correct data', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      notifyN8nLetterCompleted(
        'letter-123',
        'demand-letter',
        'My Demand Letter',
        'user-456',
        false
      )

      // Allow promise to settle
      await vi.advanceTimersByTimeAsync(100)

      expect(mockFetch).toHaveBeenCalled()
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)

      expect(callBody.event).toBe('letter.generation.completed')
      expect(callBody.letterId).toBe('letter-123')
      expect(callBody.letterType).toBe('demand-letter')
      expect(callBody.letterTitle).toBe('My Demand Letter')
      expect(callBody.userId).toBe('user-456')
      expect(callBody.isFreeTrial).toBe(false)
      expect(callBody.status).toBe('pending_review')
    })

    it('should not throw on error (fire-and-forget)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      // Should not throw
      expect(() => {
        notifyN8nLetterCompleted('letter-123', 'demand-letter', 'Title', 'user-456', true)
      }).not.toThrow()

      await vi.advanceTimersByTimeAsync(100)
    })
  })

  describe('notifyN8nLetterFailed', () => {
    beforeEach(() => {
      process.env.N8N_EVENTS_WEBHOOK_URL = 'https://n8n.example.com/webhook/events'
    })

    it('should send failure event with error details', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      notifyN8nLetterFailed(
        'letter-123',
        'demand-letter',
        'user-456',
        'AI service unavailable'
      )

      await vi.advanceTimersByTimeAsync(100)

      expect(mockFetch).toHaveBeenCalled()
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)

      expect(callBody.event).toBe('letter.generation.failed')
      expect(callBody.letterId).toBe('letter-123')
      expect(callBody.status).toBe('failed')
      expect(callBody.error).toBe('AI service unavailable')
    })

    it('should not throw on error (fire-and-forget)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      expect(() => {
        notifyN8nLetterFailed('letter-123', 'demand-letter', 'user-456', 'Error')
      }).not.toThrow()

      await vi.advanceTimersByTimeAsync(100)
    })
  })
})
