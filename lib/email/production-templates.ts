// Production Email Templates Configuration
// File: lib/email/production-templates.ts

export const PRODUCTION_EMAIL_TEMPLATES = {
  // Welcome email for new subscribers
  WELCOME_SUBSCRIBER: {
    subject: "Welcome to Talk-To-My-Lawyer - Your Legal Letter Service",
    template: `
      <h1>Welcome to Talk-To-My-Lawyer!</h1>
      <p>Thank you for choosing our professional legal letter service.</p>
      
      <h2>What's Next?</h2>
      <ul>
        <li>Generate your first legal letter from your dashboard</li>
        <li>Our attorney will review and approve it</li>
        <li>Download your professional letter as PDF</li>
      </ul>
      
      <p><a href="https://www.talk-to-my-lawyer.com/dashboard" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Access Your Dashboard</a></p>
      
      <p>Need help? Reply to this email or visit our support center.</p>
      
      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `
  },

  // Letter generation complete notification
  LETTER_GENERATED: {
    subject: "Your Legal Letter Has Been Generated",
    template: `
      <h1>Letter Generated Successfully</h1>
      <p>Your legal letter "{{letterTitle}}" has been generated and is now under attorney review.</p>
      
      <h2>Next Steps:</h2>
      <p>Our qualified attorney will review your letter within 24-48 hours and either:</p>
      <ul>
        <li>Approve it for final delivery</li>
        <li>Request revisions for accuracy</li>
      </ul>
      
      <p>You'll receive another email once the review is complete.</p>
      
      <p><a href="https://www.talk-to-my-lawyer.com/dashboard/letters" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Letter Status</a></p>
      
      <p>Thank you for using Talk-To-My-Lawyer.</p>
    `
  },

  // Letter approved by attorney
  LETTER_APPROVED: {
    subject: "Your Legal Letter Has Been Approved ✅",
    template: `
      <h1>Letter Approved!</h1>
      <p>Great news! Your legal letter "{{letterTitle}}" has been reviewed and approved by our attorney.</p>
      
      <h2>Your Letter is Ready:</h2>
      <ul>
        <li>Download as professional PDF</li>
        <li>Print on letterhead</li>
        <li>Send to recipient</li>
      </ul>
      
      <div style="background: #f0f9ff; border: 1px solid #0066cc; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p><strong>Attorney Review Notes:</strong></p>
        <p>{{reviewNotes}}</p>
      </div>
      
      <p><a href="https://www.talk-to-my-lawyer.com/dashboard/letters/{{letterId}}" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Download Your Letter</a></p>
      
      <p>Need another letter? You have {{remainingLetters}} letter credits remaining.</p>
      
      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `
  },

  // Letter requires revisions
  LETTER_REVISION_REQUIRED: {
    subject: "Your Legal Letter Requires Revisions",
    template: `
      <h1>Letter Revision Required</h1>
      <p>Our attorney has reviewed your legal letter "{{letterTitle}}" and identified some areas that need revision for maximum effectiveness.</p>
      
      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p><strong>Revision Notes:</strong></p>
        <p>{{revisionNotes}}</p>
      </div>
      
      <h2>Next Steps:</h2>
      <p>You can either:</p>
      <ul>
        <li>Edit your original submission with the suggested changes</li>
        <li>Generate a new letter with updated information</li>
      </ul>
      
      <p><a href="https://www.talk-to-my-lawyer.com/dashboard/letters/{{letterId}}" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Letter & Revise</a></p>
      
      <p>Our goal is to provide you with the most effective legal letter possible.</p>
      
      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `
  },

  // Payment confirmation
  PAYMENT_CONFIRMED: {
    subject: "Payment Confirmed - Thank You!",
    template: `
      <h1>Payment Confirmed</h1>
      <p>Thank you for your payment! Your subscription has been activated.</p>
      
      <h2>Subscription Details:</h2>
      <ul>
        <li><strong>Plan:</strong> {{planName}}</li>
        <li><strong>Amount:</strong> ${{amount}}</li>
        <li><strong>Letter Credits:</strong> {{letterCredits}}</li>
        <li><strong>Valid Until:</strong> {{expiryDate}}</li>
      </ul>
      
      <p><a href="https://www.talk-to-my-lawyer.com/dashboard" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Start Creating Letters</a></p>
      
      <p>Questions about billing? <a href="https://www.talk-to-my-lawyer.com/dashboard/billing">View your billing history</a></p>
      
      <p>Thank you for choosing Talk-To-My-Lawyer!</p>
    `
  },

  // Commission notification for employees
  COMMISSION_EARNED: {
    subject: "Commission Earned - New Referral Sale!",
    template: `
      <h1>Congratulations! Commission Earned</h1>
      <p>You've earned a commission from a successful referral!</p>
      
      <h2>Commission Details:</h2>
      <ul>
        <li><strong>Sale Amount:</strong> ${{saleAmount}}</li>
        <li><strong>Commission Rate:</strong> 5%</li>
        <li><strong>Commission Earned:</strong> ${{commissionAmount}}</li>
        <li><strong>Coupon Used:</strong> {{couponCode}}</li>
      </ul>
      
      <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p><strong>Total Pending Commissions:</strong> ${{totalPending}}</p>
        <p>Request payout when you reach $50 minimum.</p>
      </div>
      
      <p><a href="https://www.talk-to-my-lawyer.com/dashboard/employee" style="background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Employee Dashboard</a></p>
      
      <p>Keep sharing your referral link to earn more commissions!</p>
      
      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `
  },

  // Admin notification for new letter submission
  ADMIN_NEW_LETTER_REVIEW: {
    subject: "🔍 New Letter Awaiting Review - {{letterTitle}}",
    template: `
      <h1>New Letter Review Required</h1>
      <p>A new legal letter has been submitted and requires attorney review.</p>
      
      <h2>Letter Details:</h2>
      <ul>
        <li><strong>Title:</strong> {{letterTitle}}</li>
        <li><strong>Type:</strong> {{letterType}}</li>
        <li><strong>Subscriber:</strong> {{subscriberName}} ({{subscriberEmail}})</li>
        <li><strong>Submitted:</strong> {{submissionDate}}</li>
      </ul>
      
      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p><strong>Review Priority:</strong> Standard (24-48 hour SLA)</p>
      </div>
      
      <p><a href="https://www.talk-to-my-lawyer.com/secure-admin-gateway/review" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Review Letter Now</a></p>
      
      <p>Total letters pending review: {{pendingCount}}</p>
      
      <p>Admin Portal Access Required</p>
    `
  },

  // System notification templates
  SYSTEM_ERROR_ALERT: {
    subject: "🚨 System Alert - {{errorType}}",
    template: `
      <h1>System Alert</h1>
      <p>An error has occurred that requires attention:</p>
      
      <div style="background: #fef2f2; border: 1px solid #dc2626; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p><strong>Error:</strong> {{errorMessage}}</p>
        <p><strong>Time:</strong> {{timestamp}}</p>
        <p><strong>Affected Service:</strong> {{service}}</p>
      </div>
      
      <p><a href="https://www.talk-to-my-lawyer.com/secure-admin-gateway/dashboard" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Admin Dashboard</a></p>
      
      <p>Check system logs for more details.</p>
    `
  }
};

// Email configuration for production
export const PRODUCTION_EMAIL_CONFIG = {
  from: {
    email: "support@talk-to-my-lawyer.com",
    name: "Talk-To-My-Lawyer"
  },
  
  // Admin notification settings
  adminNotifications: {
    enabled: true,
    recipients: ["admin@talk-to-my-lawyer.com"]
  },
  
  // Email provider settings
  provider: "resend", // Primary provider
  fallbackProviders: ["brevo", "sendgrid"],
  
  // Queue settings
  queue: {
    maxRetries: 3,
    retryDelay: 300, // 5 minutes
    batchSize: 10
  }
};

export default PRODUCTION_EMAIL_TEMPLATES;