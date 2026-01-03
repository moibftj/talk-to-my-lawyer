# Talk-To-My-Lawyer Setup Guide

Complete setup guide for local development and production deployment of the Talk-To-My-Lawyer platform.

## Prerequisites

- **Node.js** 18+ 
- **pnpm** package manager
- **Supabase** account
- **Stripe** account
- **OpenAI** API key
- **Email Provider** (Resend recommended)
- **Upstash Redis** for rate limiting

## Quick Start

### 1. Install Dependencies

```bash
# Clone repository
git clone https://github.com/moizjmj-pk/talk-to-my-lawyer.git
cd talk-to-my-lawyer

# Install dependencies (uses pnpm exclusively)
pnpm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

### 3. Required Environment Variables

#### Critical (Always Required)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_key
```

#### Production Required
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_or_test_key
ADMIN_PORTAL_KEY=your_secure_portal_key
CRON_SECRET=your_cron_secret
```

#### Email Service (Choose One)
```env
EMAIL_PROVIDER=resend  # Options: resend, brevo, sendgrid, smtp, console
EMAIL_FROM=noreply@talk-to-my-lawyer.com
EMAIL_FROM_NAME=Talk-To-My-Lawyer

# Resend (recommended)
RESEND_API_KEY=your_resend_key

# Or Brevo
BREVO_API_KEY=your_brevo_key

# Or SendGrid
SENDGRID_API_KEY=your_sendgrid_key

# Or SMTP
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

#### Rate Limiting (Upstash Redis)
```env
KV_REST_API_URL=your_upstash_url
KV_REST_API_TOKEN=your_upstash_token
```

#### Application URLs
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=https://www.talk-to-my-lawyer.com
```

### 4. Database Setup

Run SQL migrations in order:

```bash
# Run migrations script
pnpm db:migrate

# Or manually in Supabase SQL Editor:
# 1. Execute scripts/001-023.sql files in numeric order
# 2. Execute supabase/migrations/*.sql files in order
```

### 5. Validate Environment

```bash
# Check environment configuration
pnpm validate-env
```

### 6. Start Development Server

```bash
pnpm dev
```

Application will be available at `http://localhost:3000`

## GitHub Secrets Setup

For CI/CD pipeline, add these secrets to GitHub repository:

**Settings → Secrets and variables → Actions**

### Required Secrets
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
OPENAI_API_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ADMIN_EMAIL
ADMIN_PORTAL_KEY
CRON_SECRET
KV_REST_API_URL
KV_REST_API_TOKEN
RESEND_API_KEY
```

### Vercel Deployment Secrets
```
VERCEL_TOKEN          # From https://vercel.com/account/tokens
VERCEL_ORG_ID         # From vercel.json or project settings
VERCEL_PROJECT_ID     # From .vercel/project.json
```

## Stripe Setup (Local Development)

### Install Stripe CLI

The Stripe CLI enables local webhook testing.

### Webhook Forwarding

**Option 1: Automated (Recommended)**
```bash
./scripts/setup-stripe-webhooks.sh
```

**Option 2: Manual**
```bash
# Start dev server
pnpm dev

# In new terminal, login to Stripe
stripe login --api-key sk_test_YOUR_KEY

# Forward webhooks
stripe listen --forward-to http://localhost:3000/api/stripe/webhook \
  --events checkout.session.completed \
  --events customer.subscription.created \
  --events customer.subscription.updated \
  --events customer.subscription.deleted \
  --events invoice.paid \
  --events invoice.payment_failed

# Copy webhook secret to .env.local
# STRIPE_WEBHOOK_SECRET=whsec_...
```

### Test Payment

Use Stripe test card:
```
Card: 4242 4242 4242 4242
Expiry: Any future date (12/34)
CVC: Any 3 digits (123)
ZIP: Any 5 digits (12345)
```

## Admin User Setup

Create the first admin user:

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password>
```

**Example:**
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts admin@company.com SecurePass123!
```

## Essential Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Development server
pnpm build            # Production build
pnpm lint             # Lint code
pnpm validate-env     # Validate environment variables
pnpm health-check     # Check system health
pnpm db:migrate       # Run database migrations
```

## Environment Validation Modes

### Development Mode
- Requires critical environment variables
- Warns about missing production variables
- Uses `.env.local` and `.env` files

### CI Mode
- Accepts dummy values for critical variables
- Shows warnings instead of errors
- Uses `.env.ci` file for testing

### Production Mode
- Requires all critical and production environment variables
- Fails if any required variables are missing

## Troubleshooting

### Build Fails
```bash
# Check for TypeScript errors
pnpm build

# Check for linting issues
pnpm lint
```

### Environment Variables Missing
```bash
# Validate configuration
pnpm validate-env

# Check .env.local exists
ls -la .env.local
```

### Database Connection Issues
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check `SUPABASE_SERVICE_ROLE_KEY` has proper permissions
- Ensure database migrations are applied

### Stripe Webhook Issues
- Verify webhook forwarding is running
- Check `STRIPE_WEBHOOK_SECRET` matches CLI output
- Restart dev server after updating secrets

## Security Best Practices

1. **Never commit** `.env.local` or actual secrets
2. **Use environment variables** for all sensitive configuration
3. **Generate secure keys** for `ADMIN_PORTAL_KEY` and `CRON_SECRET`:
   ```bash
   openssl rand -hex 32
   ```
4. **Rotate secrets** quarterly in production
5. **Use different keys** for development and production

## Next Steps

After setup is complete:

1. **Create Admin User** - Use the CLI script above
2. **Test Local Environment** - Visit `http://localhost:3000`
3. **Test Payment Flow** - Create subscription with test card
4. **Test Letter Generation** - Generate a letter and review workflow
5. **Deploy to Production** - See [DEPLOYMENT.md](./DEPLOYMENT.md)

## Support

- **Documentation**: See other docs in this directory
- **Repository Issues**: https://github.com/moizjmj-pk/talk-to-my-lawyer/issues
- **Environment Variables**: See `scripts/validate-env.js` for complete list

---

**Environment Variable Reference**: Use `scripts/validate-env.js` as the source of truth for required vs optional keys.
