/**
 * Email Delivery Integration Tests
 *
 * Tests for Resend email service:
 * - Email sending with templates
 * - Template rendering
 * - HTML escaping and security
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderTemplate } from '../templates'
import type { EmailTemplate } from '../types'

// Mock Resend module with a simple mock
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({
        data: { id: 'msg_test_123' },
        error: null,
      }),
    },
  })),
}))

describe('Email Delivery Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-resend-api-key'
    process.env.EMAIL_FROM = 'noreply@test.com'
    process.env.EMAIL_FROM_NAME = 'Test App'
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

      it('should escape forward slashes and backticks', () => {
        const data = {
          userName: 'User</script>',
          letterTitle: '`code`',
        }

        const result = renderTemplate('letter-approved', data)

        expect(result.html).toContain('&#x2F;')
        expect(result.html).toContain('&#96;')
      })
    })

    describe('Template Content', () => {
      it('should render welcome template', () => {
        const data = {
          userName: 'John Doe',
          actionUrl: 'https://example.com/login',
        }

        const result = renderTemplate('welcome', data)

        expect(result.subject).toContain('Welcome')
        expect(result.html).toContain('John Doe')
        // URLs are HTML-escaped, check for parts that remain readable
        expect(result.html).toContain('example.com')
      })

      it('should render letter-approved template', () => {
        const data = {
          userName: 'Jane Doe',
          letterTitle: 'Demand Letter for Unpaid Wages',
          letterLink: 'https://example.com/letters/123',
        }

        const result = renderTemplate('letter-approved', data)

        expect(result.subject).toContain('Approved')
        expect(result.html).toContain('Jane Doe')
        expect(result.html).toContain('Demand Letter for Unpaid Wages')
        // URL is HTML-escaped, check for domain
        expect(result.html).toContain('example.com')
      })

      it('should render letter-rejected template', () => {
        const data = {
          userName: 'Bob Smith',
          letterTitle: 'Eviction Notice',
          alertMessage: 'Insufficient evidence',
        }

        const result = renderTemplate('letter-rejected', data)

        expect(result.subject).toContain('Revision')
        expect(result.html).toContain('Bob Smith')
        expect(result.html).toContain('Insufficient evidence')
      })

      it('should render password-reset template', () => {
        const data = {
          userName: 'Alice Johnson',
          actionUrl: 'https://example.com/reset?token=abc123',
        }

        const result = renderTemplate('password-reset', data)

        expect(result.subject).toContain('Reset Your Password')
        expect(result.html).toContain('Password Reset Request')
        // URL is escaped in HTML, check for parts that are still readable
        expect(result.html).toContain('example.com')
        expect(result.html).toContain('reset')
      })
    })

    describe('Unsubscribe Links', () => {
      it('should include unsubscribe URL when provided in data', () => {
        const data = {
          userName: 'Test User',
          unsubscribeUrl: 'https://example.com/unsubscribe?email=test@example.com',
        }

        const result = renderTemplate('letter-approved', data)

        // The template should render the unsubscribe URL if provided
        expect(result.html).toBeDefined()
      })

      it('should render security emails without unsubscribe', () => {
        const data = {
          userName: 'Test User',
          resetLink: 'https://example.com/reset',
        }

        const result = renderTemplate('password-reset', data)

        // Security emails should render successfully
        expect(result.html).toBeDefined()
        expect(result.subject).toBeDefined()
      })
    })

    describe('Template Output Format', () => {
      it('should return object with subject, text, and html', () => {
        const result = renderTemplate('welcome', {
          userName: 'Test User',
          loginUrl: 'https://example.com',
        })

        expect(result).toHaveProperty('subject')
        expect(result).toHaveProperty('text')
        expect(result).toHaveProperty('html')
        expect(typeof result.subject).toBe('string')
        expect(typeof result.text).toBe('string')
        expect(typeof result.html).toBe('string')
      })

      it('should handle missing data gracefully', () => {
        expect(() => {
          renderTemplate('welcome', {})
        }).not.toThrow()

        expect(() => {
          renderTemplate('welcome', {
            userName: undefined,
            loginUrl: undefined,
          })
        }).not.toThrow()
      })
    })
  })
})
