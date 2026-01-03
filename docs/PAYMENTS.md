# Payments & Stripe Setup Guide

Complete guide for Stripe integration, payment testing, and payment flow management.

## Overview

Talk-To-My-Lawyer uses Stripe for all payment processing, including subscriptions, one-time payments, and employee commission tracking.

## Environment Variables

### Stripe Configuration

```bash
# Stripe Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

**Production Note**: Replace `test` keys with `live` keys in production.

## Stripe CLI Installation

The Stripe CLI enables local webhook testing during development.

### Verify Installation

```bash
stripe --version
# Should output: stripe version 1.19.0 or higher
```

## Local Development with Webhooks

### Option 1: Automated Setup (Recommended)

Run the webhook setup script:

```bash
./scripts/setup-stripe-webhooks.sh
```

This script will:
1. Authenticate with Stripe (using your STRIPE_SECRET_KEY)
2. Start forwarding webhooks to `http://localhost:3000/api/stripe/webhook`
3. Listen for relevant payment events

### Option 2: Manual Setup

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

## Important Endpoints

The platform uses these Stripe webhook events:

| Event | Description |
|-------|-------------|
| `checkout.session.completed` | When a user completes payment |
| `customer.subscription.created` | New subscription created |
| `customer.subscription.updated` | Subscription changes (plan changes, etc.) |
| `customer.subscription.deleted` | Subscription cancelled |
| `invoice.paid` | Recurring payment succeeded |
| `invoice.payment_failed` | Recurring payment failed |
| `payment_intent.succeeded` | One-time payment succeeded |
| `payment_intent.payment_failed` | One-time payment failed |

## Webhook Endpoint

The webhook endpoint is located at:
```
/app/api/stripe/webhook/route.ts
```

## Testing Payments

### Test Card Numbers

Use these test card numbers:

| Card Type | Number | Use Case |
|-----------|--------|----------|
| **Success** | `4242 4242 4242 4242` | Payment succeeds |
| **Decline** | `4000 0000 0000 0002` | Card declined |
| **Insufficient Funds** | `4000 0000 0000 9995` | Declined for insufficient funds |
| **Expired Card** | `4000 0000 0000 0069` | Card expired |
| **Requires Authentication** | `4000 0025 0000 3155` | Requires 3D Secure authentication |

For any test card:
- **Expiry**: Any future date (e.g., 12/34)
- **CVC**: Any 3 digits (e.g., 123)
- **ZIP**: Any 5 digits (e.g., 12345)
- **Name**: Test User

## Complete Payment Flow Testing

### Step 1: Start Services

```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Start Stripe CLI
stripe listen --forward-to http://localhost:3000/api/stripe/webhook \
  --events checkout.session.completed \
  --events customer.subscription.created \
  --events invoice.paid \
  --events payment_intent.succeeded
```

### Step 2: Test Subscription Flow

1. Navigate to: `http://localhost:3000`
2. Sign up or login as a subscriber
3. Go to: `/dashboard/subscription`
4. Choose a plan (Single Letter, Monthly, or Yearly)
5. Click "Subscribe"

### Step 3: Complete Test Payment

You'll be redirected to Stripe Checkout. Use:

```
Card Number: 4242 4242 4242 4242
Expiry: 12/34
CVC: 123
Name: Test User
ZIP: 12345
```

### Step 4: Verify Results

After successful payment:
- ✅ Dashboard shows "Active" subscription
- ✅ Letter credits available
- ✅ Check Stripe Dashboard: https://dashboard.stripe.com/test/payments
- ✅ Webhook logs show event received
- ✅ Email confirmation sent

## Payment Plans

### Production Pricing

| Plan | Price | Letters | Type |
|------|-------|---------|------|
| **Single Letter** | $299 | 1 | One-time |
| **Monthly Plan** | $299/month | 4 | Recurring |
| **Yearly Plan** | $599/year | 52 | Recurring |

### Employee Discounts

- Employees can generate coupon codes
- Default discount: 20% off
- Commission rate: 5% of subscription amount

## Troubleshooting

### Common Issues

#### 1. Webhook Secret Mismatch

**Problem**: Events not processing, signature verification fails

**Solution**:
- Ensure `STRIPE_WEBHOOK_SECRET` in `.env.local` matches CLI output
- Restart dev server after updating the secret

#### 2. Events Not Firing

**Problem**: No webhook events received

**Solution**:
- Check that Stripe CLI is running and connected
- Verify endpoint URL is correct (`http://localhost:3000/api/stripe/webhook`)
- Check webhook logs in both CLI and app logs

#### 3. Authentication Errors

**Problem**: API calls failing with 401

**Solution**:
- Verify `STRIPE_SECRET_KEY` is correct
- Ensure using test key (starts with `sk_test_`) for development
- Check key has proper permissions in Stripe Dashboard

### Debug Commands

```bash
# Check Stripe CLI connection
stripe --version

# List webhook endpoints
stripe webhook_endpoints list

# View recent events
stripe events list --limit 10

# Test webhook forwarding
stripe listen --forward-to http://localhost:3000/api/stripe/webhook --print-secret

# Trigger test event
stripe trigger checkout.session.completed
```

### Webhook Status Check

```bash
# Check if webhook forwarding is running
ps aux | grep "stripe listen"

# View webhook logs
cat /tmp/stripe-webhook.log  # If redirected to file
```

### Verify Database Updates

```sql
-- Check subscription created
SELECT * FROM subscriptions WHERE user_id = 'YOUR_USER_ID' ORDER BY created_at DESC LIMIT 1;

-- Check commission created (if coupon used)
SELECT * FROM commissions WHERE subscription_id = 'SUBSCRIPTION_ID';

-- Check coupon usage
SELECT * FROM coupon_usage WHERE subscription_id = 'SUBSCRIPTION_ID';
```

## Production Setup

For production deployment:

### 1. Get Live API Keys

Go to Stripe Dashboard → Developers → API keys

- Copy **Publishable key** (starts with `pk_live_`)
- Copy **Secret key** (starts with `sk_live_`)

### 2. Create Production Webhook

Go to Stripe Dashboard → Developers → Webhooks

1. Click "+ Add endpoint"
2. Set endpoint URL: `https://yourdomain.com/api/stripe/webhook`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy the **Signing secret** (starts with `whsec_`)

### 3. Update Environment Variables

In Vercel or your hosting platform:

```env
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_PRODUCTION_WEBHOOK_SECRET
```

### 4. Test Production Webhook

```bash
# Use Stripe CLI to test production endpoint
stripe listen --forward-to https://yourdomain.com/api/stripe/webhook --api-key sk_live_YOUR_KEY
```

### 5. Verify Domain in Stripe

Go to Stripe Dashboard → Settings → Branding

- Add your production domain
- Enable it for Stripe Checkout

## Security Notes

### Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for all sensitive configuration
3. **Different webhook secrets** for dev and production
4. **Always use HTTPS** for production webhook endpoints
5. **Verify webhook signatures** in endpoint handler
6. **Rotate keys** quarterly in production

### Webhook Signature Verification

The application automatically verifies webhook signatures:

```typescript
// In /app/api/stripe/webhook/route.ts
const signature = headers().get("stripe-signature")
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
)
```

## Stripe Dashboard Links

- **Test Dashboard**: https://dashboard.stripe.com/test/dashboard
- **Payments**: https://dashboard.stripe.com/test/payments
- **Webhooks**: https://dashboard.stripe.com/test/webhooks
- **Events**: https://dashboard.stripe.com/test/events
- **Customers**: https://dashboard.stripe.com/test/customers
- **Products**: https://dashboard.stripe.com/test/products

## Support

For Stripe integration issues:
- Check application logs
- Review Stripe webhook delivery logs
- Verify environment variables
- Test with Stripe CLI
- Consult [Stripe Documentation](https://stripe.com/docs)

---

**Last Updated**: January 2026  
**Version**: Production Stripe Integration v2.0
