#!/usr/bin/env node

// Test script to send actual email via Resend
import { Resend } from 'resend'

async function sendTestEmail() {
  console.log('🚀 Testing Resend Email Service...\n')

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    console.log('📧 Sending test email to moizj00@gmail.com...')

    const { data, error } = await resend.emails.send({
      from: 'Talk-To-My-Lawyer <noreply@talk-to-my-lawyer.com>',
      to: ['moizj00@gmail.com'],
      subject: '✅ Email System Test - Talk-To-My-Lawyer',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a2e; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
            .success { background: #dcfce7; padding: 15px; border-left: 4px solid #16a34a; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Talk-To-My-Lawyer</h1>
            </div>
            <div class="content">
              <h2>✅ Email System Test Successful!</h2>

              <div class="success">
                <strong>Your email system is working perfectly!</strong>
              </div>

              <p>This test email confirms that:</p>
              <ul>
                <li>Resend API is properly configured</li>
                <li>Email templates are rendering correctly</li>
                <li>HTML and styling are working</li>
                <li>Delivery to Gmail is successful</li>
              </ul>

              <p><strong>Deployed to:</strong> https://talk-to-my-lawyer.com</p>
              <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>

              <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
            </div>
            <div class="footer">
              <p>Talk-To-My-Lawyer | Professional Legal Letter Services</p>
              <p>This is a test message from your production deployment.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Email System Test Successful!

Your email system is working perfectly!

This test email confirms that:
- Resend API is properly configured
- Email templates are rendering correctly
- Delivery to Gmail is successful

Deployed to: https://talk-to-my-lawyer.com
Sent at: ${new Date().toLocaleString()}

Best regards,
The Talk-To-My-Lawyer Team
      `.trim()
    })

    if (error) {
      console.error('❌ Error sending email:', error)
      process.exit(1)
    }

    console.log('\n✅ Email sent successfully!')
    console.log('📬 Message ID:', data.id)
    console.log('📧 Check moizj00@gmail.com for the test email')
    console.log('\n💡 Note: It may take a few seconds to arrive. Check spam folder if not in inbox.')

  } catch (error) {
    console.error('❌ Failed to send email:', error.message)
    process.exit(1)
  }
}

sendTestEmail()
