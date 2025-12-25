# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Talk-To-My-Lawyer** is an AI-powered legal letter generation platform that provides professional legal document drafting services with mandatory attorney review. The platform follows a SaaS model with subscription-based pricing and includes employee referral functionality.

**Multi-Admin System**: The platform supports multiple admin users who share the same admin dashboard for reviewing and approving letters.

## Tech Stack

- **Frontend**: Next.js 16 with React 19 and TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **Payments**: Stripe integration
- **AI**: OpenAI GPT-4 Turbo via Vercel AI Gateway
- **Email**: Resend (primary), with Brevo, SendGrid, and SMTP providers available
- **Rate Limiting**: Upstash Redis
- **Package Manager**: pnpm

## Common Development Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Database migrations
pnpm db:migrate

# Validate environment variables
pnpm validate-env

# Health check
pnpm health-check
```

## Architecture Overview

### Project Structure

- **`/app/`** - Main application directory (Next.js App Router)
  - `api/` - API routes organized by feature
  - `auth/` - Authentication pages (login, signup, password reset)
  - `dashboard/` - User dashboard and management interfaces
  - `secure-admin-gateway/` - Admin portal with restricted access
- **`/components/`** - Reusable React components (using shadcn/ui)
- **`/lib/`** - Utility libraries and server-side configurations
  - `ai/` - AI service integrations
  - `auth/` - Authentication utilities
  - `email/` - Email service providers
  - `security/` - Security and validation utilities
- **`/scripts/`** - Database migration scripts (SQL)
- **`/supabase/`** - Supabase-specific migrations
- **`/styles/`** - Global styles and Tailwind configuration

### Key Features

1. **User Authentication & Roles**
   - Subscriber (regular users)
   - Admin (letter reviewers) - **Multiple admins supported**
   - Employee (referral system)
   - Role-based routing and permissions
   - Admin access controlled by `role = 'admin'` in database

2. **Letter Generation Workflow**
   - User selects letter type (Demand, Cease & Desist, etc.)
   - AI generates draft using OpenAI
   - Attorney review process
   - PDF generation and delivery
   - Email notifications

3. **Subscription System**
   - Tiered pricing (Single letter, Monthly, Yearly)
   - Letter allowance tracking
   - Stripe payment integration
   - Automatic subscription management

4. **Employee Referral System**
   - Commission tracking
   - Payout requests
   - Coupon generation
   - Performance analytics

### API Routes Organization

- `/api/letters/` - CRUD operations for letters
- `/api/auth/` - Authentication endpoints
- `/api/subscriptions/` - Subscription management
- `/api/admin/` - Admin-only endpoints
- `/api/employee/` - Employee functionality
- `/api/cron/` - Scheduled tasks (email processing)

## Manual Testing Guidelines

Since this project uses manual testing, follow these guidelines:

### Testing Workflows

1. **Authentication Flow**
   - Test user registration and login
   - Verify password reset functionality
   - Test role-based access control
   - Validate session management

2. **Admin Access**
   - Test admin login with multiple admin accounts
   - Verify each admin can access `/secure-admin-gateway`
   - Test admin actions (approve, reject, review letters)

3. **Letter Generation**
   - Test each letter type with various inputs
   - Verify AI generation via Vercel AI Gateway
   - Test attorney review process
   - Verify PDF generation and download

3. **Payment Processing**
   - Test subscription creation with Stripe test cards
   - Verify subscription upgrades/downgrades
   - Test payment failure scenarios
   - Verify webhooks handling

4. **Email Services**
   - Test email delivery with configured provider (Resend, Brevo, SendGrid, or SMTP)
   - Verify email templates and formatting
   - Test fallback to console provider in development

### Test Data Management

- Use test email addresses: `test+{type}@example.com`
- Stripe test cards available at: https://stripe.com/docs/testing
- Use Supabase local development for isolated testing

### Key Test Scenarios

1. **Edge Cases**
   - Network failures during AI generation
   - Payment processing interruptions
   - Email service outages
   - Database constraint violations

2. **Security Testing**
   - Input validation and sanitization
   - Rate limiting effectiveness
   - Authentication bypass attempts
   - SQL injection prevention

## Important Notes

- All database migrations must be run in sequence
- Environment variables must be validated before starting the app
- Stripe webhooks require proper endpoint configuration
- AI services have rate limits - implement proper retry logic
- Vercel AI Gateway provides automatic retries and fallback handling

## Security Considerations

- All API routes require authentication
- Rate limiting is implemented using Upstash Redis
- CSRF protection is enabled
- Content Security Policy headers are configured
- Input validation uses Zod schemas
- Database uses Row Level Security (RLS)

## Admin User Management

### Multi-Admin System Architecture

The platform implements a **multi-admin system** where multiple licensed attorneys can share admin duties. Admins do not use public user or employee entry points - they access via a dedicated, secure Admin Gateway.

### Admin Authentication Flow

#### 1. Admin Access Point
- **Route**: `/secure-admin-gateway` (not discoverable via public UI)
- **Protection**: Multi-layered security (middleware + RLS + Portal Key)
- **Isolation**: Completely separate from user/employee flows

#### 2. Admin Signup (Creating New Admins)

**Method 1: CLI Script** (Recommended)
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password>
```

**Example:**
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts admin@company.com SecurePass123!
```

**Method 2: Manual Database Promotion**
```sql
-- Promote existing user to admin
UPDATE profiles SET role = 'admin' WHERE email = 'user@example.com';
```

#### 3. Admin Login Process

**Required Credentials (3-Factor):**
1. **Email** - Individual Supabase Auth account
2. **Password** - Individual Supabase Auth account
3. **Portal Key** - Shared secret (`ADMIN_PORTAL_KEY` environment variable)

**Login Flow:**
1. Navigate to `/secure-admin-gateway/login`
2. Enter email, password, AND Portal Key
3. System validates:
   - Supabase Auth credentials (email + password)
   - Portal Key against `process.env.ADMIN_PORTAL_KEY`
   - User has `role = 'admin'` in database
4. Creates admin session (30-minute timeout with activity tracking)
5. Redirects to Admin Dashboard at `/secure-admin-gateway/review`

#### 4. Security Guarantees

**Middleware Protection** (`lib/supabase/middleware.ts`):
- Intercepts all `/secure-admin-gateway/*` requests
- Allows only `/secure-admin-gateway/login` without session
- Validates admin session via `verifyAdminSessionFromRequest()`
- Redirects unauthorized access to login page

**API Route Protection**:
- All `/api/admin/*` endpoints use `requireAdminAuth()`
- Rate limiting via Upstash Redis (10 attempts per 15 minutes)
- Audit logging of all admin actions

**Database Protection**:
- Row Level Security (RLS) policies require `role = 'admin'`
- Admin-only tables: `fraud_detection_config`, `suspicious_patterns`
- Double verification: session cookie + database role check

**Session Management**:
- HttpOnly cookies (XSS protection)
- 30-minute timeout with activity renewal
- Secure flag in production
- SameSite: lax (CSRF protection)

### Admin Dashboard Capabilities

Once authenticated, admins have access to:

#### 1. Analytics Dashboard (`/secure-admin-gateway/dashboard/analytics`)
- **User Metrics**: Total users, subscribers, employees, admins
- **Letter Statistics**: Total letters, pending/approved/rejected counts, avg review time
- **Revenue Analytics**: Total revenue, active subscriptions, pending commissions
- **Trend Analysis**: Monthly revenue, subscription growth, commission payouts

#### 2. Review Center (`/secure-admin-gateway/review`)
- **Letter Queue**: All submitted letters across all users
- **Status Tracking**: Draft, Pending Review, Under Review, Approved, Rejected, Completed, Failed
- **Review Actions**: Approve, reject, add review notes
- **Audit Trail**: Full history via `letter_audit_trail` table

#### 3. Users Management (`/secure-admin-gateway/dashboard/users`)
- **View All Users**: Complete user directory
- **User Details**: Profile, subscription status, letters generated, usage limits
- **Drill-Down**: Individual user activity and letter history
- **Role Distribution**: Subscribers, employees, admins, super users

#### 4. Employees Management (`/secure-admin-gateway/dashboard/coupons`)
- **Employee Directory**: All registered employees
- **Coupon Tracking**: Issued codes, usage count, discount rates
- **Revenue Attribution**: Employee-driven sales and referrals
- **Commission Summary**: Pending and paid commissions (5% rate)

#### 5. Coupons & Discounts (`/secure-admin-gateway/dashboard/coupons`)
- **All Coupons**: Both admin-created and employee-generated
- **Usage Analytics**: Track redemptions, user attribution
- **Employee Mapping**: Link coupons to employees for commission calculation
- **Promotional Codes**: Special codes like `TALK3` for campaigns

#### 6. Commissions Management (`/secure-admin-gateway/dashboard/commissions`)
- **Pending Payouts**: Review employee commission requests
- **Payout Processing**: Approve or reject via `process_payout()` function
- **Commission Tracking**: 5% of subscription revenue per employee referral
- **Payment History**: Completed payouts and rejection reasons

#### 7. Email Queue (`/secure-admin-gateway/dashboard/email-queue`)
- **Delivery Status**: Pending, sent, failed emails
- **Retry Management**: Track attempts and next retry times
- **Provider Analytics**: Resend, Brevo, SendGrid, SMTP performance
- **Error Debugging**: View failure reasons and error messages

### Database Functions for Admin Analytics

The following PostgreSQL functions support admin dashboard queries:

```sql
-- Dashboard overview statistics
SELECT * FROM get_admin_dashboard_stats();

-- Letter statistics for date range
SELECT * FROM get_letter_statistics(days_back => 30);

-- Subscription analytics
SELECT * FROM get_subscription_analytics();

-- Revenue summary by month
SELECT * FROM get_revenue_summary(months_back => 12);

-- Employee commission summary
SELECT * FROM get_commission_summary(emp_id => '<uuid>');

-- Fraud detection statistics
SELECT * FROM get_fraud_statistics(time_range_hours => 24);
```

### Admin Database Schema

```sql
-- View all admin users
SELECT id, email, full_name, role, created_at
FROM profiles
WHERE role = 'admin';

-- Check admin count (multi-admin support)
SELECT get_admin_count();

-- Verify admin exists
SELECT admin_exists();

-- Admin audit trail
SELECT * FROM admin_audit_log
WHERE admin_id = '<admin-uuid>'
ORDER BY created_at DESC;
```

### Security Best Practices for Admins

1. **Environment Variables**:
   - Keep `ADMIN_PORTAL_KEY` secret and rotate regularly
   - Never commit to version control
   - Use different keys per environment (dev/staging/prod)

2. **Access Monitoring**:
   - All admin logins logged to `admin_audit_log`
   - Failed login attempts trigger rate limiting
   - Session activity tracked with timestamps

3. **Privilege Escalation Prevention**:
   - Portal Key prevents unauthorized admin creation
   - Database role verified on every request
   - Middleware blocks URL guessing
   - RLS policies enforce admin-only access

4. **Session Security**:
   - 30-minute timeout (configurable via `ADMIN_SESSION_TIMEOUT`)
   - Activity-based renewal (session extends with use)
   - Logout destroys session immediately

### Troubleshooting Admin Access

**Issue**: Admin login fails with "Invalid admin portal key"
- **Fix**: Check `ADMIN_PORTAL_KEY` in `.env.local` matches login input

**Issue**: Admin redirected to login after successful login
- **Fix**: Check session cookies are enabled, verify `role = 'admin'` in database

**Issue**: Admin can't access certain routes
- **Fix**: Verify middleware.ts is running, check RLS policies on tables

**Issue**: Admin session expires too quickly
- **Fix**: Increase `ADMIN_SESSION_TIMEOUT` constant in `lib/auth/admin-session.ts`