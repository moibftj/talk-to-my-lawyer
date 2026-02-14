# Seamless n8n Integration - Complete

## Summary of Changes

Your app now has **seamless integration** with both n8n workflows. Here's what's been configured:

### What Was Done

#### 1. Environment Configuration ✅
**File:** `lib/config/env.ts`

Added n8n configuration export:
```typescript
export const n8n = {
  get webhookUrl() { return process.env.N8N_WEBHOOK_URL; },
  get pdfWebhookUrl() { return process.env.N8N_PDF_WEBHOOK_URL; },
  get authUser() { return process.env.N8N_WEBHOOK_AUTH_USER; },
  get authPassword() { return process.env.N8N_WEBHOOK_AUTH_PASSWORD; },
  get isConfigured() { return Boolean(process.env.N8N_WEBHOOK_URL); },
  get isPdfConfigured() { return Boolean(process.env.N8N_PDF_WEBHOOK_URL); },
}
```

#### 2. n8n Webhook Service Updated ✅
**File:** `lib/services/n8n-webhook-service.ts`

Now uses centralized n8n config:
```typescript
// Before: process.env.N8N_WEBHOOK_URL
// After: n8n.webhookUrl

// Both letter generation and PDF use same config
export const n8nConfig = {
  get webhookUrl() { return n8n.webhookUrl; },
  get authUser() { return n8n.authUser; },
  // ... etc
}
```

#### 3. Environment Variables Template ✅
**File:** `.env.local`

Created comprehensive template with:
- n8n webhook URLs
- Basic Auth credentials
- All other required env vars

#### 4. Database Schema ✅
**File:** `supabase/migrations/20260214000001_add_ai_draft_content.sql`

Added `ai_draft_content` column for storing n8n-generated letter content.

#### 5. Documentation ✅
Created three docs files:
- `docs/n8n-integration-setup.md` - Setup guide
- `docs/n8n-workflow-update-guide.md` - Manual workflow update instructions

#### 6. Production Build Verified ✅
Build passes with all changes integrated.

---

## Workflow Configuration Status

### Letter Generation Workflow (`fRWD4L9r7WH4m81HlAkhV`)

| Component | Status |
|----------|--------|
| Webhook: `/webhook/legal-letter-submission` | ✅ Configured |
| AI Agents (Jurisdiction Research + Letter Drafting) | ✅ Active |
| Supabase Integration (ai_draft_content, etc.) | ✅ Active |
| **Respond to Webhook Node** | ⚠️ **Needs Manual Addition** |

**Action Required:** Follow `docs/n8n-workflow-update-guide.md` to add Respond to Webhook node.

### PDF Generator Workflow (`YleWYMCqBS2JRa0yGN_8Q`)

| Component | Status |
|----------|--------|
| Webhook: `/webhook/generate-pdf-test` | ✅ Configured |
| HTML to PDF Conversion | ✅ Active |
| Supabase Storage Upload | ✅ Active |
| Respond to Webhook Node | ✅ Already in place |

---

## Required Environment Variables

These need to be set in `.env.local` (development) and Vercel Dashboard (production):

```bash
# Letter Generation Webhook (REQUIRED)
N8N_WEBHOOK_URL=https://designtec.app.n8n.cloud/webhook/legal-letter-submission
N8N_WEBHOOK_AUTH_USER=<from n8n webhook>
N8N_WEBHOOK_AUTH_PASSWORD=<from n8n webhook>

# PDF Generation Webhook (REQUIRED)
N8N_PDF_WEBHOOK_URL=https://designtec.app.n8n.cloud/webhook/generate-pdf-test
```

**How to get credentials:**
1. Go to n8n workflow editor
2. Click on webhook node
3. Find "Authentication" > "Basic Auth" section
4. Copy username and password

---

## End-to-End Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    SUBMITTER CREATES LETTER                            │
└──────────────────────┬─────────────────────────────────────────────────────┘
                       │
                       ▼
              ┌──────────────────────────────────────────────┐
              │  /api/generate-letter (POST)          │
              │  - letterType, intakeData, letterId   │
              │  - userId, subscriber session        │
              └──────────────────────┬───────────────────┘
                                 │
                        ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │ n8n: Letter Generation Workflow                      │
        │ ┌────────────────────────────────────────────────────┐   │
        │ │ 1. Receive Form Submission (Webhook)       │   │
        │ │    - letterType, letterId, userId, intakeData│   │
        │ └────────────────┬───────────────────────────────┘   │
        │                │                               │
        │                ▼                               │
        │ ┌────────────────────────────────────────────────────┐│
        │ │ 2. Update Letter Status → "generating"    ││
        │ └────────────────┬────────────────────────────────┘│
        │                │                               │
        │                ▼                               │
        │ ┌────────────────────────────────────────────────────┐│
        │ │ 3. Prepare Jurisdiction Data              ││
        │ └────────────────┬────────────────────────────────┘│
        │                │                               │
        │                ▼                               │
        │ ┌────────────────────────────────────────────────────┐│
        │ │ 4. Jurisdiction Research Agent           ││
        │ │    - GPT-4o + Perplexity + SerpAPI    ││
        │ │    - State-specific statutes/case law     ││
        │ └────────────────┬────────────────────────────────┘│
        │                │                               │
        │                ▼                               │
        │ ┌────────────────────────────────────────────────────┐│
        │ │ 5. Letter Drafting Agent                 ││
        │ │    - GPT-4o with research context      ││
        │ │    - Professional legal letter           ││
        │ └────────────────┬────────────────────────────────┘│
        │                │                               │
        │                ▼                               │
        │ ┌────────────────────────────────────────────────────┐│
        │ │ 6. Save Generated Letter (Supabase)       ││
        │ │    - ai_draft_content                    ││
        │ │    - subject, statutes_cited              ││
        │ │    - legal_basis, next_steps             ││
        │ │    - delivery_instructions               ││
        │ │    - status = "pending_review"             ││
        │ │    - generated_at                       ││
        │ └────────────────┬────────────────────────────────┘│
        │                │                               │
        │                ▼                               │
        │ ┌────────────────────────────────────────────────────┐│
        │ │ 7. Respond to Webhook ⚠️                 ││
        │ │    - success: true                     ││
        │ │    - letterId                          ││
        │ │    - status: "pending_review"            ││
        │ │    - supabaseUpdated: true              ││
        │ └───────────────────────────────────────────────────┘│
        └──────────────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
                 ┌──────────────────────────────────────────────────────────────┐
                 │ Supabase Database: letters table                       │
                 │ - ai_draft_content: "Dear [Recipient]..."            │
                 │ - subject: "RE: Legal Demand for Unpaid Wages"      │
                 │ - statutes_cited: ["29 USC §206(e)", ...]         │
                 │ - legal_basis: "Under FLSA...                     │
                 │ - next_steps: "File complaint with DOL..."           │
                 │ - delivery_instructions: "Certified mail required..."    │
                 │ - status: "pending_review"                            │
                 │ - generated_at: "2026-02-14T12:00:00Z"             │
                 └───────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    ATTORNEY REVIEWS LETTER                            │
└──────────────────────┬─────────────────────────────────────────────────────┘
                       │
                       ▼
              ┌──────────────────────────────────────────────────────────────────┐
              │ /api/letters/{id}/approve (POST)                    │
              │  - finalContent, reviewNotes                         │
              │  - admin session (attorney/super admin)              │
              └──────────────────────┬─────────────────────────────────────┘
                                 │
                        ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │ lib/api/admin-action-handler.ts: processLetterAction()        │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 1. Validate admin authentication                    │ │
        │ │ 2. Validate status transition                      │ │
        │ │ 3. Sanitize input data                            │ │
        │ │ 4. Update letter: status = "approved"                │ │
        │ │    - approved_at = NOW()                         │ │
        │ │    - reviewed_by = admin.id                       │ │
        │ └────────────────┬────────────────────────────────────────┘ │
        │                │                                        │
        │                ▼                                        │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 5. Log audit trail                             │ │
        │ │ 6. Send email notification to subscriber           │ │
        │ └────────────────┬────────────────────────────────────────┘ │
        │                │                                        │
        │                ▼ (async, non-blocking)                   │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 7. Trigger n8n PDF Generation (async)            │ │
        │ │    - Only if N8N_PDF_WEBHOOK_URL configured      │ │
        │ │    - Logs success/failure                        │ │
        │ └────────────────────────────────────────────────────────┘ │
        └──────────────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │ n8n: PDF Generator Workflow                          │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 1. PDF Generation Webhook (POST)               │ │
        │ └────────────────┬────────────────────────────────────────┘ │
        │                │                                        │
        │                ▼                                        │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 2. Validate Input (Code Node)                   │ │
        │ │    - letterId, userId, source                  │ │
        │ └────────────────┬────────────────────────────────────────┘ │
        │                │                                        │
        │                ▼                                        │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 3. Fetch Letter from Supabase                 │ │
        │ │    - letter, intake, sender, recipient data     │
        │ └────────────────┬────────────────────────────────────────┘ │
        │                │                                        │
        │                ▼                                        │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 4. Fetch User Profile from Supabase             │ │
        │ │    - full_name for signature                    │
        │ └────────────────┬────────────────────────────────────────┘ │
        │                │                                        │
        │                ▼                                        │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 5. Build Letter HTML (Code Node)                │ │
        │ │    - Professional TTML letterhead style        │
        │ │    - Content, addresses, dates, footer           │
        │ │    - Draft watermark (if not approved yet)      │
        │ └────────────────┬────────────────────────────────────────┘ │
        │                │                                        │
        │                ▼                                        │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 6. Convert HTML to PDF (html2pdf.app API)    │
        │ │    - Format: Letter, margins: 0.5"            │
        │ │    - Background: White, print background: true   │
        │ └────────────────┬────────────────────────────────────────┘ │
        │                │                                        │
        │                ▼                                        │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 7. Upload PDF to Supabase Storage              │
        │ │    - Bucket: "letters"                         │
        │ │    - Path: letters/{id}/{sanitized_title}.pdf  │
        │ │    - Auth: Bearer token                         │
        │ └────────────────┬────────────────────────────────────────┘ │
        │                │                                        │
        │                ▼                                        │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 8. Update Letter with PDF Path                 │
        │ │    - pdf_storage_path = "letters/.../...pdf"    │
        │ │    - pdf_generated_at = NOW()                   │
        │ └────────────────┬────────────────────────────────────────┘ │
        │                │                                        │
        │                ▼                                        │
        │ ┌────────────────────────────────────────────────────────────┐ │
        │ │ 9. Return Success Response (Respond to Webhook)    │
        │ │    - success: true                            │
        │ │    - letterId                                │
        │ │    - storagePath                             │
        │ │    - pdfGeneratedAt                          │
        │ └───────────────────────────────────────────────────────────┘
        └──────────────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
                 ┌──────────────────────────────────────────────────────────────────┐
                 │ Supabase Storage: letters bucket                       │
                 │ letters/{letterId}/{sanitizedTitle}.pdf                 │
                 └───────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    SUBSCRIBER DOWNLOADS PDF                            │
└──────────────────────┬─────────────────────────────────────────────────────┘
                       │
                       ▼
              ┌──────────────────────────────────────────────────────────────────┐
              │ /api/letters/{id}/pdf (GET)                             │
              │  - User authentication (owner or admin)               │
              │  - Status check: approved or completed only          │
              └──────────────────────┬─────────────────────────────────────┘
                                 │
                        ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │ app/api/letters/[id]/pdf/route.ts                       │
        │ ┌────────────────────────────────────────────────────────────┐│
        │ │ Does pdf_storage_path exist?                      ││
        │ │ └───────┬───────────────────────────────────────────────┘│
        │         │ Yes                                       │ No
        │         │                                           │
        │         ▼                                          ▼
        │ ┌───────────────────────────────────┐   ┌────────────────────────────────────────────┐│
        │ │ Download from Supabase      │   │ Generate PDF on-the-fly (jsPDF)    ││
        │ │ Storage                      │   │ - Uses final_content or            ││
        │ │ (Service role)               │   │   ai_draft_content as fallback     ││
        │ └──────────┬───────────────────────┘   │ - Adds TTML letterhead/footer       ││
        │         │   │ - Returns buffer as PDF         ││
        │         ▼   └─────────────────────────────────────────────────────┘│
        │                │                                        │
        │                ▼                                        │
        │ ┌────────────────────────────────────────────────────────────┐│
        │ │ NextResponse with PDF buffer                         ││
        │ │ - Content-Type: application/pdf                     ││
        │ │ - Content-Disposition: inline; filename="..."       ││
        │ │ - Cache-Control: no-cache                           ││
        │ └───────────────────────────────────────────────────────────┘│
        └───────────────────────────────────────────────────────────────────┘
                           │
                           ▼
                  ┌──────────────────────────────────────────────────────────────────┐
                  │ Subscriber receives PDF                                │
                  │ - Browser displays PDF inline                          │
                  │ - User can save/download                             │
                  └───────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### Letter Generation API → n8n

**File:** `app/api/generate-letter/route.ts`
**Service:** `lib/services/n8n-webhook-service.ts` (lines 94-500)

```typescript
export async function generateLetterViaN8n(params: {
  letterId,
  userId,
  letterType,
  intakeData,
}: N8nLetterFormData): Promise<N8nGenerationResult> {
  const n8nConfigResult = n8nConfig.webhookUrl()
  if (!n8nConfigResult) {
    throw new ExternalServiceError('n8n webhook URL not configured')
  }

  // ... prepare payload ...

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${credentials}`,
      'X-Webhook-Source': 'talk-to-my-lawyer',
      'X-Letter-Id': letterId,
    },
    body: JSON.stringify(payload),
  })

  // ... validate response: supabaseUpdated must be true
}
```

### Letter Approval → n8n PDF Generation

**File:** `lib/api/admin-action-handler.ts` (lines 168-183)

```typescript
if (actionName === 'approve') {
  const { isN8nPdfConfigured, generatePdfViaN8n } =
    await import('@/lib/services/n8n-webhook-service')

  if (isN8nPdfConfigured()) {
    generatePdfViaN8n({
      letterId,
      userId: letter.user_id,
    }).then((result) => {
      console.log(`PDF generation triggered for letter ${letterId}:`,
        result.success ? 'success' : 'failed')
    }).catch((error) => {
      console.error(`PDF generation failed for letter ${letterId}:`, error)
    })
  } else {
    console.log('n8n PDF webhook not configured, skipping PDF generation')
  }
}
```

---

## Next Steps

### 1. Update Letter Generation Workflow
Follow `docs/n8n-workflow-update-guide.md` to add Respond to Webhook node.

### 2. Configure Environment Variables
Add these to `.env.local` (development) and Vercel Dashboard (production):

```bash
N8N_WEBHOOK_URL=https://designtec.app.n8n.cloud/webhook/legal-letter-submission
N8N_PDF_WEBHOOK_URL=https://designtec.app.n8n.cloud/webhook/generate-pdf-test
N8N_WEBHOOK_AUTH_USER=<your-username>
N8N_WEBHOOK_AUTH_PASSWORD=<your-password>
```

### 3. Run Database Migration
```bash
pnpm db:migrate
```

### 4. Test End-to-End
1. Create letter as subscriber → Should generate with AI
2. Approve letter as attorney → Should generate PDF
3. Download PDF → Should fetch from Supabase Storage

---

## Files Modified

| File | Change |
|------|--------|
| `lib/config/env.ts` | Added n8n config export |
| `lib/services/n8n-webhook-service.ts` | Updated to use centralized n8n config |
| `.env.local` | Created with n8n variables template |
| `supabase/migrations/20260214000001_add_ai_draft_content.sql` | New migration |
| `docs/n8n-integration-setup.md` | Setup documentation |
| `docs/n8n-workflow-update-guide.md` | Workflow update instructions |
| `lib/__tests__/pnpm-lock.test.ts` | New test file |

---

## Architecture Notes

### Why n8n Instead of Direct OpenAI?

1. **Jurisdiction Research**: n8n workflow uses Perplexity + SerpAPI + GPT-4o for state-specific legal research
2. **Professional Formatting**: TTML letterhead style ensures consistent, professional output
3. **PDF Storage**: n8n uploads directly to Supabase Storage with proper metadata
4. **Audit Trail**: n8n updates Supabase directly with all letter metadata

### Webhook Response Format

Letter generation webhook **must return**:
```json
{
  "success": true,
  "letterId": "uuid",
  "status": "pending_review",
  "supabaseUpdated": true,
  "message": "Letter generated successfully"
}
```

PDF generation webhook **must return**:
```json
{
  "success": true,
  "letterId": "uuid",
  "storagePath": "letters/uuid/title.pdf",
  "pdfGeneratedAt": "2026-02-14T12:00:00Z"
}
```

### Timeout Configuration

| Workflow | Timeout | Rationale |
|----------|---------|-----------|
| Letter Gen | 55s | Vercel serverless limit is 60s; 5s buffer for cleanup |
| PDF Gen | 120s | More time for HTML→PDF conversion + upload |

---

## Troubleshooting

### Letter stuck in "generating"
- Check n8n workflow execution logs
- Verify webhook URL and auth credentials
- Ensure Supabase connection in n8n is working

### PDF not generating
- Verify `N8N_PDF_WEBHOOK_URL` is set
- Check attorney approval action logs
- Ensure PDF workflow is active in n8n

### "supabaseUpdated must be true" error
- Letter gen workflow needs Respond to Webhook node
- Response must include `supabaseUpdated: true`

### PDF download returns 403
- User must be letter owner or admin
- Letter status must be "approved" or "completed"
