# API & Integrations Guide

Complete guide for all third-party integrations and API configurations for Talk-To-My-Lawyer.

---

## Table of Contents

1. [Stripe Setup & Payment Processing](#stripe-setup--payment-processing)
2. [Email Service Configuration](#email-service-configuration)
3. [GitHub Secrets & CI Setup](#github-secrets--ci-setup)
4. [Testing Payments](#testing-payments)

---

## Stripe Setup & Payment Processing

### Environment Variables

Your `.env.local` file should contain these Stripe variables:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

### Stripe CLI Installation

The Stripe CLI is installed for webhook forwarding during local development.

#### Verify Installation

```bash
stripe --version
# Should output: stripe version 1.19.0
```

### Local Development with Webhooks

#### Option 1: Automated Setup (Recommended)

Run the webhook setup script:

```bash
./scripts/setup-stripe-webhooks.sh
```

This script will:
1. Authenticate with Stripe (using your STRIPE_SECRET_KEY)
2. Start forwarding webhooks to `http://localhost:3000/api/stripe/webhook`
3. Listen for relevant payment events

#### Option 2: Manual Setup

1. **Start your dev server:**
   ```bash
   pnpm dev
   ```

2. **In a new terminal, login to Stripe:**
   ```bash
   stripe login --api-key sk_test_YOUR_SECRET_KEY_HERE
   ```

3. **Start webhook forwarding:**
   ```bash
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook \
     --events checkout.session.completed \
     --events customer.subscription.created \
     --events customer.subscription.updated \
     --events customer.subscription.deleted \
     --events invoice.paid \
     --events invoice.payment_failed \
     --events payment_intent.succeeded \
     --events payment_intent.payment_failed
   ```

4. **Copy the webhook secret:**
   The CLI will output a webhook secret like:
   ```
   whsec_1234567890abcdef...
   ```
   
   Copy this and update your `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
   ```

5. **Test a payment:**
   - Go to your local app: http://localhost:3000
   - Navigate to pricing/checkout
   - Use Stripe test card: `4242 4242 4242 4242`
   - Check the webhook logs in your terminal

### Important Endpoints

The platform uses these Stripe webhook events:
- `checkout.session.completed` - When a user completes payment
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription changes (plan changes, etc.)
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.paid` - Recurring payment succeeded
- `invoice.payment_failed` - Recurring payment failed
- `payment_intent.succeeded` - One-time payment succeeded
- `payment_intent.payment_failed` - One-time payment failed

### Webhook Endpoint

The webhook endpoint is located at: `/app/api/stripe/webhook/route.ts`

### Production Setup

For production deployment:

1. **Get your live API keys from the Stripe Dashboard**
2. **Set up a production webhook endpoint** in the Stripe Dashboard
3. **Update environment variables** with production keys
4. **Configure webhook events** for your production endpoint

The production webhook URL will be:
```
https://yourdomain.com/api/stripe/webhook
```

Make sure to configure the same events that you're listening for in development.

### Security Notes

- Never commit actual API keys to version control
- Use environment variables for all sensitive configuration
- The webhook secret should be different between development and production
- Always use HTTPS for production webhook endpoints
- Verify webhook signatures in your endpoint handler

---

## Testing Payments

### Test Card Numbers

Use these test card numbers:

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Insufficient funds:** `4000 0000 0000 9995`
- **Expired card:** `4000 0000 0000 0069`
- **Requires Authentication:** `4000 0025 0000 3155`

For any test card:
- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **ZIP:** Any 5 digits

### Payment Flow Overview

```
User → Checkout → Stripe Checkout Page → Payment → Webhook → Subscription Created
```

### How to Test Dummy Payments

#### 1. Start Your Dev Server

```bash
pnpm dev
```

Your app should run on: `http://localhost:3000`

#### 2. Stripe CLI is Already Running

The webhook forwarding is already active in the background and listening for payment events.

#### 3. Test the Payment Flow

**Step 1: Sign up/Login**
- Go to: `http://localhost:3000`
- Create an account or login

**Step 2: Navigate to Pricing/Subscription**
- Go to: `http://localhost:3000/dashboard/subscription`

**Step 3: Select a Plan**
- Choose Single Letter, Monthly, or Yearly plan
- Click "Subscribe" or "Get Started"

**Step 4: Complete Test Payment**

You'll be redirected to Stripe Checkout. Use test card details above.

**Step 5: Submit Payment**
- Click "Pay" or "Subscribe"
- Stripe will process the test payment
- You'll be redirected back to your app
- Your subscription should be active!

#### 4. Verify Subscription

After successful payment:
1. Check your dashboard - subscription should show as "Active"
2. You should have letter credits available
3. Check Stripe Dashboard: https://dashboard.stripe.com/test/payments

### Troubleshooting

#### Common Issues

1. **Webhook secret mismatch:**
   - Ensure `STRIPE_WEBHOOK_SECRET` in `.env.local` matches the CLI output
   - Restart your dev server after updating the secret

2. **Events not firing:**
   - Check that the Stripe CLI is running and connected
   - Verify the endpoint URL is correct (`http://localhost:3000/api/stripe/webhook`)
   - Check the webhook logs in both the CLI and your app logs

3. **Authentication errors:**
   - Verify your `STRIPE_SECRET_KEY` is correct and has the right permissions
   - Ensure you're using the test key (starts with `sk_test_`) for development

#### Debug Commands

```bash
# Check Stripe CLI connection
stripe --version

# List webhook endpoints (if any are configured)
stripe webhook_endpoints list

# View recent events
stripe events list --limit 10

# Test webhook forwarding
stripe listen --forward-to http://localhost:3000/api/stripe/webhook --print-secret
```

### Stripe Dashboard Links

- **Test Dashboard**: https://dashboard.stripe.com/test/dashboard
- **Payments**: https://dashboard.stripe.com/test/payments
- **Webhooks**: https://dashboard.stripe.com/test/webhooks
- **Events**: https://dashboard.stripe.com/test/events
- **Customers**: https://dashboard.stripe.com/test/customers

---

## Email Service Configuration

The platform supports multiple email providers with automatic failover.

### Supported Providers

- **Resend** (Recommended) - Production-grade email delivery
- **Brevo** - Alternative provider
- **SendGrid** - Alternative provider
- **SMTP** - Custom SMTP server
- **Console** - Development mode (logs emails to console)

### Environment Variables

```bash
# Email Service Configuration
EMAIL_PROVIDER=resend  # Options: resend, brevo, sendgrid, smtp, console
EMAIL_FROM=noreply@talk-to-my-lawyer.com
EMAIL_FROM_NAME=Talk-To-My-Lawyer

# Resend (recommended)
RESEND_API_KEY=

# Or Brevo
BREVO_API_KEY=

# Or SendGrid
SENDGRID_API_KEY=

# Or SMTP
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### Provider Configuration

#### Resend (Recommended)

1. Sign up at https://resend.com
2. Verify your domain
3. Get API key from dashboard
4. Set `EMAIL_PROVIDER=resend`
5. Set `RESEND_API_KEY=re_...`

#### Brevo

1. Sign up at https://www.brevo.com
2. Verify your domain
3. Get API key from dashboard
4. Set `EMAIL_PROVIDER=brevo`
5. Set `BREVO_API_KEY=xkeysib-...`

#### SendGrid

1. Sign up at https://sendgrid.com
2. Verify your domain
3. Get API key from dashboard
4. Set `EMAIL_PROVIDER=sendgrid`
5. Set `SENDGRID_API_KEY=SG....`

#### Console (Development)

For local development without external email service:

```bash
EMAIL_PROVIDER=console
```

Emails will be logged to console instead of sent.

### Email Templates

Templates are defined in `lib/email/templates.ts`:

- `welcome` - New user registration
- `password-reset` - Password reset request
- `letter-approved` - Letter approved by attorney
- `letter-rejected` - Letter rejected with feedback
- `letter-generated` - Letter AI draft ready
- `commission-earned` - Employee earned commission
- `subscription-confirmation` - Subscription activated

### Testing Email Delivery

```bash
node test-email-send.js
```

---

## GitHub Secrets & CI Setup

### Required Secrets for CI

Add these secrets to your GitHub repository at Settings → Secrets and variables → Actions:

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

### Optional Secrets

```
DATABASE_URL
SUPABASE_HOSTNAME
AI_GATEWAY_API_KEY
SECURE_ADMIN_GATEWAY_KEY
ADMIN_PASSWORD
KV_REST_API_READ_ONLY_TOKEN
REDIS_URL
KV_URL
```

### App URLs (Secrets or Variables)

```
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
```

### Production Deployment (Vercel)

For the production deployment workflow, also add these secrets:

#### Vercel Deployment Secrets

```
VERCEL_TOKEN          # Your Vercel API token
VERCEL_ORG_ID         # Your Vercel organization ID
VERCEL_PROJECT_ID     # Your Vercel project ID
```

#### GitHub Variables (for Production)

Go to Settings → Secrets and variables → Actions → Variables:

```
PRODUCTION_URL=https://www.talk-to-my-lawyer.com
```

**Finding your Vercel credentials:**

1. **VERCEL_TOKEN**: Create at https://vercel.com/account/tokens
2. **VERCEL_ORG_ID**: Found in `vercel.json` or Vercel project settings
3. **VERCEL_PROJECT_ID**: Found in `.vercel/project.json` or project settings

⚠️ **Security Note**: Never commit real API keys or secrets to your repository. Always use GitHub Secrets for sensitive data.

---

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Resend Documentation](https://resend.com/docs)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
