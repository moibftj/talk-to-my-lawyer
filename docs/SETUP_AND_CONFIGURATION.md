# Setup & Configuration Guide

Complete guide for setting up and configuring Talk-To-My-Lawyer for development and production environments.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Environment Variables](#environment-variables)
3. [Database Setup](#database-setup)
4. [Admin User Setup](#admin-user-setup)
5. [Test Mode](#test-mode)
6. [Security Configuration](#security-configuration)

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account
- Stripe account
- OpenAI API key

### Quick Start

```bash
# Clone the repository
git clone https://github.com/moizjmj-pk/talk-to-my-lawyer.git
cd talk-to-my-lawyer

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Fill in your environment variables (see below)

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Visit http://localhost:3000

---

## Environment Variables

### Critical Variables (Always Required)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:password@host:port/database

# OpenAI via Vercel AI Gateway
OPENAI_API_KEY=sk-...

# Stripe
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... or pk_live_...

# Admin Portal (for multi-admin access)
ADMIN_PORTAL_KEY=your-secure-random-key

# Email Service (choose provider)
EMAIL_PROVIDER=resend  # Options: resend, brevo, sendgrid, smtp, console
EMAIL_FROM=noreply@talk-to-my-lawyer.com
EMAIL_FROM_NAME=Talk-To-My-Lawyer

# Resend (recommended)
RESEND_API_KEY=re_...

# Or Brevo
BREVO_API_KEY=xkeysib-...

# Or SendGrid
SENDGRID_API_KEY=SG....

# Or SMTP
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Rate Limiting (Upstash Redis)
KV_REST_API_URL=https://your-redis.upstash.io
KV_REST_API_TOKEN=your-token

# Application
NEXT_PUBLIC_SITE_URL=https://www.talk-to-my-lawyer.com
```

### Optional Variables

```bash
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000

# Test Mode (MUST be false in production)
ENABLE_TEST_MODE=false
NEXT_PUBLIC_TEST_MODE=false

# Monitoring
SUPABASE_HOSTNAME=your-project.supabase.co

# Cron Jobs
CRON_SECRET=your-cron-secret
```

### Generating Secure Keys

```bash
# Generate a random 64-character key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use OpenSSL
openssl rand -hex 32
```

### Environment Validation

Before starting the app, validate your environment:

```bash
pnpm validate-env
```

This will check:
- All critical variables are set
- Production-specific variables when `NODE_ENV=production`
- Test mode configuration
- Email provider configuration
- Database connectivity

---

## Database Setup

### Running Migrations

The database setup requires running SQL migrations in sequence.

#### Option 1: Using the Migration Script

```bash
pnpm db:migrate
```

This runs all migrations in order from both:
- `/scripts/*.sql` (001-023)
- `/supabase/migrations/*.sql`

#### Option 2: Manual Migration

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run scripts in order:

**Core Schema**:
```
scripts/001_setup_schema.sql
scripts/002_setup_rls.sql
scripts/003_seed_data.sql
scripts/004_create_functions.sql
```

**Key Features**:
```
scripts/005_letter_allowance_system.sql
scripts/006_audit_trail.sql
scripts/008_employee_coupon_auto_generation.sql
scripts/011_security_hardening.sql
```

**Latest Enhancements**:
```
scripts/020_decrement_credits_atomic.sql
scripts/021_add_total_letters_generated.sql
scripts/022_fix_deduct_letter_allowance.sql
scripts/023_add_fraud_detection_tables.sql
```

### Verifying Database Setup

```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT version();"

# Verify tables exist
psql $DATABASE_URL -c "\dt public.*"

# Check RLS policies
psql $DATABASE_URL -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"

# Test key functions
psql $DATABASE_URL -c "SELECT * FROM check_letter_allowance('user-id-here');"
```

### Key Database Functions

The platform relies on these PostgreSQL functions:

**Letter Allowance**:
- `check_letter_allowance(u_id)` - Check remaining credits
- `deduct_letter_allowance(u_id)` - Atomic credit deduction
- `add_letter_allowances(u_id, amount)` - Add credits to subscription

**Audit Trail**:
- `log_letter_audit(letter_id, action, ...)` - Log letter state changes
- `increment_total_letters(user_id)` - Track total letters generated

**Employee System**:
- `get_employee_coupon(employee_id)` - Get coupon for employee
- `get_commission_summary(emp_id)` - Get commission totals

**Admin Analytics**:
- `get_admin_dashboard_stats()` - Comprehensive dashboard stats
- `is_system_admin()` - Check if user is system admin
- `is_attorney_admin()` - Check if user is attorney admin

---

## Admin User Setup

The platform supports **multiple admin users** who share the same admin dashboard.

### Admin User Types

| Role | Sub-Role | Access Level |
|------|----------|--------------|
| Admin | `system_admin` | Full access: Analytics, all users, all letters, coupon tracking, commission management |
| Admin | `attorney_admin` | Limited access: Letter review center, profile settings only |

### Creating Admin Users

#### Method 1: Using the Script (Recommended)

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password>
```

**Example:**
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts admin@company.com SecurePass123!
```

**What the script does:**
1. Creates a Supabase Auth user (or updates if exists)
2. Sets `role = 'admin'` in the profiles table
3. Auto-confirms email (no verification required)
4. Sets `admin_sub_role = 'system_admin'` by default

#### Method 2: Manual Database Update

```sql
-- Step 1: Create user in Supabase Auth (via dashboard or API)

-- Step 2: Update role to admin
UPDATE profiles
SET role = 'admin',
    admin_sub_role = 'system_admin',  -- or 'attorney_admin'
    updated_at = NOW()
WHERE email = 'admin@example.com';
```

### Admin Authentication

Admin login requires **3 factors**:

1. **Email** - Individual Supabase Auth account
2. **Password** - Individual Supabase Auth account
3. **Portal Key** - Shared secret (`ADMIN_PORTAL_KEY` environment variable)

**Login Flow:**
1. Navigate to `/secure-admin-gateway/login`
2. Enter email, password, AND Portal Key
3. System validates all three factors
4. Creates admin session (30-minute timeout)
5. Redirects to Admin Dashboard

### Troubleshooting Admin Access

**Issue**: Admin login fails with "Invalid admin portal key"
- **Fix**: Check `ADMIN_PORTAL_KEY` in `.env.local` matches login input

**Issue**: Admin redirected to login after successful login
- **Fix**: Check session cookies are enabled, verify `role = 'admin'` in database

**Issue**: Admin can't access certain routes
- **Fix**: Verify middleware.ts is running, check RLS policies on tables

**Issue**: Admin session expires too quickly
- **Fix**: Increase `ADMIN_SESSION_TIMEOUT` constant in `lib/auth/admin-session.ts`

---

## Test Mode

Test mode allows you to test the complete workflow without processing real Stripe payments.

### Enabling Test Mode

#### Local Development

Add to `.env.local`:

```bash
ENABLE_TEST_MODE="true"
NEXT_PUBLIC_TEST_MODE="true"
```

#### Vercel Production

```bash
# Set environment variables
vercel env add ENABLE_TEST_MODE production
# Enter: true

vercel env add NEXT_PUBLIC_TEST_MODE production
# Enter: true

# Redeploy
vercel --prod
```

### What Test Mode Does

When `ENABLE_TEST_MODE=true`:

**For Subscribers:**
1. **Letter Generation** - Works normally with OpenAI
2. **Checkout Process** - Bypasses Stripe completely
   - No redirect to Stripe checkout
   - Subscription created directly in database
   - Status set to `active` immediately
   - Credits allocated instantly
   - Redirects to: `/dashboard/subscription?success=true&test=true`
3. **Letter Review** - Works exactly like production

**For Admins:**
- All workflows identical to production
- Test mode banner visible on admin pages

### Test Mode Indicators

Visual indicators show when test mode is active:

1. **Subscription Page** (`/dashboard/subscription`)
   - Amber warning banner at the top
   - Shows: "Test Mode Active - Stripe payments are simulated"

2. **Admin Review Center** (`/secure-admin-gateway/review`)
   - Amber warning banner at the top
   - Shows: "Test Mode Active - You're reviewing letters created with simulated payments"

### Complete Test Flow

**Prerequisites:**
1. Restart development server: `pnpm dev`
2. Open two browser windows:
   - **Window A**: Regular browser (subscriber view)
   - **Window B**: Incognito/Private mode (admin view)

**Subscriber (Window A):**
1. Navigate to http://localhost:3000
2. Sign up/login as subscriber
3. Go to "Generate Letter"
4. Fill out letter intake form
5. Click "Generate Letter"
6. Timeline modal appears showing generation progress
7. Go to subscription page if no active subscription
8. Click "Subscribe" - **NO redirect to Stripe**
9. Subscription created instantly
10. Navigate to letter detail page
11. See "Pending Review" status

**Admin (Window B):**
1. Navigate to `/secure-admin-gateway/login`
2. Enter admin credentials + portal key
3. See pending letters in Review Center
4. Click on letter to view
5. Click "Review Letter"
6. Edit content if needed
7. Click "Approve Letter"
8. **Window A instantly updates** to "Approved"

### Disabling Test Mode

**Local:**
```bash
# Edit .env.local
ENABLE_TEST_MODE="false"
NEXT_PUBLIC_TEST_MODE="false"
```

**Vercel:**
```bash
vercel env rm ENABLE_TEST_MODE production --yes
vercel env rm NEXT_PUBLIC_TEST_MODE production --yes

# Redeploy
vercel --prod
```

⚠️ **CRITICAL**: Test mode MUST be disabled in production for real payments!

---

## Security Configuration

### Security Headers

The application includes comprehensive security headers configured in `next.config.mjs`:

- Content Security Policy (CSP)
- Strict Transport Security (HSTS)
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options (MIME sniffing protection)

Verify headers are applied:

```bash
curl -I https://yourdomain.com
```

### Rate Limiting

Rate limits are configured using Upstash Redis with fallback to in-memory:

| Endpoint | Limit |
|----------|-------|
| Auth routes | 5 requests / 15 minutes |
| Admin routes | 10 requests / 15 minutes |
| API routes | 100 requests / 1 minute |
| Letter generation | 5 requests / 1 hour |
| Subscriptions | 3 requests / 1 hour |

Configuration in `lib/rate-limit-redis.ts`

### Input Validation

All user input is validated using:
- Zod schemas (`lib/validation/letter-schema.ts`)
- Input sanitization (`lib/security/input-sanitizer.ts`)
- Forbidden pattern checks

### CSRF Protection

Admin actions require CSRF tokens:
- Generated via `lib/security/csrf.ts`
- Validated on all admin POST/PUT/DELETE requests
- 30-minute token expiration

### Row Level Security (RLS)

Database access is protected by RLS policies:
- Users can only access their own records
- Admins have wider access based on role
- All queries respect RLS automatically

Verify RLS is enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### API Key Rotation

Rotate sensitive keys quarterly:

```bash
# Environment variables to rotate
ADMIN_PORTAL_KEY
OPENAI_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

**Rotation Process:**
1. Generate new key from provider
2. Update Vercel environment variable
3. Redeploy application
4. Test all functionality
5. Revoke old key after verification

### Security Monitoring

Monitor for security incidents:

**Access Monitoring:**
- Admin logins logged to `admin_audit_log`
- Failed login attempts trigger rate limiting
- Session activity tracked with timestamps

**Vulnerability Scanning:**
- Dependencies: `pnpm audit --audit-level=high`
- Weekly automated scans via Dependabot
- Security advisories monitored via GitHub

**Audit Trails:**
```sql
-- View admin activity
SELECT * FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 50;

-- View letter audit trail
SELECT * FROM letter_audit_trail
ORDER BY created_at DESC
LIMIT 50;
```

---

## Development Best Practices

### Local Development

```bash
# Start dev server
pnpm dev

# Run linting
pnpm lint

# Fix linting issues
pnpm lint --fix

# Build for production
CI=1 pnpm build

# Validate environment
pnpm validate-env

# Run health check
pnpm health-check
```

### Testing

```bash
# Test email delivery
node test-email-send.js

# Check email provider
node check-email-provider.js

# Test Stripe webhooks
stripe trigger checkout.session.completed
```

### Database Development

```bash
# Connect to database
psql $DATABASE_URL

# Run a specific migration
psql $DATABASE_URL -f scripts/001_setup_schema.sql

# Check migrations status
psql $DATABASE_URL -c "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;"
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
git add .
git commit -m "Description of changes"

# Push to GitHub
git push origin feature/my-feature

# Create pull request on GitHub
```

---

## Support & Resources

### Documentation
- **API Documentation**: `docs/API_AND_INTEGRATIONS.md`
- **Deployment Guide**: `docs/DEPLOYMENT_GUIDE.md`
- **Architecture Guide**: `docs/ARCHITECTURE_AND_DEVELOPMENT.md`

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Vercel Documentation](https://vercel.com/docs)

### Troubleshooting

For common issues:
1. Check environment variables are set correctly
2. Verify database migrations are applied
3. Check service provider dashboards (Stripe, Supabase, etc.)
4. Review application logs
5. Test with health check endpoints

For production issues, see `docs/DEPLOYMENT_GUIDE.md` → Production Runbook section.
