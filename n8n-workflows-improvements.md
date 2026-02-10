# n8n Workflows - Improvements Summary

## Overview
Two improved workflow JSON files have been created alongside the originals. These fix critical bugs, add missing functionality, and align with the current codebase implementation.

---

## Workflow 1: Letter Generation with Jurisdiction Research

### Critical Fixes

| Issue | Original | Fixed |
|-------|----------|-------|
| **Status** | Set to `completed` | ✅ Now `pending_review` (requires attorney approval) |
| **Error Handling** | None | ✅ Added `Return Error Response` node |
| **Response Format** | Missing | ✅ Returns `{success, letterId, status, supabaseUpdated}` |
| **Data References** | Mixed/confusing | ✅ Simplified with consistent `$('Extract Form Data')` references |

### Improvements

1. **Streamlined Node Flow**
   - Removed unnecessary "Route by Letter Type" switch (all letters use same generation path)
   - Removed "Prepare Jurisdiction Data" (data now passed directly)
   - Consolidated extraction into single "Extract Form Data" node

2. **Better Data Flow**
   ```javascript
   // Extract all needed data upfront
   {
     letterType, letterId, userId,
     senderName, senderState,
     recipientName, recipientState,
     issueDescription, desiredOutcome,
     intakeData (full object)
   }
   ```

3. **Proper Research Integration**
   - Research output is now passed to Letter Drafting Agent
   - Drafting prompt includes full intake data + research results

4. **Response Format Matches Service Expectations**
   ```json
   {
     "success": true,
     "letterId": "uuid",
     "status": "pending_review",
     "supabaseUpdated": true
   }
   ```

### Environment Variables Needed
- `N8N_WEBHOOK_URL` - Webhook endpoint URL
- `N8N_WEBHOOK_AUTH_KEY` - Header auth key
- `OPENAI_API_KEY` - For GPT-4o model
- `PERPLEXITY_API_KEY` - For legal research

---

## Workflow 2: PDF Generator & Storage

### Critical Fixes

| Issue | Original | Fixed |
|-------|----------|-------|
| **Webhook Connection** | No output connection | ✅ Connected to Validate Input |
| **API Key** | Placeholder `(YOUR_HTML2PDF_API_KEY)` | ⚠️ Needs real key (still marked) |
| **Supabase URL** | Hardcoded project URL | ✅ Uses `$env.SUPABASE_URL` |
| **Auth Headers** | Missing | ✅ Added `Authorization: Bearer $env.SUPABASE_SERVICE_ROLE_KEY` |
| **Content Field** | Used `ai_draft_content` | ✅ Uses `letter_content` first, falls back to `ai_draft_content` |
| **Error Handling** | Broken/missing paths | ✅ Fixed all error response nodes |

### Improvements

1. **Complete Workflow Connection**
   ```
   Webhook → Validate Input → Fetch Letter → Fetch Profile → Build HTML
   → Convert to PDF → Process Result → Upload to Storage → Update DB
   ```

2. **Proper Field Priority**
   ```javascript
   // Uses letter_content for approved letters
   // Falls back to ai_draft_content for other states
   const content = letter.letter_content || letter.ai_draft_content || '';
   ```

3. **Environment Variable Configuration**
   - `SUPABASE_URL` - From environment
   - `SUPABASE_SERVICE_ROLE_KEY` - For storage auth
   - `HTML2PDF_API_KEY` - For PDF generation

4. **Better Error Responses**
   - 404: Letter not found
   - 500: PDF generation/upload failed

5. **Enhanced HTML Generation**
   - Uses `subject` field (preferred) over `title`
   - Shows "NOT APPROVED" watermark for drafts
   - Footer shows attorney review text only for approved letters

---

## Setup Instructions

### Step 1: Import Workflows into n8n

1. Open n8n interface
2. Click "Import from File/URL"
3. Upload both `(IMPROVED).json` files
4. Save and activate both workflows

### Step 2: Configure Environment Variables in n8n

Go to n8n Settings → Variables and add:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# PDF Generation
HTML2PDF_API_KEY=your-html2pdf-api-key

# OpenAI (for letter generation)
OPENAI_API_KEY=sk-...

# Perplexity (for legal research) - optional
PERPLEXITY_API_KEY=pplx-...
```

### Step 3: Configure Credentials

In n8n, set up these credential accounts:

| Name | Type | Purpose |
|------|------|---------|
| Header Auth account | HTTP Header Auth | Webhook authentication |
| Supabase account | Supabase | Database operations |
| OpenAI account | OpenAI | GPT-4o model |
| Perplexity account | Perplexity | Legal research (optional) |

### Step 4: Update Service Code Environment Variables

In your `.env` file:

```bash
# n8n Configuration
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/legal-letter-submission
N8N_WEBHOOK_AUTH_KEY=your-webhook-auth-key

N8N_PDF_WEBHOOK_URL=https://your-n8n-instance.com/webhook/generate-pdf
N8N_PDF_WEBHOOK_AUTH_KEY=your-pdf-webhook-auth-key
```

### Step 5: Test the Workflows

**Test Letter Generation:**
```bash
curl -X POST https://your-n8n.com/webhook/legal-letter-submission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-webhook-auth-key" \
  -d '{
    "letterType": "Demand Letter",
    "letterId": "test-letter-id",
    "userId": "test-user-id",
    "intakeData": {
      "senderName": "John Doe",
      "senderState": "CA",
      "recipientName": "ABC Corp",
      "recipientState": "NY",
      "issueDescription": "Breach of contract",
      "desiredOutcome": "Full refund"
    }
  }'
```

**Test PDF Generation:**
```bash
curl -X POST https://your-n8n.com/webhook/generate-pdf \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-pdf-webhook-auth-key" \
  -d '{
    "letterId": "existing-letter-id",
    "userId": "user-id"
  }'
```

---

## Troubleshooting

### Issue: Webhook receives no data
- **Check**: Webhook has output connection (fixed in improved version)
- **Check**: Webhook authentication is configured correctly

### Issue: Letter status becomes `completed` instead of `pending_review`
- **Fix**: Use improved workflow (status is now `pending_review`)

### Issue: PDF upload fails with 401/403
- **Check**: `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- **Check**: Storage bucket `letters` exists with RLS policies allowing service role

### Issue: PDF shows wrong content
- **Check**: Letter has `letter_content` field (approved) or `ai_draft_content` (draft)
- **Fix**: Improved workflow prioritizes `letter_content` correctly

---

## Files Created

| File | Purpose |
|------|---------|
| `AI-Powered Legal Letter Generation with Jurisdiction Research (IMPROVED).json` | Fixed letter generation workflow |
| `TTML - Letter PDF Generator & Storage (IMPROVED).json` | Fixed PDF generation workflow |
| `n8n-workflows-improvements.md` | This documentation |

---

## Checklist

- [ ] Import both improved workflows into n8n
- [ ] Configure n8n environment variables
- [ ] Set up credential accounts in n8n
- [ ] Update `.env` with n8n webhook URLs
- [ ] Test letter generation endpoint
- [ ] Test PDF generation endpoint
- [ ] Verify letters go to `pending_review` status
- [ ] Verify PDFs upload to Supabase Storage correctly
- [ ] Check attorney review center receives generated letters
