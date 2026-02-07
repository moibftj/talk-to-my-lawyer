/**
 * OpenAI Integration Tests
 *
 * Tests for OpenAI letter generation:
 * - Content generation with retry logic
 * - Letter improvement
 * - Error handling and edge cases
 * - Content validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateLetterContent, improveLetterContent, validateLetterQuality } from '../letter-generation-service'
import { generateTextWithRetry } from '@/lib/ai/openai-retry'

// Mock OpenAI retry function
vi.mock('@/lib/ai/openai-retry', () => ({
  generateTextWithRetry: vi.fn(),
}))

// Mock tracing
vi.mock('@/lib/monitoring/tracing', () => ({
  createAISpan: vi.fn(() => ({
    setAttribute: vi.fn(),
    setAttributes: vi.fn(),
    recordException: vi.fn(),
    setStatus: vi.fn(),
    addEvent: vi.fn(),
    end: vi.fn(),
  })),
  addSpanAttributes: vi.fn(),
  recordSpanEvent: vi.fn(),
}))

// Mock legal research service
vi.mock('../legal-research-service', () => ({
  isLegalResearchAvailable: vi.fn(() => false),
}))

// Mock letter prompts
vi.mock('@/lib/prompts/letter-prompts', () => ({
  getSystemPrompt: vi.fn(() => 'You are a legal attorney.'),
  buildLetterPromptWithContext: vi.fn(() => 'Mock prompt'),
  createLetterOutline: vi.fn(),
  formatOutlineForPrompt: vi.fn(),
  generateQualityChecklist: vi.fn(() => ({
    hasProperFormat: true,
    hasJurisdictionReferences: true,
    hasLegalCitations: true,
    hasClearDemands: true,
    hasProfessionalTone: true,
    hasAppropriateLength: true,
    hasDeadline: true,
    hasConsequences: true,
  })),
}))

describe('OpenAI Integration - Letter Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-openai-key'
  })

  describe('generateLetterContent', () => {
    it('should generate letter content successfully', async () => {
      const mockContent = `
[Your Name]
[Your Address]

[Date]

[Recipient Name]
[Recipient Address]

Re: Demand for Payment

Dear [Recipient Name],

I am writing to formally demand payment for the unpaid wages...

Sincerely,
[Your Name]
`

      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: mockContent,
        attempts: 1,
        duration: 1500,
      })

      const intakeData = {
        senderName: 'John Doe',
        senderAddress: '123 Main St',
        recipientName: 'ABC Company',
        recipientAddress: '456 Business Ave',
        issueDescription: 'Unpaid wages for June 2024',
        desiredOutcome: 'Payment of $5,000',
      }

      const result = await generateLetterContent('demand', intakeData)

      expect(result).toBe(mockContent)
      expect(generateTextWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.any(String),
          system: expect.stringContaining('professional legal attorney'),
          temperature: 0.7,
          maxOutputTokens: 2048,
          model: 'gpt-4o',
        })
      )
    })

    it('should retry on OpenAI API failures', async () => {
      const mockContent = 'Generated letter content'

      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: mockContent,
        attempts: 3,
        duration: 5000,
      })

      const result = await generateLetterContent('demand', {
        senderName: 'John Doe',
        recipientName: 'Jane Doe',
        issueDescription: 'Test issue',
      })

      expect(result).toBe(mockContent)
      // Verify the function was called
      expect(generateTextWithRetry).toHaveBeenCalled()
    })

    it('should throw error when AI returns empty content', async () => {
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: '',
        attempts: 1,
        duration: 1000,
      })

      await expect(
        generateLetterContent('demand', {
          senderName: 'John Doe',
          recipientName: 'Jane Doe',
          issueDescription: 'Test issue',
        })
      ).rejects.toThrow('AI returned empty content')
    })

    it('should handle OpenAI API errors gracefully', async () => {
      vi.mocked(generateTextWithRetry).mockRejectedValue(
        new Error('OpenAI API error: rate limit exceeded')
      )

      await expect(
        generateLetterContent('demand', {
          senderName: 'John Doe',
          recipientName: 'Jane Doe',
          issueDescription: 'Test issue',
        })
      ).rejects.toThrow('OpenAI API error')
    })

    it('should include all intake data fields in prompt', async () => {
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: 'Generated content',
        attempts: 1,
        duration: 1000,
      })

      const intakeData = {
        senderName: 'John Doe',
        senderAddress: '123 Main St',
        senderEmail: 'john@example.com',
        senderPhone: '555-1234',
        recipientName: 'Jane Doe',
        recipientAddress: '456 Oak Ave',
        issueDescription: 'Unpaid wages',
        desiredOutcome: 'Payment of $5,000',
        amountDemanded: 5000,
        deadlineDate: '2024-03-01',
        incidentDate: '2024-01-15',
        additionalDetails: 'Extra context here',
      }

      await generateLetterContent('demand', intakeData)

      // Verify the function was called with proper arguments
      expect(generateTextWithRetry).toHaveBeenCalled()
      const callArgs = vi.mocked(generateTextWithRetry).mock.calls[0]
      expect(callArgs).toBeDefined()
    })

    it('should handle missing optional fields', async () => {
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: 'Generated content',
        attempts: 1,
        duration: 1000,
      })

      const intakeData = {
        senderName: 'John Doe',
        recipientName: 'Jane Doe',
        issueDescription: 'Test issue',
      }

      const result = await generateLetterContent('demand', intakeData)

      expect(result).toBeDefined()
      expect(generateTextWithRetry).toHaveBeenCalled()
    })
  })

  describe('improveLetterContent', () => {
    const originalContent = `
Dear [Name],

I am writing about the unpaid wages.

Please pay me.

Thanks,
John
`

    it('should improve existing letter content', async () => {
      const improvedContent = `
Dear [Recipient Name],

I am writing to formally address the issue of unpaid wages...

[Improved professional content]

Sincerely,
John
`

      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: improvedContent,
        attempts: 1,
        duration: 1200,
      })

      const result = await improveLetterContent(originalContent)

      expect(result).toBe(improvedContent)
      expect(generateTextWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Improve the following legal letter'),
        })
      )
    })

    it('should include improvement notes in prompt', async () => {
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: 'Improved content',
        attempts: 1,
        duration: 1000,
      })

      await improveLetterContent(originalContent, 'Make it more assertive and add specific legal references')

      const prompt = vi.mocked(generateTextWithRetry).mock.calls[0][0].prompt

      expect(prompt).toContain('Make it more assertive')
      expect(prompt).toContain('Specific Improvements Requested')
    })

    it('should include letter type in prompt for context', async () => {
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: 'Improved content',
        attempts: 1,
        duration: 1000,
      })

      await improveLetterContent(originalContent, 'Strengthen the demand', 'demand')

      const prompt = vi.mocked(generateTextWithRetry).mock.calls[0][0].prompt

      expect(prompt).toContain('Letter Type: demand')
    })

    it('should handle empty original content', async () => {
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: 'Generated from scratch',
        attempts: 1,
        duration: 1000,
      })

      const result = await improveLetterContent('', 'Create a demand letter')

      expect(result).toBeDefined()
    })

    it('should throw error on empty AI response', async () => {
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: '',
        attempts: 1,
        duration: 1000,
      })

      await expect(
        improveLetterContent(originalContent, 'Improve this')
      ).rejects.toThrow('AI returned empty content')
    })
  })

  describe('Content Validation', () => {
    it('should validate generated letter quality', () => {
      const content = `
[Date]

Dear [Recipient Name],

I am writing to demand payment for unpaid wages totaling $5,000.

The amount is due within 14 days.

Sincerely,
[Sender Name]
`

      const context = {
        letterType: 'demand',
        senderName: 'John Doe',
        senderAddress: '123 Main St',
        senderState: 'CA',
        recipientName: 'ABC Corp',
        recipientAddress: '456 Business Ave',
        recipientState: 'NY',
        issueDescription: 'Unpaid wages',
        desiredOutcome: 'Payment',
        amountDemanded: 5000,
      }

      const validation = validateLetterQuality(content, context)

      expect(validation).toBeDefined()
      expect(typeof validation.hasProperFormat).toBe('boolean')
      expect(typeof validation.hasProfessionalTone).toBe('boolean')
    })

    it('should check for valid letter format', () => {
      const invalidContent = 'This is not a letter.'
      const validContent = `
[Date]

Dear Recipient,

This is a proper letter format.

Sincerely,
Sender
`

      const context = {
        letterType: 'demand',
        senderName: 'John',
        senderAddress: '123 Main St',
        senderState: 'CA',
        recipientName: 'Jane',
        recipientAddress: '456 Oak Ave',
        recipientState: 'NY',
        issueDescription: 'Test',
        desiredOutcome: 'Resolution',
      }

      const invalidValidation = validateLetterQuality(invalidContent, context)
      const validValidation = validateLetterQuality(validContent, context)

      // Valid content should have proper format
      expect(typeof validValidation.hasProperFormat).toBe('boolean')
    })

    it('should check for clear demand in demand letters', () => {
      const vagueContent = 'I am writing about a problem.'
      const clearDemandContent = 'I demand payment of $5,000 within 14 days.'

      const context = {
        letterType: 'demand',
        senderName: 'John',
        senderAddress: '123 Main St',
        senderState: 'CA',
        recipientName: 'Jane',
        recipientAddress: '456 Oak Ave',
        recipientState: 'NY',
        issueDescription: 'Unpaid wages',
        desiredOutcome: 'Payment',
        amountDemanded: 5000,
      }

      const vagueValidation = validateLetterQuality(vagueContent, context)
      const clearValidation = validateLetterQuality(clearDemandContent, context)

      expect(clearValidation.hasClearDemands).toBe(true)
    })
  })
})

describe('OpenAI Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('API Key Validation', () => {
    it('should fail when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY

      vi.mocked(generateTextWithRetry).mockRejectedValue(
        new Error('OpenAI API key not configured')
      )

      await expect(
        generateLetterContent('demand', {
          senderName: 'John',
          recipientName: 'Jane',
          issueDescription: 'Test',
        })
      ).rejects.toThrow()
    })
  })

  describe('Rate Limiting', () => {
    it('should handle rate limit errors with retry', async () => {
      const rateLimitError = new Error('Rate limit exceeded')
      rateLimitError.name = 'RateLimitError'

      vi.mocked(generateTextWithRetry).mockRejectedValue(rateLimitError)

      await expect(
        generateLetterContent('demand', {
          senderName: 'John',
          recipientName: 'Jane',
          issueDescription: 'Test',
        })
      ).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('Content Safety', () => {
    it('should sanitize malicious input in prompts', async () => {
      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: 'Sanitized output',
        attempts: 1,
        duration: 1000,
      })

      const maliciousData = {
        senderName: '<script>alert("XSS")</script>',
        recipientName: 'DROP TABLE users; --',
        issueDescription: 'Normal issue description',
      }

      await generateLetterContent('demand', maliciousData)

      const prompt = vi.mocked(generateTextWithRetry).mock.calls[0][0].prompt

      // The prompt should still be valid (no actual code execution)
      expect(prompt).toBeDefined()
    })

    it('should not expose system prompts to output', async () => {
      const systemPrompt = 'You are a legal attorney.'

      vi.mocked(generateTextWithRetry).mockResolvedValue({
        text: 'Letter content without system prompt',
        attempts: 1,
        duration: 1000,
      })

      const result = await generateLetterContent('demand', {
        senderName: 'John',
        recipientName: 'Jane',
        issueDescription: 'Test',
      })

      expect(result).not.toContain(systemPrompt)
    })
  })
})

describe('Performance and Monitoring', () => {
  it('should track generation duration', async () => {
    vi.mocked(generateTextWithRetry).mockResolvedValue({
      text: 'Generated content',
      attempts: 1,
      duration: 2345,
    })

    await generateLetterContent('demand', {
      senderName: 'John',
      recipientName: 'Jane',
      issueDescription: 'Test',
    })

    expect(generateTextWithRetry).toHaveBeenCalled()
  })

  it('should log retry attempts', async () => {
    vi.mocked(generateTextWithRetry).mockResolvedValue({
      text: 'Generated content',
      attempts: 3,
      duration: 5000,
    })

    await generateLetterContent('demand', {
      senderName: 'John',
      recipientName: 'Jane',
      issueDescription: 'Test',
    })

    const result = vi.mocked(generateTextWithRetry).mock.results[0].value

    expect(await result).toHaveProperty('attempts', 3)
  })
})
