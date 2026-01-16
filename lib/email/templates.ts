import type { EmailTemplate, TemplateData } from './types'

/**
 * HTML escape utility to prevent XSS in email templates.
 * Escapes special HTML characters to their entity equivalents.
 *
 * This prevents malicious user input from being rendered as HTML
 * which could lead to email spoofing, XSS in vulnerable email clients,
 * or other security issues.
 */
function escapeHtml(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return ''
  const str = String(text)

  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
    '`': '&#96;',
  }

  return str.replace(/[&<>"'/`]/g, (char) => htmlEntities[char] || char)
}

/**
 * Convert newlines to <br> tags for multi-line content in HTML emails.
 * Applied after HTML escaping to maintain formatting while preserving security.
 */
function nl2br(text: string | number | undefined | null): string {
  return escapeHtml(text).replace(/\n/g, '<br>')
}

interface TemplateOutput {
  subject: string
  text: string
  html: string
}

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: #1a1a2e; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
  .header h1 { margin: 0; font-size: 24px; }
  .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
  .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
  .footer a { color: #1a1a2e; text-decoration: underline; }
  .button { display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  .highlight { background: #f0f9ff; padding: 15px; border-left: 4px solid #0284c7; margin: 20px 0; }
  .unsubscribe { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0; }
`

// Get site URL from environment or use default
function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://talk-to-my-lawyer.com'
}

function wrapHtml(content: string, unsubscribeUrl?: string): string {
  const siteUrl = getSiteUrl()

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Talk-To-My-Lawyer</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p><strong>Talk-To-My-Lawyer</strong> | Professional Legal Letter Services</p>
      <p>123 Legal Street, Suite 100<br>San Francisco, CA 94102</p>
      <p><a href="${siteUrl}">${siteUrl}</a></p>
      ${unsubscribeUrl ? `<div class="unsubscribe"><p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from these emails</a></p></div>` : ''}
      <p style="margin-top: 15px; color: #999;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`
}

const templates: Record<EmailTemplate, (data: TemplateData) => TemplateOutput> = {
  'email-confirmation': (data) => ({
    subject: 'Confirm Your Email - Talk-To-My-Lawyer',
    text: `
Confirm Your Email Address

Hi ${data.userName || 'there'},

Please confirm your email address to complete your registration with Talk-To-My-Lawyer.

Click the link below to verify your email:
${data.actionUrl || ''}

If you didn't create an account with us, you can safely ignore this email.

This link will expire in 24 hours.

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Confirm Your Email Address</h2>
      <p>Hi ${escapeHtml(data.userName || 'there')},</p>

      <p>Please confirm your email address to complete your registration with Talk-To-My-Lawyer.</p>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.actionUrl || '')}" class="button">Confirm Email Address</a>
      </p>

      <p><small>If you didn't create an account with us, you can safely ignore this email. This link will expire in 24 hours.</small></p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  welcome: (data) => ({
    subject: 'Welcome to Talk-To-My-Lawyer',
    text: `
Welcome to Talk-To-My-Lawyer, ${data.userName || 'there'}!

Thank you for signing up. You now have access to professional legal letter generation services with attorney review.

Getting Started:
1. Create your first letter from the dashboard
2. Fill out the intake form with your situation details
3. Our AI will generate a professional draft
4. A licensed attorney will review and finalize your letter

Your first letter is free!

Visit your dashboard: ${data.actionUrl || 'https://talk-to-my-lawyer.com/dashboard'}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Welcome, ${escapeHtml(data.userName || 'there')}!</h2>
      <p>Thank you for signing up for Talk-To-My-Lawyer. You now have access to professional legal letter generation services with attorney review.</p>

      <div class="highlight">
        <strong>Your first letter is free!</strong> Get started right away.
      </div>

      <h3>Getting Started</h3>
      <ol>
        <li>Create your first letter from the dashboard</li>
        <li>Fill out the intake form with your situation details</li>
        <li>Our AI will generate a professional draft</li>
        <li>A licensed attorney will review and finalize your letter</li>
      </ol>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.actionUrl || 'https://talk-to-my-lawyer.com/dashboard')}" class="button">Go to Dashboard</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'password-reset': (data) => ({
    subject: 'Reset Your Password - Talk-To-My-Lawyer',
    text: `
Password Reset Request

We received a request to reset your password. Click the link below to create a new password:

${data.actionUrl}

If you didn't request this, you can safely ignore this email.

This link will expire in 1 hour.

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.actionUrl || '')}" class="button">Reset Password</a>
      </p>

      <p><small>If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.</small></p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'letter-approved': (data) => ({
    subject: `Your Letter Has Been Approved - ${escapeHtml(data.letterTitle || 'Legal Letter')}`,
    text: `
Good news, ${data.userName || 'there'}!

Your letter "${data.letterTitle || 'Legal Letter'}" has been reviewed and approved by our attorney.

What's next:
- View the final letter in your dashboard
- Download as PDF
- Send directly to the recipient

View your letter: ${data.letterLink || data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Your Letter Has Been Approved!</h2>
      <p>Good news, ${escapeHtml(data.userName || 'there')}!</p>

      <div class="highlight">
        <strong>"${escapeHtml(data.letterTitle || 'Legal Letter')}"</strong> has been reviewed and approved by our attorney.
      </div>

      <h3>What's next?</h3>
      <ul>
        <li>View the final letter in your dashboard</li>
        <li>Download as PDF</li>
        <li>Send directly to the recipient</li>
      </ul>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.letterLink || data.actionUrl || '')}" class="button">View Your Letter</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'letter-rejected': (data) => ({
    subject: `Action Required: Letter Needs Revision - ${escapeHtml(data.letterTitle || 'Legal Letter')}`,
    text: `
Hello ${data.userName || 'there'},

Your letter "${data.letterTitle || 'Legal Letter'}" requires some changes before it can be approved.

Reason: ${data.alertMessage || 'Please review the feedback in your dashboard.'}

Please visit your dashboard to review the feedback and make necessary updates.

View your letter: ${data.letterLink || data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Your Letter Needs Revision</h2>
      <p>Hello ${escapeHtml(data.userName || 'there')},</p>

      <p>Your letter <strong>"${escapeHtml(data.letterTitle || 'Legal Letter')}"</strong> requires some changes before it can be approved.</p>

      <div class="highlight">
        <strong>Feedback:</strong><br>
        ${nl2br(data.alertMessage || 'Please review the feedback in your dashboard.')}
      </div>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.letterLink || data.actionUrl || '')}" class="button">Review Feedback</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'commission-earned': (data) => ({
    subject: `Commission Earned - $${escapeHtml((data.commissionAmount || 0).toFixed(2))}`,
    text: `
Congratulations, ${data.userName || 'there'}!

You've earned a new commission!

Amount: $${(data.commissionAmount || 0).toFixed(2)}

This has been added to your pending balance. View your earnings in the dashboard.

Dashboard: ${data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Commission Earned!</h2>
      <p>Congratulations, ${escapeHtml(data.userName || 'there')}!</p>

      <div class="highlight">
        <strong>New Commission:</strong> $${escapeHtml((data.commissionAmount || 0).toFixed(2))}
      </div>

      <p>This has been added to your pending balance. View your earnings in the dashboard.</p>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.actionUrl || '')}" class="button">View Earnings</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'subscription-confirmation': (data) => ({
    subject: 'Subscription Confirmed - Talk-To-My-Lawyer',
    text: `
Thank you for your subscription, ${data.userName || 'there'}!

Plan: ${data.subscriptionPlan || 'Legal Letters Plan'}

You now have access to generate professional legal letters with attorney review.

Visit your dashboard to get started: ${data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Subscription Confirmed!</h2>
      <p>Thank you for your subscription, ${escapeHtml(data.userName || 'there')}!</p>

      <div class="highlight">
        <strong>Your Plan:</strong> ${escapeHtml(data.subscriptionPlan || 'Legal Letters Plan')}
      </div>

      <p>You now have access to generate professional legal letters with attorney review.</p>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.actionUrl || '')}" class="button">Go to Dashboard</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'subscription-renewal': (data) => ({
    subject: 'Subscription Renewal Reminder - Talk-To-My-Lawyer',
    text: `
Hello ${data.userName || 'there'},

Your ${data.subscriptionPlan || 'subscription'} is coming up for renewal soon.

Manage your subscription: ${data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Subscription Renewal Reminder</h2>
      <p>Hello ${escapeHtml(data.userName || 'there')},</p>

      <p>Your <strong>${escapeHtml(data.subscriptionPlan || 'subscription')}</strong> is coming up for renewal soon.</p>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.actionUrl || '')}" class="button">Manage Subscription</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'password-reset-confirmation': (data) => ({
    subject: 'Password Successfully Reset - Talk-To-My-Lawyer',
    text: `
    Password Reset Confirmation

Hi ${data.userName || 'there'},

Your password has been successfully reset for your Talk-To-My-Lawyer account.

If you didn't make this change, please contact our support team immediately.

Login with your new password: ${data.loginUrl || 'https://talk-to-my-lawyer.com/auth/login'}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Password Successfully Reset</h2>
      <p>Hi ${escapeHtml(data.userName || 'there')},</p>

      <div class="highlight">
        <strong>Your password has been successfully reset</strong> for your Talk-To-My-Lawyer account.
      </div>

      <p>If you didn't make this change, please contact our support team immediately.</p>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.loginUrl || 'https://talk-to-my-lawyer.com/auth/login')}" class="button">Login with New Password</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'letter-generated': (data) => ({
    subject: `Your Legal Letter is Ready for Review - ${escapeHtml(data.letterTitle || 'Legal Letter')}`,
    text: `
    Your Letter is Ready for Review

Hi ${data.userName || 'there'},

Great news! Your legal letter "${data.letterTitle || 'Legal Letter'}" has been generated by our AI and is now ready for attorney review.

What happens next:
1. Our licensed attorneys will review your letter
2. They may make edits for legal compliance
3. You'll receive an email once it's approved
4. You can then download the final letter

Track the status in your dashboard: ${data.actionUrl}

This usually takes 24-48 hours during business hours.

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Your Legal Letter is Ready for Review!</h2>
      <p>Hi ${escapeHtml(data.userName || 'there')},</p>

      <p>Great news! Your legal letter <strong>"${escapeHtml(data.letterTitle || 'Legal Letter')}"</strong> has been generated by our AI and is now ready for attorney review.</p>

      <div class="highlight">
        <strong>What happens next?</strong>
        <ol>
          <li>Our licensed attorneys will review your letter</li>
          <li>They may make edits for legal compliance</li>
          <li>You'll receive an email once it's approved</li>
          <li>You can then download the final letter</li>
        </ol>
      </div>

      <p><small>This usually takes 24-48 hours during business hours.</small></p>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.actionUrl || '')}" class="button">Track Letter Status</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'letter-under-review': (data) => ({
    subject: `Your Letter is Under Review - ${escapeHtml(data.letterTitle || 'Legal Letter')}`,
    text: `
    Your Letter is Under Review

Hi ${data.userName || 'there'},

Your letter "${data.letterTitle || 'Legal Letter'}" is currently under review by our licensed attorneys.

Current status: ${data.alertMessage || 'Being reviewed for legal compliance and accuracy'}

We'll notify you as soon as the review is complete. You can track the progress in your dashboard.

Pending reviews in queue: ${data.pendingReviews || '1'}

Track your letter: ${data.letterLink || data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Your Letter is Under Review</h2>
      <p>Hi ${escapeHtml(data.userName || 'there')},</p>

      <p>Your letter <strong>"${escapeHtml(data.letterTitle || 'Legal Letter')}"</strong> is currently under review by our licensed attorneys.</p>

      <div class="highlight">
        <strong>Current Status:</strong> ${nl2br(data.alertMessage || 'Being reviewed for legal compliance and accuracy')}
        <br><small>There are ${escapeHtml(String(data.pendingReviews || '1'))} letters pending in the queue.</small>
      </div>

      <p>We'll notify you as soon as the review is complete. You can track the progress in your dashboard.</p>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.letterLink || data.actionUrl || '')}" class="button">Track Progress</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'commission-paid': (data) => ({
    subject: `Commission Paid - $${escapeHtml((data.commissionAmount || 0).toFixed(2))}`,
    text: `
    Commission Payment Processed

Hi ${data.userName || 'there'},

Good news! A commission payment of $${(data.commissionAmount || 0).toFixed(2)} has been processed.

This payment has been added to your available balance and can be withdrawn.

View your earnings dashboard: ${data.actionUrl}

Thank you for your contributions!

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Commission Paid!</h2>
      <p>Hi ${escapeHtml(data.userName || 'there')},</p>

      <div class="highlight">
        <strong>Payment Processed:</strong> $${escapeHtml((data.commissionAmount || 0).toFixed(2))}
      </div>

      <p>Good news! A commission payment has been processed and added to your available balance.</p>

      <p>Thank you for your contributions!</p>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.actionUrl || '')}" class="button">View Earnings</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'subscription-cancelled': (data) => {
    const plan = escapeHtml(data.subscriptionPlan || 'subscription')
    return {
      subject: `Subscription Cancelled - Talk-To-My-Lawyer`,
      text: `
Subscription Cancelled

Hi ${data.userName || 'there'},

Your ${plan} has been cancelled as per your request.

While we're sorry to see you go, we'd love to understand how we can better serve your needs.

If you change your mind, you can reactivate your subscription at any time.

Manage subscriptions: ${data.actionUrl}

Thank you for being part of Talk-To-My-Lawyer!

Best regards,
The Talk-To-My-Lawyer Team
      `.trim(),
      html: wrapHtml(`
        <h2>Subscription Cancelled</h2>
        <p>Hi ${escapeHtml(data.userName || 'there')},</p>

        <p>Your <strong>${plan}</strong> has been cancelled as per your request.</p>

        <div class="highlight">
          While we're sorry to see you go, we'd love to understand how we can better serve your needs.
        </div>

        <p>If you change your mind, you can reactivate your subscription at any time.</p>

        <p style="text-align: center;">
          <a href="${escapeHtml(data.actionUrl || '')}" class="button">Manage Subscriptions</a>
        </p>

        <p>Thank you for being part of Talk-To-My-Lawyer!</p>
      `, data.unsubscribeUrl,)
    }
  },

  'payment-failed': (data) => {
    const plan = escapeHtml(data.subscriptionPlan || 'subscription')
    const amount = escapeHtml(String(data.amountDue || 'Your plan amount'))
    return {
      subject: `Payment Failed - Talk-To-My-Lawyer`,
      text: `
Payment Failed

Hi ${data.userName || 'there'},

We were unable to process your payment for the ${plan}.

Amount due: $${amount}

What you can do:
1. Check your payment method details
2. Try a different payment method
3. Update your billing information
4. Contact our support team for assistance

Manage subscription: ${data.actionUrl}

If you continue to experience issues, please contact our support team.

Best regards,
The Talk-To-My-Lawyer Team
      `.trim(),
      html: wrapHtml(`
        <h2>Payment Failed</h2>
        <p>Hi ${escapeHtml(data.userName || 'there')},</p>

        <p>We were unable to process your payment for the <strong>${plan}</strong>.</p>

        <div class="highlight">
          <strong>Amount due:</strong> $${amount}
        </div>

        <p><strong>What you can do:</strong></p>
        <ul>
          <li>Check your payment method details</li>
          <li>Try a different payment method</li>
          <li>Update your billing information</li>
          <li>Contact our support team for assistance</li>
        </ul>

        <p style="text-align: center;">
          <a href="${escapeHtml(data.actionUrl || '')}" class="button">Update Payment Method</a>
        </p>

        <p>If you continue to experience issues, please contact our support team.</p>

        <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
      `, data.unsubscribeUrl,)
    }
  },

  'account-suspended': (data) => ({
    subject: `Account Suspended - Talk-To-My-Lawyer`,
    text: `
    Account Suspended

    Hi ${data.userName || 'there'},

    Your Talk-To-My-Lawyer account has been suspended.

    Reason: ${data.suspensionReason || 'Policy violation'}

    Next steps:
    - Review our Terms of Service
    - Contact support if you believe this is an error
    - Appeal the suspension if applicable

    Contact support: ${data.actionUrl}

    Best regards,
    The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Account Suspended</h2>
      <p>Hi ${escapeHtml(data.userName || 'there')},</p>

      <p>Your Talk-To-My-Lawyer account has been suspended.</p>

      <div class="highlight">
        <strong>Reason:</strong> ${nl2br(data.suspensionReason || 'Policy violation')}
      </div>

      <p><strong>Next steps:</strong></p>
      <ul>
        <li>Review our Terms of Service</li>
        <li>Contact support if you believe this is an error</li>
        <li>Appeal the suspension if applicable</li>
      </ul>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.actionUrl || '')}" class="button">Contact Support</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `, data.unsubscribeUrl,)
  }),

  'free-trial-ending': (data) => {
    const days = Number(data.trialDaysRemaining) || 0
    return {
      subject: `Free Trial Ending - ${days} Days Left`,
      text: `
      Free Trial Ending

      Hi ${data.userName || 'there'},

      Your free trial is ending in ${days} day${days === 1 ? '' : 's'}.

      Don't miss out on professional legal letter services:
      - Unlimited letter generation
      - Attorney review for each letter
      - Download professional PDFs
      - Email delivery to recipients

      Upgrade before your trial ends to keep your access.

      Upgrade now: ${data.actionUrl}

      Best regards,
      The Talk-To-My-Lawyer Team
      `.trim(),
      html: wrapHtml(`
        <h2>Free Trial Ending Soon</h2>
        <p>Hi ${escapeHtml(data.userName || 'there')},</p>

        <p>Your free trial is ending in <strong>${days} day${days === 1 ? '' : 's'}</strong>.</p>

        <div class="highlight">
          <p><strong>Don't miss out on:</strong></p>
          <ul>
            <li>Unlimited letter generation</li>
            <li>Attorney review for each letter</li>
            <li>Download professional PDFs</li>
            <li>Email delivery to recipients</li>
          </ul>
        </div>

        <p style="text-align: center;">
          <a href="${escapeHtml(data.actionUrl || '')}" class="button">Upgrade Now</a>
        </p>

        <p>Upgrade before your trial ends to keep your access.</p>

        <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
      `, data.unsubscribeUrl,)
    }
  },

  'onboarding-complete': (data) => {
    const completed = Number(data.completedSteps) || 0
    const total = Number(data.totalSteps) || 4
    return {
      subject: `Welcome Aboard! You're ${Math.round((completed / total) * 100)}% Complete`,
      text: `
        Welcome Aboard!

        Hi ${data.userName || 'there'},

        Great job! You're ${Math.round((completed / total) * 100)}% of the way through our onboarding process.

        What you've completed:
        ${completed === total ? '✅ All steps completed!' : `Step ${completed} of ${total}`}

        If you need any help or have questions, our support team is here for you.

        Continue your journey: ${data.actionUrl}

        Best regards,
        The Talk-To-My-Lawyer Team
      `.trim(),
      html: wrapHtml(`
        <h2>Welcome Aboard! 🎉</h2>
        <p>Hi ${escapeHtml(data.userName || 'there')},</p>

        <div class="highlight">
          <p><strong>Progress: ${Math.round((completed / total) * 100)}%</strong></p>
          <p>${completed === total ? '✅ All steps completed!' : `Step ${completed} of ${total}`}</p>
        </div>

        <p>Great job getting started! If you need any help or have questions, our support team is here for you.</p>

        <p style="text-align: center;">
          <a href="${escapeHtml(data.actionUrl || '')}" class="button">Continue Your Journey</a>
        </p>

        <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
      `, data.unsubscribeUrl,)
    }
  },

  'security-alert': (data) => ({
    subject: `⚠️ Security Alert: ${escapeHtml(data.alertMessage || 'Security Issue Detected')}`,
    text: `
    Security Alert

    ${data.alertMessage || 'A security event has been detected that requires immediate attention.'}

    Immediate Action Required: ${data.actionUrl}

    Please review this alert immediately and take appropriate action.

    Best regards,
    Talk-To-My-Lawyer Security Team
    `.trim(),
    html: wrapHtml(`
      <h2>⚠️ Security Alert</h2>

      <div class="highlight" style="border-left: 4px solid #dc2626; background: #fef2f2;">
        <p><strong>Security Alert:</strong> ${nl2br(data.alertMessage || 'A security event has been detected that requires immediate attention.')}</p>
      </div>

      <p><strong>Immediate Action Required:</strong></p>

      <p style="text-align: center;">
        <a href="${escapeHtml(data.actionUrl || '')}" class="button" style="background-color: #dc2626;">Review Alert</a>
      </p>

      <p>Please review this alert immediately and take appropriate action.</p>

      <p>Best regards,<br>Talk-To-My-Lawyer Security Team</p>
    `, data.unsubscribeUrl,)
  }),

  'system-maintenance': (data) => {
    const duration = String(data.alertMessage || '').match(/(\d+ hours?)/)?.[1] || '2 hours'
    return {
      subject: `Scheduled Maintenance - ${duration}`,
      text: `
        System Maintenance

        We'll be performing scheduled maintenance for approximately ${duration}.

        During this time:
        - Some features may be temporarily unavailable
        - Existing data will be preserved
        - No emails will be lost

        We apologize for any inconvenience and appreciate your patience.

        Status updates will be available in your dashboard.

        Best regards,
        The Talk-To-My-Lawyer Team
      `.trim(),
      html: wrapHtml(`
        <h2>🔧 Scheduled Maintenance</h2>

        <p>We'll be performing scheduled maintenance for approximately <strong>${escapeHtml(duration)}</strong>.</p>

        <div class="highlight">
          <p>During this time:</p>
          <ul>
            <li>Some features may be temporarily unavailable</li>
            <li>Existing data will be preserved</li>
            <li>No emails will be lost</li>
          </ul>
        </div>

        <p>We apologize for any inconvenience and appreciate your patience.</p>

        <p>Status updates will be available in your dashboard.</p>

        <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
      `, data.unsubscribeUrl,)
    }
  },
  'admin-alert': (data) => ({
    subject: `Admin Alert: ${escapeHtml(data.alertMessage || 'System Notification')}`,
    text: `
      Admin Alert

      ${data.alertMessage || 'A system event requires your attention.'}

      ${data.actionUrl ? `Action required: ${data.actionUrl}` : ''}

      ${data.pendingReviews ? `Pending Reviews: ${data.pendingReviews}` : ''}

      Please review and take appropriate action.

      - Talk-To-My-Lawyer System
    `.trim(),
    html: wrapHtml(`
      <h2>⚠️ Admin Alert</h2>

      <div class="highlight">
        <p>${nl2br(data.alertMessage || 'A system event requires your attention.')}</p>
      </div>

      ${data.pendingReviews ? `<p><strong>Pending Reviews:</strong> ${escapeHtml(String(data.pendingReviews))}</p>` : ''}

      ${data.actionUrl ? `<a href="${escapeHtml(data.actionUrl || '')}" class="button">Take Action</a>` : ''}

      <p>Please review and take appropriate action.</p>

      <p>- Talk-To-My-Lawyer System</p>
    `, data.unsubscribeUrl,)
  }),
}

export function renderTemplate(template: EmailTemplate, data: TemplateData): TemplateOutput {
  const templateFn = templates[template]
  if (!templateFn) {
    throw new Error(`Unknown email template: ${template}`)
  }
  return templateFn(data)
}

export { templates }
