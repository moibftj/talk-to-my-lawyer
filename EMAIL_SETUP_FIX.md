# Email Delivery Fix Guide

## Problem Identified

Your emails are not being delivered due to **network connectivity issues** preventing the application from reaching the Resend API.

### Root Causes:

1. **Network/DNS Issue**: The application cannot connect to Resend's API servers
   - Error: "Unable to fetch data. The request could not be resolved."
   - This is likely a DNS resolution or network firewall issue

2. **Code Bug Fixed**: The email provider was reporting success even when emails failed
   - ✅ FIXED: Updated `/lib/email/providers/resend.ts` to properly detect Resend API failures

3. **Supabase Email Configuration**: Supabase's built-in email system is not configured
   - Signup confirmation emails rely on Supabase's SMTP (which isn't set up)
   - Custom email webhook exists but isn't configured in Supabase

---

## Solution Options

### Option 1: Fix Network Connectivity (Recommended)

The Resend integration is already set up correctly. You just need to resolve the network issue:

1. **Check DNS Resolution**:
   ```bash
   # Test if you can reach Resend's API
   ping api.resend.com
   nslookup api.resend.com
   ```

2. **Check Firewall Rules**:
   - Ensure outbound HTTPS (port 443) is allowed
   - Whitelist `api.resend.com` if needed
   - Check if you're behind a corporate proxy

3. **Test After Network Fix**:
   ```bash
   # Run this test to verify email sending works
   node --input-type=module <<'EOF'
   import { Resend } from 'resend';
   const resend = new Resend(process.env.RESEND_API_KEY);

   const result = await resend.emails.send({
     from: 'noreply@talk-to-my-lawyer.com',
     to: 'delivered@resend.dev',
     subject: 'Test Email',
     html: '<p>Testing email delivery</p>'
   });

   console.log('Result:', result);
   EOF
   ```

4. **Verify Domain**:
   - Log into your Resend dashboard at https://resend.com
   - Go to "Domains" and verify that `talk-to-my-lawyer.com` is added and verified
   - If not, add the domain and configure DNS records as instructed

---

### Option 2: Configure Supabase Auth Webhook

To use your custom Resend integration for auth emails (signup confirmation, password reset):

1. **Go to Supabase Dashboard**:
   - Navigate to: Authentication → Email Templates → Settings

2. **Enable Custom SMTP (Auth Hook)**:
   - Under "SMTP Settings" or "Auth Hooks"
   - Set the Send Email Hook URL to:
     ```
     https://your-domain.com/api/auth/send-email
     ```

3. **Add Auth Hook Secret** (recommended):
   - Generate a secure secret:
     ```bash
     openssl rand -hex 32
     ```
   - Add to your `.env.local`:
     ```bash
     SUPABASE_AUTH_HOOK_SECRET=your-generated-secret
     ```
   - Configure the same secret in Supabase Auth Hooks settings

---

### Option 3: Use Supabase's Built-in SMTP

If you can't fix the network issue and want emails working immediately:

1. **Configure SMTP in Supabase**:
   - Go to: Project Settings → Auth → SMTP Settings
   - Enable "Enable Custom SMTP"
   - Fill in SMTP details (example with Gmail):
     ```
     Host: smtp.gmail.com
     Port: 587
     Sender email: your-email@gmail.com
     Sender name: Talk-To-My-Lawyer
     Username: your-email@gmail.com
     Password: your-app-password
     ```

2. **Or Use Resend SMTP** (once network is fixed):
   ```
   Host: smtp.resend.com
   Port: 587
   Username: resend
   Password: <your-resend-api-key>
   ```

---

### Option 4: Alternative Email Provider

If Resend continues to have issues, switch to SendGrid (already in dependencies):

1. **Get SendGrid API Key**:
   - Sign up at https://sendgrid.com
   - Get API key from Settings → API Keys

2. **Update Environment Variables**:
   ```bash
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your-sendgrid-key
   EMAIL_FROM=noreply@talk-to-my-lawyer.com
   ```

3. **Verify Domain in SendGrid**:
   - Go to Settings → Sender Authentication
   - Verify your domain with DNS records

---

## Environment Variables Checklist

Make sure these are set (currently using system environment, not .env file):

```bash
# Current Setup (✅ Already Set)
RESEND_API_KEY=re_DfZwJ1tH_JCjrmaV9eYtLs3sdLRjgcNf2
EMAIL_FROM=noreply@talk-to-my-lawyer.com

# Recommended Additions
EMAIL_FROM_NAME=Talk-To-My-Lawyer
SUPABASE_AUTH_HOOK_SECRET=<generate-random-secret>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

---

## Testing Email Delivery

### Test 1: Direct Resend API Test
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@talk-to-my-lawyer.com",
    "to": "delivered@resend.dev",
    "subject": "Test Email",
    "html": "<p>Testing</p>"
  }'
```

### Test 2: Application Email Test
```bash
# Start your dev server
pnpm dev

# In another terminal, test the email endpoint
curl -X POST http://localhost:3000/api/auth/resend-confirmation \
  -H "Content-Type: application/json" \
  -d '{"email": "your-test-email@example.com"}'
```

### Test 3: Check Email Queue
```bash
# Check if emails are stuck in the queue
curl http://localhost:3000/api/admin/email-queue \
  -H "Authorization: Bearer <admin-token>"
```

---

## Quick Fix Summary

**Immediate Actions:**

1. ✅ **Code Fixed**: Error handling updated to properly detect failures
2. 🔧 **Network**: Fix DNS/firewall to allow access to `api.resend.com`
3. ✅ **Verify Domain**: Ensure `talk-to-my-lawyer.com` is verified in Resend
4. 🔧 **Supabase**: Configure auth webhook OR built-in SMTP in Supabase dashboard

**Expected Results:**

After fixing network connectivity:
- ✅ Signup confirmation emails will be sent
- ✅ Welcome emails will be delivered
- ✅ Password reset emails will work
- ✅ All template emails will function correctly

---

## Common Issues

### "Email sent successfully" but no email arrives

**Cause**: Network connectivity issue or invalid API key

**Fix**:
1. Check network connectivity to Resend API
2. Verify API key is valid in Resend dashboard
3. Check application logs for actual errors (should now show proper errors after fix)

### Domain not verified

**Error**: "Domain not verified" from Resend

**Fix**:
1. Go to https://resend.com/domains
2. Add `talk-to-my-lawyer.com`
3. Add the provided DNS records to your domain registrar
4. Wait for DNS propagation (can take up to 48 hours)

### Emails go to spam

**Fix**:
1. Set up SPF, DKIM, and DMARC records (Resend provides these)
2. Use a verified sending domain
3. Avoid spam trigger words in subject lines
4. Include unsubscribe links

---

## Support

If issues persist after following this guide:

1. **Check Logs**: Look at server logs for detailed error messages
2. **Resend Status**: Check https://status.resend.com
3. **Network Admin**: Contact your network administrator about firewall/DNS
4. **Resend Support**: Contact Resend support with your API key and domain

---

## Files Modified

- ✅ `/lib/email/providers/resend.ts` - Fixed error handling to properly detect API failures

---

Last Updated: 2026-01-15
