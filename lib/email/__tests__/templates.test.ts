/**
 * Email Template Tests
 *
 * Tests email template rendering:
 * - All templates render without errors
 * - Templates include required content
 * - XSS prevention (HTML escaping)
 * - Proper subject lines
 * - Both HTML and text versions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderTemplate, templates } from '../templates'
import type { EmailTemplate, TemplateData } from '../types'

describe('Email Templates', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SITE_URL: 'https://talk-to-my-lawyer.com',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // List of all template types
  const allTemplates: EmailTemplate[] = [
    'email-confirmation',
    'welcome',
    'password-reset',
    'letter-approved',
    'letter-rejected',
    'commission-earned',
    'subscription-confirmation',
    'subscription-renewal',
    'password-reset-confirmation',
    'letter-generated',
    'letter-under-review',
    'commission-paid',
    'subscription-cancelled',
    'payment-failed',
    'account-suspended',
    'free-trial-ending',
    'onboarding-complete',
    'security-alert',
    'system-maintenance',
    'admin-alert',
  ]

  describe('Template Rendering', () => {
    it.each(allTemplates)('should render %s template without errors', (template) => {
      const data: TemplateData = {
        userName: 'Test User',
        actionUrl: 'https://example.com/action',
      }

      expect(() => renderTemplate(template, data)).not.toThrow()
    })

    it.each(allTemplates)('%s should return subject, text, and html', (template) => {
      const data: TemplateData = {
        userName: 'Test User',
        actionUrl: 'https://example.com/action',
      }

      const result = renderTemplate(template, data)

      expect(result.subject).toBeDefined()
      expect(result.subject.length).toBeGreaterThan(0)
      expect(result.text).toBeDefined()
      expect(result.text.length).toBeGreaterThan(0)
      expect(result.html).toBeDefined()
      expect(result.html.length).toBeGreaterThan(0)
    })

    it('should throw error for unknown template', () => {
      expect(() =>
        renderTemplate('non-existent-template' as EmailTemplate, {})
      ).toThrow('Unknown email template')
    })
  })

  describe('XSS Prevention', () => {
    it('should escape HTML in userName', () => {
      const maliciousName = '<script>alert("xss")</script>'
      const result = renderTemplate('welcome', {
        userName: maliciousName,
        actionUrl: 'https://example.com',
      })

      expect(result.html).not.toContain('<script>')
      expect(result.html).toContain('&lt;script&gt;')
    })

    it('should escape HTML in letterTitle', () => {
      const maliciousTitle = '<img src=x onerror=alert(1)>'
      const result = renderTemplate('letter-approved', {
        userName: 'User',
        letterTitle: maliciousTitle,
        letterLink: 'https://example.com',
      })

      expect(result.html).not.toContain('<img src=x')
      expect(result.html).toContain('&lt;img')
    })

    it('should escape HTML in actionUrl', () => {
      const maliciousUrl = 'javascript:alert(1)'
      const result = renderTemplate('welcome', {
        userName: 'User',
        actionUrl: maliciousUrl,
      })

      // URL should be escaped but still present
      expect(result.html).toContain('href=')
    })

    it('should escape HTML in alertMessage', () => {
      const maliciousMessage = '<iframe src="evil.com"></iframe>'
      const result = renderTemplate('security-alert', {
        alertMessage: maliciousMessage,
        actionUrl: 'https://example.com',
      })

      expect(result.html).not.toContain('<iframe')
      expect(result.html).toContain('&lt;iframe')
    })

    it('should convert newlines to br tags safely', () => {
      const messageWithNewlines = 'Line 1\nLine 2\n<script>bad</script>'
      const result = renderTemplate('letter-rejected', {
        userName: 'User',
        letterTitle: 'Letter',
        alertMessage: messageWithNewlines,
        letterLink: 'https://example.com',
      })

      expect(result.html).toContain('<br>')
      expect(result.html).not.toContain('<script>')
    })
  })

  describe('Individual Templates', () => {
    describe('email-confirmation', () => {
      it('should include confirmation link', () => {
        const result = renderTemplate('email-confirmation', {
          userName: 'John',
          actionUrl: 'https://example.com/confirm?token=abc123',
        })

        expect(result.subject).toContain('Confirm Your Email')
        // HTML version has URLs escaped for XSS protection
        expect(result.html).toContain('confirm')
        expect(result.html).toContain('token=abc123')
        // Text version should have the raw URL
        expect(result.text).toContain('https://example.com/confirm?token=abc123')
      })

      it('should handle missing userName gracefully', () => {
        const result = renderTemplate('email-confirmation', {
          actionUrl: 'https://example.com/confirm',
        })

        expect(result.html).toContain('there')
      })
    })

    describe('welcome', () => {
      it('should include onboarding steps', () => {
        const result = renderTemplate('welcome', {
          userName: 'Jane',
          actionUrl: 'https://example.com/dashboard',
        })

        expect(result.html).toContain('Getting Started')
        expect(result.html).toContain('first letter is free')
        expect(result.text).toContain('first letter is free')
      })
    })

    describe('password-reset', () => {
      it('should include reset link and expiration warning', () => {
        const result = renderTemplate('password-reset', {
          actionUrl: 'https://example.com/reset?token=xyz',
        })

        expect(result.subject).toContain('Reset Your Password')
        expect(result.html).toContain('expire in 1 hour')
        expect(result.text).toContain('expire in 1 hour')
      })
    })

    describe('letter-approved', () => {
      it('should include letter title and next steps', () => {
        const result = renderTemplate('letter-approved', {
          userName: 'Mike',
          letterTitle: 'Demand Letter to ABC Corp',
          letterLink: 'https://example.com/letters/123',
        })

        expect(result.subject).toContain('Approved')
        expect(result.subject).toContain('Demand Letter to ABC Corp')
        expect(result.html).toContain('Download as PDF')
        expect(result.html).toContain('Send directly to the recipient')
      })
    })

    describe('letter-rejected', () => {
      it('should include rejection reason', () => {
        const result = renderTemplate('letter-rejected', {
          userName: 'Sarah',
          letterTitle: 'My Letter',
          alertMessage: 'Please provide more specific details about the incident date.',
          letterLink: 'https://example.com/letters/456',
        })

        expect(result.subject).toContain('Action Required')
        expect(result.html).toContain('specific details about the incident date')
        expect(result.text).toContain('specific details about the incident date')
      })
    })

    describe('commission-earned', () => {
      it('should format commission amount correctly', () => {
        const result = renderTemplate('commission-earned', {
          userName: 'Employee',
          commissionAmount: 25.5,
          actionUrl: 'https://example.com/employee/dashboard',
        })

        expect(result.subject).toContain('$25.50')
        expect(result.html).toContain('$25.50')
      })

      it('should handle zero commission', () => {
        const result = renderTemplate('commission-earned', {
          userName: 'Employee',
          commissionAmount: 0,
          actionUrl: 'https://example.com/employee/dashboard',
        })

        expect(result.html).toContain('$0.00')
      })
    })

    describe('subscription-confirmation', () => {
      it('should include plan name', () => {
        const result = renderTemplate('subscription-confirmation', {
          userName: 'Subscriber',
          subscriptionPlan: 'Professional Plan',
          actionUrl: 'https://example.com/dashboard',
        })

        expect(result.subject).toContain('Subscription Confirmed')
        expect(result.html).toContain('Professional Plan')
      })
    })

    describe('payment-failed', () => {
      it('should include payment details and recovery steps', () => {
        const result = renderTemplate('payment-failed', {
          userName: 'Customer',
          subscriptionPlan: 'Premium Plan',
          amountDue: 49.99,
          actionUrl: 'https://example.com/billing',
        })

        expect(result.subject).toContain('Payment Failed')
        expect(result.html).toContain('49.99')
        expect(result.html).toContain('Update Payment Method')
      })
    })

    describe('free-trial-ending', () => {
      it('should show days remaining', () => {
        const result = renderTemplate('free-trial-ending', {
          userName: 'Trial User',
          trialDaysRemaining: 3,
          actionUrl: 'https://example.com/upgrade',
        })

        expect(result.subject).toContain('3 Days Left')
        expect(result.html).toContain('3 days')
      })

      it('should handle singular day', () => {
        const result = renderTemplate('free-trial-ending', {
          userName: 'Trial User',
          trialDaysRemaining: 1,
          actionUrl: 'https://example.com/upgrade',
        })

        expect(result.html).toContain('1 day')
        expect(result.html).not.toContain('1 days')
      })
    })

    describe('onboarding-complete', () => {
      it('should calculate and show progress percentage', () => {
        const result = renderTemplate('onboarding-complete', {
          userName: 'New User',
          completedSteps: 2,
          totalSteps: 4,
          actionUrl: 'https://example.com/continue',
        })

        expect(result.subject).toContain('50%')
        expect(result.html).toContain('50%')
      })

      it('should show completion message when all steps done', () => {
        const result = renderTemplate('onboarding-complete', {
          userName: 'New User',
          completedSteps: 4,
          totalSteps: 4,
          actionUrl: 'https://example.com/continue',
        })

        expect(result.html).toContain('All steps completed')
      })
    })

    describe('security-alert', () => {
      it('should have urgent styling', () => {
        const result = renderTemplate('security-alert', {
          alertMessage: 'Unusual login detected from new device',
          actionUrl: 'https://example.com/security',
        })

        expect(result.subject).toContain('Security Alert')
        expect(result.html).toContain('#dc2626') // Red color for urgency
        expect(result.html).toContain('Immediate Action Required')
      })
    })

    describe('system-maintenance', () => {
      it('should extract duration from message', () => {
        const result = renderTemplate('system-maintenance', {
          alertMessage: 'Scheduled maintenance for 4 hours',
        })

        expect(result.subject).toContain('4 hours')
        expect(result.html).toContain('4 hours')
      })

      it('should default to 2 hours if not specified', () => {
        const result = renderTemplate('system-maintenance', {
          alertMessage: 'General maintenance',
        })

        expect(result.html).toContain('2 hours')
      })
    })

    describe('admin-alert', () => {
      it('should include pending review count', () => {
        const result = renderTemplate('admin-alert', {
          alertMessage: 'New letters pending review',
          pendingReviews: 5,
          actionUrl: 'https://example.com/admin/review',
        })

        expect(result.html).toContain('Pending Reviews')
        expect(result.html).toContain('5')
      })
    })
  })

  describe('Unsubscribe Link', () => {
    it('should include unsubscribe link when provided', () => {
      const result = renderTemplate('welcome', {
        userName: 'User',
        actionUrl: 'https://example.com',
        unsubscribeUrl: 'https://example.com/unsubscribe?token=abc',
      })

      expect(result.html).toContain('Unsubscribe')
      // URL is HTML-escaped for XSS protection (slashes become &#x2F;)
      expect(result.html).toContain('unsubscribe')
      expect(result.html).toContain('token=abc')
    })

    it('should not include unsubscribe link when not provided', () => {
      const result = renderTemplate('welcome', {
        userName: 'User',
        actionUrl: 'https://example.com',
      })

      expect(result.html).not.toContain('Unsubscribe from these emails')
    })
  })

  describe('Site URL Configuration', () => {
    it('should use NEXT_PUBLIC_SITE_URL', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://my-custom-domain.com'
      delete process.env.NEXT_PUBLIC_APP_URL

      const result = renderTemplate('welcome', {
        userName: 'User',
        actionUrl: 'https://example.com',
      })

      expect(result.html).toContain('https://my-custom-domain.com')
    })

    it('should fallback to NEXT_PUBLIC_APP_URL', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL
      process.env.NEXT_PUBLIC_APP_URL = 'https://app-url.com'

      const result = renderTemplate('welcome', {
        userName: 'User',
        actionUrl: 'https://example.com',
      })

      expect(result.html).toContain('https://app-url.com')
    })

    it('should use default URL when neither is set', () => {
      delete process.env.NEXT_PUBLIC_SITE_URL
      delete process.env.NEXT_PUBLIC_APP_URL

      const result = renderTemplate('welcome', {
        userName: 'User',
        actionUrl: 'https://example.com',
      })

      expect(result.html).toContain('https://talk-to-my-lawyer.com')
    })
  })

  describe('Text Version Quality', () => {
    it.each(allTemplates)('%s text version should be readable', (template) => {
      const data: TemplateData = {
        userName: 'Test User',
        actionUrl: 'https://example.com/action',
        letterTitle: 'Test Letter',
        alertMessage: 'Test message',
        commissionAmount: 100,
        subscriptionPlan: 'Test Plan',
      }

      const result = renderTemplate(template, data)

      // Text should not contain HTML tags
      expect(result.text).not.toMatch(/<[^>]+>/)

      // Text should have meaningful content
      expect(result.text.length).toBeGreaterThan(50)
    })
  })

  describe('HTML Structure', () => {
    it.each(allTemplates)('%s HTML should be valid', (template) => {
      const data: TemplateData = {
        userName: 'Test User',
        actionUrl: 'https://example.com/action',
      }

      const result = renderTemplate(template, data)

      // Should have DOCTYPE
      expect(result.html).toContain('<!DOCTYPE html>')

      // Should have proper structure
      expect(result.html).toContain('<html>')
      expect(result.html).toContain('</html>')
      expect(result.html).toContain('<head>')
      expect(result.html).toContain('<body>')

      // Should have meta tags
      expect(result.html).toContain('charset="utf-8"')
      expect(result.html).toContain('viewport')
    })
  })

  describe('templates export', () => {
    it('should export all template functions', () => {
      expect(Object.keys(templates)).toHaveLength(allTemplates.length)
      allTemplates.forEach((template) => {
        expect(templates[template]).toBeDefined()
        expect(typeof templates[template]).toBe('function')
      })
    })
  })
})
