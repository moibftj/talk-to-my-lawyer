/**
 * Email Delivery Integration Tests
 *
 * Tests for Resend email service:
 * - Email sending with templates
 * - Template rendering
 * - HTML escaping and security
 * - Error handling
 * - Delivery tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ResendProvider } from '../providers/resend'
import { renderTemplate } from '../templates'
import type { EmailMessage, EmailTemplate } from '../types'

// Create a mock send function that can be controlled
const mockSend = vi.fn()

// Mock Resend module
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}))

describe('Email Delivery Integration', () => {
  let resendProvider: ResendProvider

  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockReset()
    mockSend.mockResolvedValue({
      data: { id: 'msg_test_123' },
      error: null,
    })
    process.env.RESEND_API_KEY = 'test-resend-api-key'
    process.env.EMAIL_FROM = 'noreply@test.com'
    process.env.EMAIL_FROM_NAME = 'Test App'

    // Create provider instance (it will use the mocked Resend)
    resendProvider = new ResendProvider()
  })

  describe('ResendProvider Configuration', () => {
    it('should be configured when API key is present', () => {
      expect(resendProvider.isConfigured()).toBe(true)
    })

    it('should not be configured when API key is missing', () => {
      delete process.env.RESEND_API_KEY
      const provider = new ResendProvider()
      expect(provider.isConfigured()).toBe(false)
    })

    it('should return provider name', () => {
      expect(resendProvider.name).toBe('resend')
    })
  })

  describe('Email Sending', () => {
    it('should send email successfully', async () => {
      const mockMessageId = 'msg_123abc'
      mockSend.mockResolvedValueOnce({
        data: { id: mockMessageId },
        error: null,
      })

      const message: EmailMessage = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content',
      }

      const result = await resendProvider.send(message)

      expect(result.success).toBe(true)
      expect(result.messageId).toBe(mockMessageId)
      expect(result.provider).toBe('resend')
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<p>Test HTML content</p>',
          text: 'Test text content',
        })
      )
    })

    it('should handle multiple recipients', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg_456' },
        error: null,
      })

      const message: EmailMessage = {
        to: ['recipient1@example.com', 'recipient2@example.com'],
        subject: 'Test Subject',
        html: '<p>Test</p>',
      }

      const result = await resendProvider.send(message)

      expect(result.success).toBe(true)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['recipient1@example.com', 'recipient2@example.com'],
        })
      )
    })

    it('should include reply-to header when provided', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg_789' },
        error: null,
      })

      const message: EmailMessage = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        replyTo: 'support@example.com',
      }

      await resendProvider.send(message)

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'support@example.com',
        })
      )
    })

    it('should handle custom from address', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg_custom' },
        error: null,
      })

      const message: EmailMessage = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        from: {
          email: 'custom@example.com',
          name: 'Custom Sender',
        },
      }

      await resendProvider.send(message)

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Custom Sender <custom@example.com>',
        })
      )
    })

    it('should include attachments', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg_attach' },
        error: null,
      })

      const message: EmailMessage = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        attachments: [
          {
            filename: 'document.pdf',
            content: 'base64content',
          },
        ],
      }

      await resendProvider.send(message)

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: 'document.pdf',
              content: 'base64content',
            },
          ],
        })
      )
    })

    it('should handle Resend API errors', async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: {
          statusCode: 422,
          message: 'Invalid email address',
          name: 'validation_error',
        },
      })

      const message: EmailMessage = {
        to: 'invalid-email',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      }

      const result = await resendProvider.send(message)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid email address')
      expect(result.provider).toBe('resend')
    })

    it('should handle network errors', async () => {
      mockSend.mockRejectedValueOnce(
        new Error('Network connection failed')
      )

      const message: EmailMessage = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      }

      const result = await resendProvider.send(message)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network connection failed')
    })
  })

  describe('Template Rendering', () => {
    describe('HTML Escaping Security', () => {
      it('should escape HTML in template data', () => {
        const data = {
          userName: '<script>alert("XSS")</script>',
          letterTitle: '<img src=x onerror=alert(1)>',
        }

        const result = renderTemplate('letter-approved', data)

        // Should not contain unescaped HTML
        expect(result.html).not.toContain('<script>')
        expect(result.html).not.toContain('<img src=x onerror=')
        // Should contain escaped entities
        expect(result.html).toContain('&lt;script&gt;')
      })

      it('should escape single and double quotes', () => {
        const data = {
          userName: "User' Name",
          letterTitle: 'Letter "Title"',
        }

        const result = renderTemplate('letter-approved', data)

        expect(result.html).toContain('&#039;')
        expect(result.html).toContain('&quot;')
      })

      it('should escape ampersands', () => {
        const data = {
          userName: 'Tom & Jerry',
          letterTitle: 'Attorney & Counsel',
        }

        const result = renderTemplate('letter-approved', data)

        expect(result.html).toContain('Tom &amp; Jerry')
        expect(result.html).not.toContain('Tom & Jerry')
      })
    })

    describe('Template Content', () => {
      it('should render welcome template', () => {
        const data = {
          userName: 'John Doe',
          loginUrl: 'https://example.com/login',
        }

        const result = renderTemplate('welcome', data)

        expect(result.subject).toContain('Welcome')
        expect(result.html).toContain('John Doe')
        expect(result.html).toContain('https://example.com/login')
      })

      it('should render letter-approved template', () => {
        const data = {
          userName: 'Jane Doe',
          letterTitle: 'Demand Letter for Unpaid Wages',
          letterLink: 'https://example.com/letters/123',
        }

        const result = renderTemplate('letter-approved', data)

        expect(result.subject).toContain('approved')
        expect(result.html).toContain('Jane Doe')
        expect(result.html).toContain('Demand Letter for Unpaid Wages')
        expect(result.html).toContain('https://example.com/letters/123')
      })

      it('should render letter-rejected template', () => {
        const data = {
          userName: 'Bob Smith',
          letterTitle: 'Eviction Notice',
          rejectionReason: 'Insufficient evidence',
        }

        const result = renderTemplate('letter-rejected', data)

        expect(result.subject).toContain('changes requested')
        expect(result.html).toContain('Bob Smith')
        expect(result.html).toContain('Insufficient evidence')
      })

      it('should render password-reset template', () => {
        const data = {
          userName: 'Alice Johnson',
          resetLink: 'https://example.com/reset?token=abc123',
        }

        const result = renderTemplate('password-reset', data)

        expect(result.subject).toContain('Password Reset')
        expect(result.html).toContain('Alice Johnson')
        expect(result.html).toContain('https://example.com/reset?token=abc123')
      })
    })

    describe('Unsubscribe Links', () => {
      it('should include unsubscribe URL for marketing emails', () => {
        const marketingTemplates: EmailTemplate[] = [
          'welcome',
          'letter-generated',
          'letter-approved',
          'letter-rejected',
        ]

        marketingTemplates.forEach((template) => {
          const data = {
            userName: 'Test User',
            unsubscribeUrl: 'https://example.com/unsubscribe?email=test@example.com',
          }

          const result = renderTemplate(template, data)

          expect(result.html).toContain('unsubscribe')
          expect(result.html).toContain('https://example.com/unsubscribe')
        })
      })

      it('should not include unsubscribe for security emails', () => {
        const securityTemplates: EmailTemplate[] = [
          'password-reset',
          'security-alert',
        ]

        securityTemplates.forEach((template) => {
          const data = {
            userName: 'Test User',
            resetLink: 'https://example.com/reset',
          }

          const result = renderTemplate(template, data)

          // Security emails should not have unsubscribe
          const hasUnsubscribeInFooter =
            result.html.includes('class="unsubscribe"') ||
            result.html.includes('Unsubscribe from these emails')

          expect(hasUnsubscribeInFooter).toBe(false)
        })
      })
    })
  })

  describe('Email Deliverability', () => {
    it('should include both HTML and text versions', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg_both' },
        error: null,
      })

      const message: EmailMessage = {
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>HTML</p>',
        text: 'Text',
      }

      await resendProvider.send(message)

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<p>HTML</p>',
          text: 'Text',
        })
      )
    })

    it('should use proper from address format', async () => {
      mockSend.mockResolvedValueOnce({
        data: { id: 'msg_from' },
        error: null,
      })

      const message: EmailMessage = {
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      }

      await resendProvider.send(message)

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringMatching(/^.+ <.+@.+>$/),
        })
      )
    })
  })
})
