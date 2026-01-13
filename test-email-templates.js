#!/usr/bin/env node

// Test email templates and service directly
import { Resend } from 'resend'

// Email template for confirmation
const emailConfirmationTemplate = (userName, actionUrl) => ({
  subject: 'Confirm Your Email - Talk-To-My-Lawyer',
  text: `
Confirm Your Email Address

Hi ${userName || 'there'},

Please confirm your email address to complete your registration with Talk-To-My-Lawyer.

Click the link below to verify your email:
${actionUrl || ''}

If you didn't create an account with us, you can safely ignore this email.

This link will expire in 24 hours.

Best regards,
The Talk-To-My-Lawyer Team
  `.trim(),
  html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .highlight { background: #f0f9ff; padding: 15px; border-left: 4px solid #0284c7; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Talk-To-My-Lawyer</h1>
    </div>
    <div class="content">
      <h2>Confirm Your Email Address</h2>
      <p>Hi ${userName || 'there'},</p>

      <p>Please confirm your email address to complete your registration with Talk-To-My-Lawyer.</p>

      <p style="text-align: center;">
        <a href="${actionUrl || ''}" class="button">Confirm Email Address</a>
      </p>

      <p><small>If you didn't create an account with us, you can safely ignore this email. This link will expire in 24 hours.</small></p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    </div>
    <div class="footer">
      <p>Talk-To-My-Lawyer | Professional Legal Letter Services</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`
})

async function testEmailTemplates() {
  console.log('📧 Testing Email Templates and Service...\n')

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    // Test 1: Email confirmation template
    console.log('1️⃣ Testing email confirmation template...')
    
    const confirmationTemplate = emailConfirmationTemplate(
      'Test User',
      'https://talk-to-my-lawyer.com/auth/confirm?token=test123'
    )

    const { data: confirmData, error: confirmError } = await resend.emails.send({
      from: 'Talk-To-My-Lawyer <noreply@talk-to-my-lawyer.com>',
      to: ['moizj00@gmail.com'],
      subject: confirmationTemplate.subject,
      html: confirmationTemplate.html,
      text: confirmationTemplate.text
    })

    if (confirmError) {
      console.error('❌ Error sending confirmation email:', confirmError)
    } else {
      console.log('✅ Confirmation email sent successfully!')
      console.log('📬 Message ID:', confirmData.id)
    }

    // Test 2: Welcome email template
    console.log('\n2️⃣ Testing welcome email template...')
    
    const { data: welcomeData, error: welcomeError } = await resend.emails.send({
      from: 'Talk-To-My-Lawyer <noreply@talk-to-my-lawyer.com>',
      to: ['moizj00@gmail.com'],
      subject: 'Welcome to Talk-To-My-Lawyer',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .highlight { background: #f0f9ff; padding: 15px; border-left: 4px solid #0284c7; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Talk-To-My-Lawyer</h1>
    </div>
    <div class="content">
      <h2>Welcome, Test User!</h2>
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
        <a href="https://talk-to-my-lawyer.com/dashboard" class="button">Go to Dashboard</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    </div>
    <div class="footer">
      <p>Talk-To-My-Lawyer | Professional Legal Letter Services</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`,
      text: `
Welcome to Talk-To-My-Lawyer, Test User!

Thank you for signing up. You now have access to professional legal letter generation services with attorney review.

Getting Started:
1. Create your first letter from the dashboard
2. Fill out the intake form with your situation details
3. Our AI will generate a professional draft
4. A licensed attorney will review and finalize your letter

Your first letter is free!

Visit your dashboard: https://talk-to-my-lawyer.com/dashboard

Best regards,
The Talk-To-My-Lawyer Team
      `.trim()
    })

    if (welcomeError) {
      console.error('❌ Error sending welcome email:', welcomeError)
    } else {
      console.log('✅ Welcome email sent successfully!')
      console.log('📬 Message ID:', welcomeData.id)
    }

    console.log('\n📧 Check moizj00@gmail.com for both test emails')
    console.log('💡 Note: It may take a few seconds to arrive. Check spam folder if not in inbox.')

  } catch (error) {
    console.error('❌ Failed to send emails:', error.message)
    process.exit(1)
  }
}

testEmailTemplates()