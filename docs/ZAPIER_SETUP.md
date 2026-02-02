# Zapier Integration Setup Guide

Complete guide for configuring Zapier workflows for AI letter generation with Talk-To-My-Lawyer.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Zapier Zap Configuration](#zapier-zap-configuration)
5. [HMAC Signature Implementation](#hmac-signature-implementation)
6. [Testing Your Setup](#testing-your-setup)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)
9. [Monitoring & Alerts](#monitoring--alerts-optional)
10. [Additional Resources](#additional-resources)

---

## Overview

### Architecture

```
User → App → Zapier → ChatGPT → Zapier → App
         ↓                              ↓
    (outbound)                    (inbound)
    Send form data              Return letter
```

### Workflow

1. **User submits letter form** in the app
2. **App creates letter** with status `generating`
3. **App sends form data to Zapier** catch hook (OUTBOUND)
4. **Zapier triggers ChatGPT** conversation
5. **Zapier computes HMAC signature** for security
6. **Zapier posts result back to app** (INBOUND)
7. **App verifies signature** and updates letter to `pending_review`
8. **Attorney reviews** and approves/rejects the letter

### Security Model

- **Outbound**: Simple POST to Zapier catch hook (no authentication needed)
- **Inbound**: HMAC-signed webhook for verification (prevents unauthorized letter injection)

---

## Prerequisites

Before setting up Zapier integration, ensure you have:

- ✅ Active Zapier account (Professional plan or higher recommended for multi-step Zaps)
- ✅ Access to Talk-To-My-Lawyer environment variables (`.env.local` or hosting platform)
- ✅ ChatGPT integration enabled in your Zapier account
- ✅ Code by Zapier action available (included in most Zapier plans)
- ✅ Admin access to your production deployment (Vercel, etc.)

---

## Environment Variables

### Required Variables

#### 1. ZAPIER_WEBHOOK_URL (Outbound)

The Zapier catch hook URL where the app sends letter generation requests.

**How to get it:**

1. Create a new Zap in Zapier
2. Choose "Webhooks by Zapier" as trigger
3. Select "Catch Hook" event
4. Zapier will provide a unique webhook URL
5. Copy this URL

**Example:**

```bash
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/14299645/ulilhsl/
```

**Location in codebase:** `lib/services/zapier-webhook-service.ts:106`

**Note:** The app has this URL hardcoded as a fallback. Setting the environment variable overrides the fallback.

---

#### 2. ZAPIER_WEBHOOK_SECRET (Inbound Security)

Shared secret for HMAC signature verification on inbound webhooks from Zapier.

**How to generate:**

```bash
# Option 1: Using OpenSSL (recommended)
openssl rand -hex 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Example output:**

```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Configuration:**

```bash
ZAPIER_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**CRITICAL SECURITY REQUIREMENTS:**

- ⚠️ **Minimum 32 characters** (64 recommended for hex strings)
- ⚠️ **Must match** the secret configured in your Zapier Zap
- ⚠️ **Required in production** (webhook will reject unsigned requests)
- ⚠️ **Keep secret** (never commit to git, never log in plain text)

**Location in codebase:** `app/api/letter-generated/route.ts:140`

---

#### 3. ZAPIER_EVENTS_WEBHOOK_URL (Optional - Monitoring)

Separate webhook URL for event notifications (letter completed, failed, submitted, approved, rejected).

**Purpose:** Send fire-and-forget notifications for monitoring, alerting, or analytics workflows.

**Example:**

```bash
ZAPIER_EVENTS_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/YOUR_ACCOUNT/YOUR_EVENTS_HOOK/
```

**Events sent:**

- `letter.generation.started`
- `letter.generation.completed`
- `letter.generation.failed`
- `letter.submitted`
- `letter.approved`
- `letter.rejected`

**Use cases:**

- Slack/Discord notifications for admins
- Logging to Google Sheets or Airtable
- Email alerts for critical events
- Analytics dashboard updates

---

## Zapier Zap Configuration

### Step-by-Step Zap Setup

This section provides detailed instructions for creating your Zapier Zap.

---

### STEP 1: Create the Trigger (Catch Hook)

**Purpose:** Receive letter generation requests from the app.

1. **Log in to Zapier** and click "Create Zap"

2. **Choose Trigger App:**
   - Search for and select: **"Webhooks by Zapier"**
   - Choose Event: **"Catch Hook"**
   - Click "Continue"

3. **Configure Trigger:**
   - Zapier will display a unique webhook URL
   - **Copy this URL** - you'll need it for `ZAPIER_WEBHOOK_URL`
   - Example: `https://hooks.zapier.com/hooks/catch/14299645/ulilhsl/`

4. **Test Trigger:**
   - Set `ZAPIER_WEBHOOK_URL` in your `.env.local` with the URL from step 3
   - Start your development server: `pnpm dev`
   - Generate a test letter in the app
   - Return to Zapier and click "Test trigger"
   - Zapier should show the incoming data

**Expected Payload Fields:**

When you test the trigger, you should see these fields:

- `letterType` - Type of letter (e.g., "demand_letter", "cease_and_desist")
- `letterId` - UUID of the letter record
- `userId` - User ID who created the letter
- `senderName`, `senderAddress`, `senderState` - Sender information
- `recipientName`, `recipientAddress`, `recipientState` - Recipient information
- `issueDetails` - Combined description with issue, desired outcome, and additional details
- `tone` - Desired tone (e.g., "professional", "firm", "compassionate")
- `timestamp` - ISO timestamp
- `source` - Always "talk-to-my-lawyer"

---

### STEP 2: ChatGPT Conversation Action

**Purpose:** Generate the legal letter using AI.

1. **Add Action:**
   - Click the "+" button to add an action
   - Search for and select: **"ChatGPT"**
   - Choose Event: **"Conversation"**
   - Connect your OpenAI account if not already connected
   - Click "Continue"

2. **Configure Conversation:**

   **Model Selection:**
   - Choose: **GPT-4** (recommended for best quality)
   - Alternative: GPT-3.5-turbo (faster, lower cost)

   **System Message/Instructions:**
   ```
   You are a professional legal letter drafting assistant for Talk-To-My-Lawyer.

   Your role is to generate formal, professional legal letters based on client-provided information.

   Guidelines:
   - Use proper business letter formatting
   - Include appropriate legal language and terminology
   - Maintain the requested tone (professional, firm, or compassionate)
   - Be clear, concise, and factual
   - Include proper sender and recipient information
   - Add a professional closing
   - DO NOT provide specific legal advice or make legal claims
   - DO NOT make threats or use inflammatory language
   - The letter will be reviewed by a licensed attorney before delivery

   Output only the letter text without any explanations or meta-commentary.
   ```

   **User Message:**

   Map the fields from Step 1 (use the "+" button to insert data):

   ```
   Draft a {{1. letterType}} with the following details:

   SENDER INFORMATION:
   Name: {{1. senderName}}
   Address: {{1. senderAddress}}, {{1. senderState}}

   RECIPIENT INFORMATION:
   Name: {{1. recipientName}}
   Address: {{1. recipientAddress}}, {{1. recipientState}}

   ISSUE DETAILS:
   {{1. issueDetails}}

   TONE: {{1. tone}}

   Please draft a complete, professional letter ready for attorney review. Include proper formatting, salutation, body paragraphs, and closing.
   ```

   **Memory (optional):** Leave empty or set to "None"

   **Temperature:** 0.7 (balanced creativity and consistency)

   **Max Tokens:** 2000 (adjust based on expected letter length)

3. **Test Action:**
   - Click "Test action"
   - Zapier will send the prompt to ChatGPT
   - Review the generated letter
   - Verify it includes proper formatting and professional language
   - If quality is poor, adjust the system message and try again

**Expected Output:**

The ChatGPT action will return a field called "Message" or "Response" containing the generated letter text. You'll use this in the next step as `generatedContent`.

---

### STEP 3: Compute HMAC Signature (Code by Zapier)

**Purpose:** Generate a cryptographic signature to prove the webhook is from your Zapier Zap.

**Why needed:** The app requires HMAC signature verification for security. Without this, anyone could send fake letters to your app.

1. **Add Action:**
   - Click the "+" button to add an action
   - Search for and select: **"Code by Zapier"**
   - Choose Event: **"Run JavaScript"**
   - Click "Continue"

2. **Configure Input Data:**

   Click "Set up action" and define these input variables:

   - `letterId`: `{{1. letterId}}` (from Step 1 - Webhook)
   - `generatedContent`: `{{2. Response}}` (from Step 2 - ChatGPT; field name may vary)
   - `secret`: Your `ZAPIER_WEBHOOK_SECRET` value (paste the actual secret here)
   - `letterType`: `{{1. letterType}}` (from Step 1 - optional, for metadata)

   **IMPORTANT:** The `secret` value MUST be the exact same string you set in `ZAPIER_WEBHOOK_SECRET` environment variable.

3. **JavaScript Code:**

   Paste this code into the "Code" field:

   ```javascript
   const crypto = require('crypto');

   // Build the payload that will be sent to the app
   const payload = {
     letterId: inputData.letterId,
     generatedContent: inputData.generatedContent,
     success: true,
     metadata: {
       letterType: inputData.letterType || 'unknown',
       generatedAt: new Date().toISOString(),
       model: 'chatgpt-via-zapier',
       source: 'zapier'
     }
   };

   // Convert to JSON string (this EXACT string will be sent as request body)
   const payloadString = JSON.stringify(payload);

   // Compute HMAC-SHA256 signature using the shared secret
   const hmac = crypto.createHmac('sha256', inputData.secret);
   hmac.update(payloadString, 'utf8');
   const signature = 'sha256=' + hmac.digest('hex');

   // Return the payload string and signature for the next step
   output = {
     payloadString: payloadString,
     signature: signature,
     letterId: payload.letterId
   };
   ```

4. **Test Action:**
   - Click "Test action"
   - Zapier will execute the JavaScript
   - Verify the output includes three fields:
     - `payloadString` - JSON string of the payload
     - `signature` - String starting with "sha256="
     - `letterId` - The letter UUID
   - If there are errors, check that all input variables are mapped correctly

**Common Issues:**

- **"inputData.secret is undefined"**: Make sure you pasted your secret in the Input Data section
- **"inputData.generatedContent is undefined"**: The field name from ChatGPT may be different (try "Message" or "Choices")
- **Syntax errors**: Copy the code exactly as shown above

---

### STEP 4: Send Response to App (POST Webhook)

**Purpose:** Send the generated letter back to the app for processing.

1. **Add Action:**
   - Click the "+" button to add an action
   - Search for and select: **"Webhooks by Zapier"**
   - Choose Event: **"POST"**
   - Click "Continue"

2. **Configure POST Request:**

   **URL:**
   ```
   https://www.talk-to-my-lawyer.com/api/letter-generated
   ```

   **Important:** Use your actual domain:
   - **Development:** `https://your-dev-url.vercel.app/api/letter-generated`
   - **Staging:** `https://your-staging-url.vercel.app/api/letter-generated`
   - **Production:** `https://www.talk-to-my-lawyer.com/api/letter-generated`

   **Payload Type:**
   - Select: **"json"**

   **Data (Pass Through?):**
   - Select: **"no"**

   **Data:**

   Instead of using the form fields, we'll send the pre-formatted JSON:
   - In the "Data" field, click "Show Editor"
   - Delete any pre-filled content
   - Click the "+" button and select **"Custom Value"**
   - Paste: `{{3. payloadString}}` (from Step 3 - Code by Zapier)

   **Actually, better approach - use raw body:**

   Zapier's POST webhook has a "Payload Type" option. Make sure it's set to "json" and:

   - Click "Data" section
   - Remove any default fields
   - Click "Switch to Code Mode" or "Raw"
   - Paste: `{{3. payloadString}}`

   **Headers:**

   Add these custom headers (click "Show Options" → "Headers"):

   | Header Key | Header Value |
   |------------|--------------|
   | `Content-Type` | `application/json` |
   | `X-Zapier-Signature` | `{{3. signature}}` |
   | `X-Webhook-Source` | `talk-to-my-lawyer` |

   **Wrap Request In Array:** No

   **Unflatten:** No

   **File:** Leave empty

3. **Test Action:**
   - Click "Test action"
   - Zapier will send the webhook to your app
   - **Check response status:** Should be 200 OK
   - **Check response body:** Should show success message and letter ID

   **Expected Success Response:**
   ```json
   {
     "success": true,
     "data": {
       "message": "Letter generation completed and queued for review",
       "letterId": "uuid-here",
       "status": "pending_review",
       "contentLength": 1234,
       "updatedAt": "2026-02-02T12:00:00Z"
     }
   }
   ```

   **If you get errors:**
   - `401 Unauthorized` → Check signature is being sent in header
   - `Invalid webhook signature` → Secret mismatch, verify `ZAPIER_WEBHOOK_SECRET` matches
   - `404 Not Found` → Check the URL is correct
   - `Letter not found` → Ensure the test letter exists in your database

4. **Verify in Database:**

   After successful test, check your database:
   ```sql
   SELECT id, status, ai_draft, generated_at, updated_at
   FROM letters
   WHERE id = 'your-test-letter-id'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

   The letter should now have:
   - `status`: `pending_review`
   - `ai_draft`: The generated letter text
   - `generated_at`: Current timestamp

---

### STEP 5: Name Your Zap and Turn It On

1. **Name Your Zap:**
   - Click the "Untitled Zap" at the top
   - Name it: "Talk-To-My-Lawyer: Letter Generation"
   - Add description: "Generates legal letters via ChatGPT and returns to app"

2. **Review All Steps:**
   - Step 1: Catch Hook ✓
   - Step 2: ChatGPT Conversation ✓
   - Step 3: Run JavaScript (HMAC) ✓
   - Step 4: POST to app ✓

3. **Turn On the Zap:**
   - Click "Publish" or toggle the Zap to ON
   - Zapier will confirm the Zap is now active

4. **Monitor the First Runs:**
   - Go to Zapier dashboard → Zap History
   - Watch for incoming webhooks
   - Verify all steps complete successfully
   - Check for any errors in the task history

---

## HMAC Signature Implementation

### Understanding HMAC Security

HMAC (Hash-based Message Authentication Code) ensures that:

1. **Authenticity**: The webhook actually came from your Zapier Zap
2. **Integrity**: The content wasn't tampered with during transmission
3. **Non-repudiation**: Only someone with the secret could have created the signature

### How It Works

#### On Zapier Side (Sending):

1. Serialize the entire payload to a JSON string
2. Compute HMAC-SHA256 hash using the shared secret
3. Send the signature in the `X-Zapier-Signature` header
4. Send the original JSON payload as the request body

#### On App Side (Receiving):

1. Read the raw request body (JSON string)
2. Read the signature from `X-Zapier-Signature` header
3. Compute HMAC-SHA256 hash of the body using the same secret
4. Compare the computed signature with the received signature
5. Accept request only if signatures match (using timing-safe comparison)

### Code Reference

**Signature Generation (Zapier - JavaScript):**

```javascript
const crypto = require('crypto');
const payloadString = JSON.stringify(payload);
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payloadString, 'utf8');
const signature = 'sha256=' + hmac.digest('hex');
```

**Signature Verification (App - TypeScript):**

Location: `lib/security/webhook-signature.ts` (lines 30-73)

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyWebhookSignature(
  signature: string | null,
  payload: string,
  secret: string
): WebhookSignatureVerificationResult {
  if (!signature) {
    return { valid: false, error: 'Missing signature header' };
  }

  // Remove "sha256=" prefix
  const signatureBytes = Buffer.from(signature.split('=')[1], 'hex');

  // Compute HMAC of payload
  const hmac = createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const digestBytes = Buffer.from(hmac.digest('hex'), 'hex');

  // Constant-time comparison prevents timing attacks
  const isValid = timingSafeEqual(signatureBytes, digestBytes);

  return { valid: isValid };
}
```

### Common Pitfalls

1. **Payload Mismatch**
   - ❌ The JSON string sent must EXACTLY match what's used for verification
   - ❌ Any extra whitespace or formatting differences will break verification
   - ✅ Use `JSON.stringify()` once and send that exact string

2. **Encoding Issues**
   - ❌ Using different text encodings (UTF-16 vs UTF-8)
   - ✅ Always use UTF-8 encoding on both sides

3. **Secret Mismatch**
   - ❌ Typos, extra spaces, or different secrets on each side
   - ✅ Copy-paste the secret, don't retype it

4. **Header Name**
   - ❌ Using wrong header name or case sensitivity
   - ✅ Use exactly: `X-Zapier-Signature`

5. **Signature Format**
   - ❌ Sending just the hex digest without "sha256=" prefix
   - ✅ Format as: `sha256=<hex-digest>`

---

## Testing Your Setup

### Local Development Testing

#### 1. Start Your Development Server

```bash
cd /path/to/talk-to-my-lawyer
pnpm dev
```

Server should start on `http://localhost:3000`

#### 2. Set Up Environment Variables

Create or update `.env.local`:

```bash
# Required for testing
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/14299645/ulilhsl/
ZAPIER_WEBHOOK_SECRET=your-test-secret-here

# Other required vars (see .env.example)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
```

#### 3. Generate a Test Letter

1. Open your browser to `http://localhost:3000`
2. Log in as a subscriber (or create a test account)
3. Navigate to letter generation
4. Fill out the letter form with test data
5. Click "Generate Letter"

#### 4. Watch Server Logs

You should see:

```
[GenerateLetter] Sending form data to Zapier webhook (async generation)
POST /api/generate-letter 200
```

#### 5. Check Zapier Task History

1. Go to Zapier dashboard
2. Click on your Zap
3. View "Zap History" or "Task History"
4. Verify the task appears and all steps succeeded

#### 6. Check for Callback

Within 10-30 seconds, you should see:

```
[LetterGenerated] Processing webhook for letter <uuid>
[LetterGenerated] Successfully updated letter <uuid> to pending_review status
POST /api/letter-generated 200
```

#### 7. Verify in Database

```sql
SELECT
  id,
  status,
  LENGTH(ai_draft) as draft_length,
  generated_at,
  updated_at,
  created_at
FROM letters
WHERE user_id = '<your-test-user-id>'
ORDER BY created_at DESC
LIMIT 1;
```

Expected result:
- `status`: `pending_review`
- `draft_length`: > 0 (should be several hundred to a few thousand characters)
- `generated_at`: Recent timestamp
- `ai_draft`: Contains the generated letter text

---

### Testing HMAC Signature Verification

You can test signature verification manually with curl:

#### Generate Test Signature

```bash
#!/bin/bash

# Configuration
SECRET="your-zapier-webhook-secret"
LETTER_ID="test-12345"
ENDPOINT="http://localhost:3000/api/letter-generated"

# Build payload
PAYLOAD=$(cat <<EOF
{
  "letterId": "$LETTER_ID",
  "generatedContent": "This is a test letter generated via Zapier webhook testing.\n\nDear Test Recipient,\n\nThis is a test.\n\nSincerely,\nTest Sender",
  "success": true,
  "metadata": {
    "letterType": "test",
    "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "model": "manual-test"
  }
}
EOF
)

# Compute HMAC signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print "sha256="$2}')

# Send webhook
echo "Sending test webhook..."
echo "Signature: $SIGNATURE"
echo ""

curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-Zapier-Signature: $SIGNATURE" \
  -H "X-Webhook-Source: talk-to-my-lawyer" \
  -d "$PAYLOAD" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -s | jq .
```

#### Expected Success Response

```json
{
  "success": true,
  "data": {
    "message": "Letter generation completed and queued for review",
    "letterId": "test-12345",
    "status": "pending_review",
    "contentLength": 123,
    "updatedAt": "2026-02-02T12:00:00.000Z"
  }
}

HTTP Status: 200
```

#### Expected Failure Response (Bad Signature)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid webhook signature"
  }
}

HTTP Status: 401
```

---

## Production Deployment

### Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] `ZAPIER_WEBHOOK_URL` is set in production environment (Vercel, etc.)
- [ ] `ZAPIER_WEBHOOK_SECRET` is generated (32+ characters, cryptographically random)
- [ ] Same `ZAPIER_WEBHOOK_SECRET` is configured in the Zapier Zap (Step 3 input data)
- [ ] Zapier Zap POST URL (Step 4) points to production domain
- [ ] Zapier Zap is tested end-to-end with production-like data
- [ ] All Zap steps have error handling configured (see below)
- [ ] Rate limits are appropriate for expected traffic
- [ ] Monitoring/alerting is configured (Zapier email notifications, etc.)

### Setting Environment Variables

#### Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Add the following variables:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `ZAPIER_WEBHOOK_URL` | `https://hooks.zapier.com/...` | Production |
   | `ZAPIER_WEBHOOK_SECRET` | `<your-generated-secret>` | Production |
   | `ZAPIER_EVENTS_WEBHOOK_URL` | `https://hooks.zapier.com/...` | Production (optional) |

4. Click "Save"
5. Redeploy your application for changes to take effect

**Security Best Practices:**

- Use Vercel's "Secret" type for `ZAPIER_WEBHOOK_SECRET` (encrypted at rest)
- Set different secrets for Preview and Production environments
- Never commit secrets to git
- Rotate secrets quarterly

#### Other Hosting Platforms

- **Netlify**: Site Settings → Environment Variables
- **AWS**: Systems Manager Parameter Store or Secrets Manager
- **Docker**: Pass via environment variables or secrets file
- **Heroku**: Config Vars in Settings

---

### Update Zap for Production

1. **Duplicate Your Zap** (recommended)
   - Keep a separate "Development" and "Production" Zap
   - Use different webhook URLs for each environment

2. **Update Step 4 (POST Webhook) URL:**
   - Change from dev URL to production:
   ```
   https://www.talk-to-my-lawyer.com/api/letter-generated
   ```

3. **Verify Secret Matches:**
   - In Step 3 (Code by Zapier), ensure the `secret` input matches production `ZAPIER_WEBHOOK_SECRET`

4. **Add Error Handling:**
   - In each step, click "..." → "Error Handling"
   - Configure "Send Error Notification" to your email
   - Optionally: Add retry logic for Step 4 (POST)

5. **Test with Production Data:**
   - Use Zapier's "Test" feature on each step
   - Verify the full workflow completes
   - Check production database for the test letter

6. **Turn On Production Zap**

---

### Security Considerations

1. **Rotate Secrets Regularly**
   - Recommended: Every 90 days
   - When rotating:
     - Generate new secret
     - Update both app environment and Zapier Zap
     - Test thoroughly before old secret expires
     - Update both at the same time to avoid downtime

2. **Use Environment-Specific Zaps**
   - Development Zap → Dev/staging environment
   - Production Zap → Production environment
   - Never mix environments

3. **Monitor for Abuse**
   - Check Zapier task history regularly
   - Alert on unusual patterns (high volume, failures)
   - The app has rate limiting, but monitor Zapier usage too

4. **Rate Limiting**
   - App has built-in rate limiting on `/api/generate-letter`
   - Zapier has rate limits by plan tier:
     - Free: 100 tasks/month
     - Starter: 750 tasks/month
     - Professional: 2,000 tasks/month
     - Team/Company: Higher limits
   - Plan for your expected volume

5. **Data Privacy**
   - User data (names, addresses, issue details) passes through Zapier
   - Review Zapier's privacy policy and data handling
   - Consider GDPR/CCPA compliance requirements
   - Inform users in your privacy policy

---

## Troubleshooting

### Issue: "Invalid webhook signature"

**Symptoms:**
- Webhook returns `401 Unauthorized`
- App logs show: `[LetterGenerated] Invalid webhook signature`
- Letter stays in `generating` status

**Root Cause:** The HMAC signature computed by Zapier doesn't match what the app expects.

**Solutions:**

1. **Verify secrets match:**
   ```bash
   # Check app environment
   echo $ZAPIER_WEBHOOK_SECRET

   # Check Zapier Zap: Step 3 (Code by Zapier) → Input Data → secret
   # They must be EXACTLY the same (case-sensitive, no extra spaces)
   ```

2. **Check payload format:**
   - In Step 4, ensure "Payload Type" is set to "json"
   - Ensure you're sending `{{3. payloadString}}` as raw body, not form fields
   - Do NOT use "Form" payload type

3. **Verify header name:**
   - Must be exactly: `X-Zapier-Signature`
   - Case-sensitive
   - Check for typos

4. **Test signature locally:**
   ```bash
   # Use the curl script from Testing section
   # If local test works, problem is in Zapier configuration
   ```

5. **Check Code by Zapier output:**
   - In Zapier task history, view Step 3 output
   - Verify `signature` field starts with "sha256="
   - Verify `payloadString` is valid JSON

6. **Development mode bypass:**
   - If testing locally and don't need security, temporarily unset `ZAPIER_WEBHOOK_SECRET`
   - App will skip signature verification with a warning
   - **NEVER do this in production**

---

### Issue: "Letter stuck in 'generating' status"

**Symptoms:**
- Letter is created successfully
- Status remains `generating` for > 5 minutes
- No webhook arrives at `/api/letter-generated`
- User sees "Your letter is being generated..." indefinitely

**Root Cause:** Zapier webhook callback failed or didn't happen.

**Diagnosis:**

1. **Check Zapier Task History:**
   - Go to Zapier dashboard → Your Zap → Zap History
   - Look for tasks in the last 5-10 minutes
   - Check if any steps failed

2. **Common Zapier Failures:**
   - **Step 1 (Catch Hook):** Check if webhook was received
   - **Step 2 (ChatGPT):** Check for API errors, rate limits, or timeouts
   - **Step 3 (Code):** Check for JavaScript errors
   - **Step 4 (POST):** Check for network errors, 401/403/500 responses

3. **Check App Logs:**
   ```bash
   # Look for outbound webhook
   grep "Sending form data to Zapier webhook" /var/log/your-app.log

   # Look for inbound webhook
   grep "LetterGenerated" /var/log/your-app.log
   ```

**Solutions:**

1. **If Zapier task never started:**
   - Verify `ZAPIER_WEBHOOK_URL` is correct
   - Verify Zap is turned ON
   - Test webhook URL with curl:
     ```bash
     curl -X POST https://hooks.zapier.com/hooks/catch/14299645/ulilhsl/ \
       -H "Content-Type: application/json" \
       -d '{"test": "connection"}'
     ```

2. **If ChatGPT step failed:**
   - Check OpenAI API status: https://status.openai.com/
   - Check Zapier account is connected to OpenAI
   - Verify prompt isn't too long (max tokens)
   - Check for rate limiting on OpenAI side

3. **If POST step failed:**
   - Check production URL is correct
   - Verify signature is being sent
   - Check app server is running and accessible
   - Check firewall isn't blocking Zapier IP addresses

4. **Manual recovery:**
   ```sql
   -- Find stuck letters
   SELECT id, user_id, status, created_at, updated_at
   FROM letters
   WHERE status = 'generating'
     AND created_at < NOW() - INTERVAL '5 minutes'
   ORDER BY created_at DESC;

   -- Option 1: Reset to draft (user can retry)
   UPDATE letters
   SET status = 'draft',
       updated_at = NOW()
   WHERE id = '<letter-id>';

   -- Option 2: Mark as failed
   UPDATE letters
   SET status = 'failed',
       generation_error = 'Zapier webhook timeout - please try again',
       updated_at = NOW()
   WHERE id = '<letter-id>';

   -- Option 3: Manually generate via OpenAI fallback
   -- (Use the app's OpenAI integration directly)
   ```

5. **Refund user's credit (if applicable):**
   ```sql
   -- Check if user was charged
   SELECT * FROM letter_generation_log WHERE letter_id = '<letter-id>';

   -- Refund credit
   UPDATE subscriptions
   SET monthly_allowance = monthly_allowance + 1
   WHERE user_id = '<user-id>';
   ```

---

### Issue: "Zapier Zap not triggering"

**Symptoms:**
- User submits letter form
- Letter is created with `generating` status
- Nothing appears in Zapier task history
- App logs show "Sending form data to Zapier webhook"

**Solutions:**

1. **Verify webhook URL:**
   ```bash
   # Check environment variable
   echo $ZAPIER_WEBHOOK_URL

   # Should match the Zapier catch hook URL exactly
   ```

2. **Test webhook directly:**
   ```bash
   curl -X POST https://hooks.zapier.com/hooks/catch/14299645/ulilhsl/ \
     -H "Content-Type: application/json" \
     -d '{
       "letterType": "test",
       "senderName": "Test",
       "recipientName": "Test",
       "issueDetails": "Test"
     }'
   ```
   - Should return: `{"status": "success"}` or similar
   - If 404: Zap doesn't exist or wrong URL
   - If 410 Gone: Zap was deleted

3. **Check Zap is ON:**
   - Go to Zapier dashboard
   - Check the toggle next to your Zap is ON (green)
   - If OFF, turn it on and try again

4. **Check Zapier account status:**
   - Verify account is active (not expired trial)
   - Check task limit hasn't been reached
   - Check billing is current

5. **Network issues:**
   - Verify your server can reach Zapier (not blocked by firewall)
   - Check DNS resolution: `nslookup hooks.zapier.com`

---

### Issue: "ChatGPT returns malformed or poor-quality content"

**Symptoms:**
- Letter is generated but quality is poor
- Formatting is inconsistent
- Missing key information
- Unprofessional language

**Solutions:**

1. **Improve system prompt:**
   - Add more specific formatting instructions
   - Include examples of good letters
   - Specify structure: opening, body paragraphs, closing

2. **Use GPT-4 instead of GPT-3.5:**
   - Higher quality and consistency
   - Better instruction following
   - Worth the extra cost for legal content

3. **Add validation in Code by Zapier:**
   ```javascript
   // After getting ChatGPT response, validate it
   const content = inputData.generatedContent;

   if (content.length < 200) {
     throw new Error('Generated letter too short');
   }

   if (!content.includes('Dear') && !content.includes('To:')) {
     throw new Error('Letter missing salutation');
   }

   if (!content.includes('Sincerely') && !content.includes('Regards')) {
     throw new Error('Letter missing closing');
   }
   ```

4. **Adjust temperature:**
   - Lower temperature (0.3-0.5) for more consistent output
   - Higher temperature (0.7-0.9) for more creative language

5. **Set max tokens appropriately:**
   - Too low: Letter gets cut off
   - Too high: Unnecessary content
   - Recommended: 1500-2500 tokens

---

### Development Mode (No Signature Verification)

For local development, you can skip signature verification:

**How it works:**

If `ZAPIER_WEBHOOK_SECRET` environment variable is NOT set:
- App logs a warning: `"Proceeding without signature verification (development mode)"`
- Webhook signature is NOT checked
- All webhooks are accepted

**When to use:**

- ✅ Local development on `localhost`
- ✅ Testing webhook payload format
- ✅ Debugging without Zapier

**When NOT to use:**

- ❌ **NEVER in production**
- ❌ Staging environments accessible from internet
- ❌ When testing security features

**How to enable:**

```bash
# .env.local
# Comment out or remove ZAPIER_WEBHOOK_SECRET
# ZAPIER_WEBHOOK_SECRET=...
```

**Security Warning:**

Without signature verification, anyone can send fake letters to your app. Only use this mode on secured local development environments.

---

## Monitoring & Alerts (Optional)

### Using ZAPIER_EVENTS_WEBHOOK_URL

You can set up a separate monitoring Zap to track letter events.

#### Setup

1. **Create a new Zap**
2. **Trigger:** Webhooks by Zapier → Catch Hook
3. **Copy the webhook URL** to `ZAPIER_EVENTS_WEBHOOK_URL`
4. **Add actions** based on your monitoring needs

#### Example Actions

**Slack Notification:**
```
New letter {{event}}: {{letterType}}
Letter ID: {{letterId}}
User: {{userId}}
Status: {{status}}
Time: {{timestamp}}
```

**Google Sheets Logging:**
- Create a spreadsheet with columns: timestamp, event, letterId, letterType, userId, status
- Add "Google Sheets → Create Row" action
- Map webhook fields to columns

**Email Alerts (Critical Events):**
- Add filter: "Only continue if event contains 'failed'"
- Add "Email by Zapier" action
- Send to: admin@yourdomain.com

#### Events Sent by App

| Event | When Triggered | Fields Included |
|-------|----------------|-----------------|
| `letter.generation.started` | Letter generation begins | letterId, letterType, userId, isFreeTrial |
| `letter.generation.completed` | Letter successfully generated | letterId, letterType, userId, status |
| `letter.generation.failed` | Generation fails | letterId, letterType, userId, error |
| `letter.submitted` | User submits for review | letterId, userId |
| `letter.approved` | Attorney approves | letterId, adminId |
| `letter.rejected` | Attorney rejects | letterId, adminId, reason |

#### Example Event Payload

```json
{
  "event": "letter.generation.completed",
  "timestamp": "2026-02-02T12:00:00.000Z",
  "letterId": "uuid-here",
  "letterType": "demand_letter",
  "letterTitle": "Demand Letter - 02/02/2026",
  "userId": "uuid-here",
  "isFreeTrial": false,
  "status": "pending_review",
  "metadata": {
    "generationMethod": "zapier",
    "generationTime": "12.5s"
  }
}
```

---

### Automated Stuck Letter Detection

You can create a monitoring Zap to detect and alert on stuck letters.

**Approach 1: Database Query (requires database integration)**

1. **Trigger:** Schedule by Zapier (every 15 minutes)
2. **Action 1:** PostgreSQL → Run Query
   ```sql
   SELECT id, user_id, letter_type, created_at
   FROM letters
   WHERE status = 'generating'
     AND created_at < NOW() - INTERVAL '10 minutes'
   LIMIT 10;
   ```
3. **Action 2:** Filter → Only continue if rows found
4. **Action 3:** Slack/Email → Send alert with letter IDs
5. **Action 4 (Optional):** Webhook → Trigger retry or auto-fail

**Approach 2: App Webhook (requires app modification)**

1. **Modify app** to send event when letter is stuck
2. **Trigger:** Webhooks by Zapier → Catch Hook
3. **Action:** Send alert to admin channel

---

## Additional Resources

### Documentation Links

- **Zapier Webhooks Guide:** https://zapier.com/help/doc/how-get-started-webhooks-zapier
- **ChatGPT in Zapier:** https://zapier.com/apps/chatgpt/integrations
- **Code by Zapier:** https://zapier.com/help/doc/how-use-code-app
- **HMAC Wikipedia:** https://en.wikipedia.org/wiki/HMAC
- **OpenAI API Status:** https://status.openai.com/

### App Code Reference

- **Outbound webhook service:** `lib/services/zapier-webhook-service.ts`
- **Inbound webhook handler:** `app/api/letter-generated/route.ts`
- **HMAC signature verification:** `lib/security/webhook-signature.ts`
- **Letter generation API:** `app/api/generate-letter/route.ts`
- **Environment variables example:** `.env.example`

### Related Documentation

- **Setup Guide:** `docs/SETUP_AND_CONFIGURATION.md`
- **API Integration Guide:** `docs/API_AND_INTEGRATIONS.md`
- **Security Guide:** `docs/SECURITY.md`
- **Architecture Guide:** `docs/ARCHITECTURE_AND_DEVELOPMENT.md`

---

## Quick Reference

### Environment Variables

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `ZAPIER_WEBHOOK_URL` | Outbound catch hook URL | Recommended | Hardcoded fallback |
| `ZAPIER_WEBHOOK_SECRET` | HMAC signature secret | **Production** | None (dev mode) |
| `ZAPIER_EVENTS_WEBHOOK_URL` | Event notifications | Optional | None |

### API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/generate-letter` | POST | Trigger letter generation | Subscriber + rate limit |
| `/api/letter-generated` | POST | Receive generated letter | HMAC signature |
| `/api/letter-generated` | GET | Health check & docs | Public |

### Letter Status Flow

```
draft → generating → pending_review → under_review → approved → completed
                  ↘                                ↘
                   failed                          rejected
```

### Common Commands

```bash
# Generate secret
openssl rand -hex 32

# Test webhook
curl -X POST https://hooks.zapier.com/hooks/catch/.../  \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Check letter status
SELECT id, status, created_at FROM letters
WHERE id = '<letter-id>';

# Find stuck letters
SELECT * FROM letters
WHERE status = 'generating'
AND created_at < NOW() - INTERVAL '5 minutes';
```

---

## Support

If you encounter issues not covered in this guide:

1. Check the **Troubleshooting** section above
2. Review **Zapier Task History** for detailed error messages
3. Check **app server logs** for API errors
4. Test **signature verification** with the curl script
5. Verify **all environment variables** are set correctly
6. Contact support with:
   - Letter ID
   - Zapier task ID
   - Error messages from logs
   - Steps to reproduce

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-02
**Maintained By:** Talk-To-My-Lawyer Engineering Team
