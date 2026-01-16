# Supabase Email Webhook Setup Guide

This guide shows you how to configure Supabase to use your custom email webhook instead of Supabase's built-in SMTP.

## Why Use a Custom Email Webhook?

- ✅ Use Resend for reliable email delivery
- ✅ Consistent email templates across all emails
- ✅ Better error handling and logging
- ✅ More control over email sending logic
- ✅ Avoid configuring SMTP settings in Supabase

---

## Prerequisites

1. **Your application must be deployed** - Supabase needs to reach your webhook URL
2. **Resend must be working** - Fix network connectivity issues first
3. **Environment variables set**:
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `NEXT_PUBLIC_SITE_URL` (your deployed app URL)

---

## Step 1: Generate a Webhook Secret

Generate a secure secret to protect your webhook endpoint:

```bash
# Run this command
openssl rand -hex 32
```

This will output something like:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Save this secret** - you'll need it in the next steps.

---

## Step 2: Add Secret to Your Application

Add the generated secret to your environment variables:

### For Production (Vercel/Netlify/etc.):
1. Go to your hosting platform's dashboard
2. Navigate to Environment Variables
3. Add:
   ```
   SUPABASE_AUTH_HOOK_SECRET=<your-generated-secret>
   ```
4. Redeploy your application

### For Local Development:
Add to your `.env.local` file:
```bash
SUPABASE_AUTH_HOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

---

## Step 3: Configure Supabase Auth Hook

### Option A: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase project dashboard**
   - URL: https://supabase.com/dashboard/project/[your-project-id]

2. **Navigate to Authentication Settings**
   - Click "Authentication" in the left sidebar
   - Click "Hooks" tab
   - Or go directly to: `https://supabase.com/dashboard/project/[your-project-id]/auth/hooks`

3. **Configure the Send Email Hook**
   - Find the "Send Email" hook section
   - Click "Enable Hook"
   - Enter your webhook URL:
     ```
     https://your-domain.com/api/auth/send-email
     ```
     Replace `your-domain.com` with your actual deployed domain

4. **Add the Webhook Secret**
   - In the "Secrets" section of the hook configuration
   - Add your generated secret from Step 1
   - Secret name: `SUPABASE_AUTH_HOOK_SECRET`
   - Secret value: `<your-generated-secret>`

5. **Test the Hook** (optional)
   - Use the "Send test event" button
   - Check your application logs to verify it received the request

6. **Save Changes**
   - Click "Save" or "Update"

### Option B: Using Supabase CLI

If you prefer using the CLI:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref [your-project-ref]

# Configure the auth hook
supabase secrets set SUPABASE_AUTH_HOOK_SECRET=<your-generated-secret>

# Update auth hook configuration
# Edit: supabase/config.toml
```

Add to `supabase/config.toml`:
```toml
[auth.hook.send_email]
enabled = true
uri = "https://your-domain.com/api/auth/send-email"
```

Then push the config:
```bash
supabase db push
```

---

## Step 4: Verify Configuration

### Test 1: Check Webhook Endpoint
```bash
# Test the webhook is accessible
curl https://your-domain.com/api/auth/send-email

# Expected response:
{
  "status": "ok",
  "message": "Supabase Auth Email Hook Endpoint",
  "supportedTypes": ["signup", "email_confirmation", "recovery", "password_recovery", "email_change", "magic_link"]
}
```

### Test 2: Sign Up a Test User

1. Go to your signup page
2. Create a test account with a real email you can access
3. Check your email inbox for the confirmation email
4. Check your application logs for:
   ```
   [SendEmail] Received webhook: { type: 'signup', email: 'test@example.com' }
   [SendEmail] Email sent successfully: { type: 'signup', to: 'test@example.com', messageId: '...' }
   ```

### Test 3: Check Supabase Logs

In Supabase Dashboard:
1. Go to "Logs" → "Auth Logs"
2. Look for entries related to your test signup
3. Verify the hook was called successfully

---

## What Emails Will Use the Webhook?

Once configured, these emails will be sent through your custom webhook (Resend):

| Email Type | Trigger | Template Used |
|------------|---------|---------------|
| **Signup Confirmation** | User signs up | `email-confirmation` |
| **Password Reset** | User requests password reset | `password-reset` |
| **Email Change** | User changes email address | Custom HTML |
| **Magic Link** | User requests magic link login | Custom HTML |

---

## Troubleshooting

### Hook Not Being Called

**Problem**: Emails still not arriving, no webhook logs

**Solutions**:
1. Verify hook is enabled in Supabase dashboard
2. Check webhook URL is correct and accessible publicly
3. Ensure your app is deployed (localhost won't work)
4. Check Supabase Auth Logs for errors

**For local development**, you can:
- Use ngrok to expose your localhost:
  ```bash
  ngrok http 3000
  # Use the ngrok URL in Supabase: https://abc123.ngrok.io/api/auth/send-email
  ```
- Or disable email confirmation temporarily in Supabase:
  - Go to Authentication → Email Auth
  - Disable "Confirm email"

### "Invalid signature" Error

**Problem**: Webhook returns 401 Unauthorized

**Solutions**:
1. Verify `SUPABASE_AUTH_HOOK_SECRET` matches in both:
   - Your application environment variables
   - Supabase Auth Hook configuration
2. Redeploy your application after adding the secret
3. Check the secret doesn't have extra spaces or newlines

### Emails Still Not Sending

**Problem**: Webhook is called but emails don't arrive

**Solutions**:
1. Check application logs for Resend errors:
   ```
   [EmailService] Resend API error: ...
   ```
2. Verify network connectivity (see EMAIL_SETUP_FIX.md)
3. Confirm Resend API key is valid
4. Check domain is verified in Resend dashboard

### "Unknown email type" Error

**Problem**: Webhook returns 400 Bad Request with unknown type

**Solutions**:
1. Check Supabase is sending a supported email type
2. Supported types: `signup`, `email_confirmation`, `recovery`, `password_recovery`, `email_change`, `magic_link`
3. Check application logs for the exact type received
4. You may need to add support for additional types in `/app/api/auth/send-email/route.ts`

---

## Advanced Configuration

### Custom Email Templates

To customize email templates sent by the webhook:

1. **For confirmation emails**: Edit template in `lib/email/templates.ts`:
   - Template key: `email-confirmation`

2. **For password reset**: Edit template in `lib/email/templates.ts`:
   - Template key: `password-reset`

3. **For other email types**: Edit HTML directly in `/app/api/auth/send-email/route.ts`:
   - Lines 105-142 contain inline email templates

### Rate Limiting

The webhook endpoint doesn't have rate limiting by default. To add it:

```typescript
// In /app/api/auth/send-email/route.ts
import { safeApplyRateLimit, apiRateLimit } from '@/lib/rate-limit-redis'

export async function POST(request: NextRequest) {
  // Add rate limiting
  const rateLimitResponse = await safeApplyRateLimit(
    request,
    apiRateLimit,
    10,  // 10 requests
    "1 m"  // per minute
  )
  if (rateLimitResponse) return rateLimitResponse

  // ... rest of the code
}
```

### Webhook Signature Verification

Currently, signature verification is minimal (line 34). To implement proper HMAC verification:

```typescript
import crypto from 'crypto'

function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET
  if (!hookSecret) return false

  const signature = request.headers.get('x-supabase-signature')
  if (!signature) return false

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', hookSecret)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
```

---

## Migration from Supabase SMTP

If you're currently using Supabase's built-in SMTP:

1. **Set up the webhook** (follow steps above)
2. **Test thoroughly** with test users
3. **Disable Supabase SMTP** once webhook is working:
   - Go to: Authentication → Email Settings
   - Uncheck "Enable Custom SMTP"
4. **Monitor logs** for the first few days to catch any issues

---

## Reverting to Supabase SMTP

If you need to go back to Supabase's SMTP:

1. **Disable the Auth Hook**:
   - Go to: Authentication → Hooks
   - Disable "Send Email" hook

2. **Configure SMTP in Supabase**:
   - Go to: Authentication → Email Settings
   - Enable "Enable Custom SMTP"
   - Enter your SMTP details (see EMAIL_SETUP_FIX.md)

3. **Keep the webhook code**: It won't be called but remains available for future use

---

## Security Checklist

Before deploying to production:

- [ ] Generated a strong webhook secret (32+ characters)
- [ ] Added secret to environment variables
- [ ] Webhook URL uses HTTPS (not HTTP)
- [ ] Signature verification is enabled
- [ ] Rate limiting is configured (optional)
- [ ] Application logs are monitored for errors
- [ ] Tested all email types (signup, password reset, etc.)

---

## Support & Resources

- **Supabase Auth Hooks Docs**: https://supabase.com/docs/guides/auth/auth-hooks
- **Resend Documentation**: https://resend.com/docs
- **Your webhook endpoint**: `https://your-domain.com/api/auth/send-email`
- **Code location**: `/app/api/auth/send-email/route.ts`

---

Last Updated: 2026-01-15
