# Talk-To-My-Lawyer - Current App State Snapshot

**Date**: December 28, 2025
**Deployment**: Production (Vercel)
**URL**: <https://www.talk-to-my-lawyer.com>
**Git Commit**: f9218ce5ff8cc58583b2dac120f38fac0275a1e3
**Branch**: main

---

## 🚀 Deployment Status

### Production Environment

- **Primary Domain**: <https://www.talk-to-my-lawyer.com>
- **Deployment URL**: <https://talk-to-my-lawyer-g8xzy6k5j-moizs-projects-34494b93.vercel.app>
- **Vercel Project**: moizs-projects-34494b93/talk-to-my-lawyer
- **Last Deployment**: December 28, 2025 (~9 minutes ago)

---

## 💳 Stripe Configuration (Updated & Working)

### Environment Variables in Production

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51Sj4Yn... (Encrypted)
STRIPE_SECRET_KEY=sk_test_51Sj4Yn... (Encrypted)
STRIPE_WEBHOOK_SECRET=whsec_0ce6ca3ea... (Encrypted)
STRIPE_PUBLISHABLE_KEY=pk_test_51Sj4Yn... (Encrypted)
STRIPE_MCP_KEY=ek_test_YWNjdF8xU2... (Encrypted)
STRIPE_API_VERSION=2025-11-17.clover
```

### Stripe Features Active

- ✅ Checkout flow working
- ✅ Payment processing via Stripe Checkout
- ✅ Webhook endpoint: `/api/stripe/webhook`
- ✅ Test mode enabled (using sk_test_ keys)
- ✅ Webhook events: checkout.session.completed, payment_intent.*, customer.subscription.*, invoice.*

---

## 👨‍⚖️ Admin Dashboard & Review Centre

### Access Route

- **URL**: `/secure-admin-gateway`
- **Login Page**: `/secure-admin-gateway/login`
- **Review Center**: `/secure-admin-gateway/review`

### Authentication (3-Factor)

1. Email (individual admin account)
2. Password (individual admin account)
3. Portal Key (shared secret: `ADMIN_PORTAL_KEY` env variable)

### Admin Capabilities

#### 1. **Analytics Dashboard** (`/secure-admin-gateway/dashboard/analytics`)

- Total users, subscribers, employees, admins
- Letter statistics (total, pending, approved, rejected)
- Revenue analytics and trend analysis
- Commission tracking

#### 2. **Review Center** (`/secure-admin-gateway/review`) - ⭐ MAIN FEATURE

- View all submitted letters
- Letter status tracking:
  - `draft` - Initial generation
  - `pending_review` - Awaiting admin review
  - `under_review` - Admin is reviewing
  - `approved` - Approved by attorney
  - `rejected` - Rejected by attorney
  - `completed` - Letter delivered to user
  - `failed` - Generation failed
- **Review Actions**:
  - Approve letter (with notes)
  - Reject letter (with reason)
  - Edit/improve letter content
  - Mark as under review
  - Generate PDF
  - Send email to user
- **Audit Trail**: All actions logged to `letter_audit_trail` table

#### 3. **Users Management** (`/secure-admin-gateway/dashboard/users`)

- Complete user directory
- User details (profile, subscription, letters, usage)
- Role distribution (Subscribers, Employees, Admins, Super Users)

#### 4. **Letters Management** (`/secure-admin-gateway/dashboard/letters`)

- All letters across all users
- Bulk actions (approve/reject multiple)
- Status filtering and search
- Letter details and history

#### 5. **Coupons Management** (`/secure-admin-gateway/dashboard/coupons`)

- Admin-created coupons
- Employee-generated coupons
- Usage analytics and tracking
- Employee mapping for commissions

#### 6. **Commissions** (`/secure-admin-gateway/dashboard/commissions`)

- Pending payout requests
- Commission processing (approve/reject)
- 5% commission rate on employee referrals
- Payment history

#### 7. **Email Queue** (`/secure-admin-gateway/dashboard/email-queue`)

- Pending, sent, failed emails
- Retry management
- Error debugging
- Provider analytics (Resend, Brevo, SendGrid, SMTP)

### Multi-Admin System

- **Multiple admins supported** (not just one)
- Each admin has individual Supabase Auth account
- Shared Portal Key for gateway access
- All admins share same review dashboard
- Role check: `role = 'admin'` in database

---

## 📝 Letter Generation Features

### Letter Types (6 Types)

1. **Demand Letter** - Formal demand for payment or action
   - Conditional fields: Amount Demanded ($), Deadline for Response

2. **Cease & Desist** - Stop harmful or illegal activity
   - Conditional fields: Deadline to Cease Activity

3. **Contract Breach Notice** - Notify of contract violation
   - Conditional fields: Date of Incident/Breach

4. **Eviction Notice** - Legal notice to vacate property
   - Conditional fields: Notice to Vacate By, Lease Start Date

5. **Employment Dispute** - Work-related conflicts
   - Conditional fields: Date of Incident/Breach

6. **Consumer Complaint** - Product/service issues
   - Conditional fields: Date of Purchase or Incident

### Form Fields

**Required:**

- Sender Name, Address
- Recipient Name, Address
- Issue Description (min 20 characters)
- Desired Outcome (min 10 characters)

**Optional (with validation):**

- Phone numbers (10-20 digits, specific format)
- Email addresses (valid format)
- Amount Demanded (number, $0-$10,000,000)
- Dates (YYYY-MM-DD or MM/DD/YYYY format)

**Supporting Documents:**

- Attachment icon (paperclip) displayed
- Textarea for describing documents
- Helper text about attachments

### Letter Generation Flow

```
User fills form → API validation → AI generation (GPT-4 Turbo) →
Status: generating → Status: pending_review → Admin review →
Status: approved/rejected → Email to user
```

### Stripe Client Utility

- **Location**: `lib/stripe/client.ts`
- **Features**:
  - Sanitizes API keys (removes whitespace, quotes, newlines)
  - Validates key format (sk_test_ or sk_live_)
  - Consistent initialization across all API routes
  - Prevents "Invalid character in header content" errors

---

## 💰 Subscription System

### Plans

1. **Single Letter** - $299 (1 letter, one-time)
2. **Monthly Plan** - $299 (4 letters/month, popular)
3. **Yearly Plan** - $599 (8 letters/year)

### Allowance Tracking

- PostgreSQL functions: `check_letter_allowance()`, `deduct_letter_allowance()`
- `total_letters_generated` field prevents free trial abuse
- Letter credits system with monthly reset
- Free trial: 1 letter if no previous generations

### Payment Processing

- Stripe Checkout (test mode)
- Session creation with metadata
- Webhook confirmation
- Subscription activation
- Commission tracking for employee referrals

---

## 👥 Employee Referral System

### Features

- Employee coupon generation (auto-created on signup)
- Unique coupon codes per employee
- 5% commission on referrals
- Payout request system
- Performance analytics
- Commission approval workflow

### Commission Tracking

- Status: `pending`, `paid`, `rejected`
- Calculation: `subscription_amount * 0.05`
- Admin approval required
- Payment history tracking

---

## 🔐 Security Features

### Authentication

- Supabase Auth (JWT tokens)
- Role-based access control (RBAC)
- Protected API routes
- Admin session management (30-minute timeout)

### Rate Limiting

- Upstash Redis/KV
- Letter generation: 5 per hour
- Subscription: 3 per hour
- Checkout: 3 per hour
- Admin login: 10 per 15 minutes

### Input Validation

- Comprehensive letter schema validation
- Forbidden pattern detection (XSS, SQL injection, prompt injection)
- Email/phone format validation
- Character limits and minimum length requirements

### Content Security Policy

- Strict CSP headers
- Vercel Live domain whitelisted
- Stripe domains allowed
- Supabase domains allowed

---

## 🗄️ Database (Supabase)

### Connection

- **URL**: <https://nomiiqzxaxyxnxndvkbe.supabase.co>
- **Hostname**: db.nomiiqzxaxyxnxndvkbe.supabase.co
- **Region**: Production

### Key Tables

- `profiles` - User profiles and roles
- `letters` - Letter drafts and metadata
- `subscriptions` - User subscriptions
- `employee_coupons` - Employee referral codes
- `commissions` - Employee commissions
- `coupon_usage` - Coupon redemption tracking
- `letter_audit_trail` - Letter action history
- `email_queue` - Email processing queue
- `admin_audit_log` - Admin action logging
- `fraud_detection_config` - Fraud detection rules
- `suspicious_patterns` - Flagged activities

### Row Level Security (RLS)

- All tables have RLS policies
- Admin-only tables: `fraud_detection_config`, `suspicious_patterns`
- User data isolation
- Role-based access enforcement

---

## 📧 Email System

### Providers

- **Primary**: Resend (re_DfZwJ1tH_JCjrmaV9eYtLs3sdLRjgcNf2)
- **Fallback**: Console (development)

### Email Types

- Letter delivery
- Subscription confirmations
- Payment receipts
- Commission notifications
- Admin alerts

### Queue Processing

- Cron job: `/api/cron/process-email-queue`
- Schedule: Every 10 minutes
- Retry logic with exponential backoff

---

## 🤖 AI Integration

### AI Provider

- **Gateway**: Vercel AI Gateway
- **Model**: OpenAI GPT-4 Turbo
- **API Key**: Configured in environment

### AI Features

- Letter generation with retry logic
- Prompt injection prevention
- Content sanitization
- Quality validation (300-500 words)

---

## 🎨 UI/UX Features

### Components (shadcn/ui)

- Form inputs with validation
- Modal dialogs
- Loading states
- Error handling
- Success notifications

### Design System

- **Colors**: Blue primary theme
- **Typography**: Professional legal tone
- **Responsiveness**: Mobile, tablet, desktop
- **Accessibility**: WCAG 2.1 AA compliance (ongoing)

---

## 🔧 Development Setup

### Local Environment

- **Package Manager**: pnpm 10.25.0
- **Framework**: Next.js 16.0.10 (Turbopack)
- **Runtime**: Node.js
- **Database**: Supabase (PostgreSQL)

### Stripe CLI (Local Testing)

- **Version**: 1.19.0
- **Status**: Running (background process)
- **Webhook URL**: <http://localhost:3000/api/stripe/webhook>
- **Webhook Secret**: Configured locally

### Environment Files

- `.env.local` - Local development (not in git)
- `.env.example` - Template with placeholders
- `.env.development` - Development overrides

---

## 📊 Recent Deployments (Last 10 Commits)

1. **f9218ce** - Add deadline and incident date fields to new letter form
2. **23ac11c** - Add input fields for amount demanded, deadlines, and incident dates based on letter type
3. **5a4f116** - Enhance logging and error handling in letter generation process
4. **7c3d746** - Update webhook secret instructions in testing guide for clarity
5. **4c9a761** - Add comprehensive guide for testing dummy payments with Stripe CLI
6. **01e367e** - Add Stripe setup guide and webhook setup script for local development
7. **0407e38** - Refactor Stripe client initialization and add key validation utilities
8. **62ef699** - Update Content Security Policy to include Vercel live domain
9. **83384b9** - Add environment variable specialist documentation
10. **c1abda1** - Add Supabase CLI local metadata to .gitignore

---

## 🎯 Key Features Working

### ✅ Subscriber Features

- User registration/login
- Letter generation (6 types)
- Conditional form fields per letter type
- Subscription purchase (Stripe)
- Letter credits system
- My Letters dashboard
- Letter status tracking
- PDF download
- Email delivery

### ✅ Admin Features

- Secure admin gateway (3-factor auth)
- Review center with approve/reject actions
- Analytics dashboard
- User management
- Letter management (all users)
- Coupon management
- Commission approval
- Email queue monitoring
- Audit trail access

### ✅ Employee Features

- Automatic coupon generation on signup
- Unique referral links
- Commission tracking
- Payout requests
- Performance analytics

### ✅ Payment Processing

- Stripe Checkout integration
- Webhook handling
- Subscription activation
- Commission calculation
- Payment history

---

## 🐛 Known Issues & Limitations

### Validation

- Phone number format strict (10-20 digits only)
- Date format must be exact (YYYY-MM-DD or MM/DD/YYYY)
- Minimum character limits on descriptions

### Test Mode

- Stripe is in TEST MODE (using sk_test_ keys)
- Need to switch to live keys for production payments
- Test cards only (4242 4242 4242 4242)

### Admin Access

- Portal Key required for all admin logins
- Session expires after 30 minutes
- No "remember me" functionality

---

## 📝 Important Notes

### Security

- ⚠️ **Never commit real API keys to git**
- ⚠️ **All secrets in Vercel environment variables**
- ⚠️ **Admin Portal Key should be rotated regularly**

### Database

- ⚠️ **Run migrations in sequence**
- ⚠️ **Backup before schema changes**
- ⚠️ **RLS policies enforced on all tables**

### Stripe

- ⚠️ **Currently in TEST MODE**
- ⚠️ **Webhook secret must match Stripe Dashboard**
- ⚠️ **API version: 2025-11-17.clover**

---

## 🚀 Next Steps (When Ready)

### Production Checklist

- [ ] Switch Stripe to LIVE mode (sk_live_ keys)
- [ ] Update webhook endpoint to production URL
- [ ] Configure live webhook secret
- [ ] Test real payment flow
- [ ] Enable domain for Stripe Checkout
- [ ] Configure production email templates
- [ ] Set up production monitoring
- [ ] Configure error tracking (Sentry, etc.)
- [ ] Set up backup strategy
- [ ] Document runbook for common issues

---

**Snapshot Created**: December 28, 2025
**Status**: ✅ All systems operational
**Stripe**: ✅ Working (Test Mode)
**Admin Dashboard**: ✅ Accessible
**Letter Generation**: ✅ Functional
**Payment Processing**: ✅ Active (Test Mode)
