# Repo ↔ Database Alignment (my-agent)

- Cross-checked schema against `DATABASE_ALIGNMENT_REPORT.md` (2026-01-06) and Supabase migrations to ensure TypeScript shapes match the live database.
- Updated shared database types to reflect current subscription fields (uses `remaining_letters`/`credits_remaining`, keeps `stripe_session_id`, retains legacy `letters_remaining` alias for RPC compatibility, drops `letters_per_period`) and broadened status values used by the app.
- Consolidated exports in `types/index.ts` to re-use `lib/database.types.ts` so future schema changes stay aligned in one place.

## Production Readiness Audit (2026-01-13)

### Audit Results

- 59 API routes inventoried, mapped to callers, auth gates, and data flows
- 20+ Supabase RPC functions verified to exist in migrations
- 6 Vercel cron jobs confirmed active (now 7 with fix applied)

### Key Findings

#### ✅ WORKING (Critical Paths)

- Payment flow: checkout → Stripe webhook → subscription activation
- Letter flow: generate → submit → review → approve/reject → PDF
- Admin portal: letters, coupons, analytics, email queue
- Auth: login, signup, password reset, admin sessions

#### ⚠️ GAPS IDENTIFIED

- 6 GDPR routes with no UI (legal compliance risk for EU)
- Admin payouts page missing
- Resubmit/complete letter flows not wired to UI
- 3–4 unused routes to clean up

### Immediate Fix Applied

- Added `check-stuck-letters` to `vercel.json` cron jobs (runs every 2 hours)

### Verdict

**Ship it.** Core monetization path is fully wired. Identified gaps are edge cases and quality-of-life features, not blockers.

---

## API Routes Reference

### Authentication

| Route                           | Method | Description               |
| ------------------------------- | ------ | ------------------------- |
| `/api/auth/resend-confirmation` | POST   | Resend email confirmation |
| `/api/auth/reset-password`      | POST   | Initiate password reset   |
| `/api/auth/send-email`          | POST   | Send auth-related email   |
| `/api/auth/update-password`     | POST   | Update user password      |

### Admin Authentication

| Route                    | Method | Description         |
| ------------------------ | ------ | ------------------- |
| `/api/admin-auth/login`  | POST   | Admin portal login  |
| `/api/admin-auth/logout` | POST   | Admin portal logout |

### Profile

| Route                 | Method | Description                                  |
| --------------------- | ------ | -------------------------------------------- |
| `/api/create-profile` | POST   | Create user profile (triggers welcome email) |

### Checkout & Billing

| Route                                | Method | Description                       |
| ------------------------------------ | ------ | --------------------------------- |
| `/api/create-checkout`               | POST   | Create Stripe checkout session    |
| `/api/verify-payment`                | POST   | Verify payment completion         |
| `/api/subscriptions/check-allowance` | GET    | Check letter generation allowance |
| `/api/subscriptions/billing-history` | GET    | Get billing history               |
| `/api/subscriptions/activate`        | POST   | Activate subscription             |
| `/api/subscriptions/reset-monthly`   | POST   | Reset monthly letter count        |

### Letters

| Route                            | Method    | Description              |
| -------------------------------- | --------- | ------------------------ |
| `/api/generate-letter`           | POST      | Generate AI letter draft |
| `/api/letters/drafts`            | GET, POST | Get/save letter drafts   |
| `/api/letters/improve`           | POST      | Improve letter with AI   |
| `/api/letters/[id]/submit`       | POST      | Submit for review        |
| `/api/letters/[id]/start-review` | POST      | Attorney starts review   |
| `/api/letters/[id]/approve`      | GET, POST | Approve letter           |
| `/api/letters/[id]/reject`       | POST      | Reject letter            |
| `/api/letters/[id]/resubmit`     | POST      | Resubmit after changes   |
| `/api/letters/[id]/complete`     | POST      | Mark as completed        |
| `/api/letters/[id]/delete`       | DELETE    | Delete letter            |
| `/api/letters/[id]/improve`      | POST      | Request improvements     |
| `/api/letters/[id]/pdf`          | GET       | Download as PDF          |
| `/api/letters/[id]/send-email`   | POST      | Send letter via email    |
| `/api/letters/[id]/audit`        | GET       | Get audit trail          |

### Admin

| Route                            | Method      | Description             |
| -------------------------------- | ----------- | ----------------------- |
| `/api/admin/csrf`                | GET         | Get CSRF token          |
| `/api/admin/letters`             | GET         | List letters for review |
| `/api/admin/letters/batch`       | POST        | Batch letter operations |
| `/api/admin/letters/[id]/update` | POST        | Update letter           |
| `/api/admin/analytics`           | GET         | Platform analytics      |
| `/api/admin/coupons`             | GET         | List coupons            |
| `/api/admin/coupons/create`      | POST, PATCH | Create/update coupons   |
| `/api/admin/email-queue`         | GET, POST   | Manage email queue      |

### Employee

| Route                         | Method    | Description          |
| ----------------------------- | --------- | -------------------- |
| `/api/employee/referral-link` | GET       | Get referral link    |
| `/api/employee/payouts`       | GET, POST | View/request payouts |

### GDPR

| Route                             | Method            | Description               |
| --------------------------------- | ----------------- | ------------------------- |
| `/api/gdpr/accept-privacy-policy` | GET, POST         | Privacy policy acceptance |
| `/api/gdpr/export-data`           | GET, POST         | Export user data          |
| `/api/gdpr/delete-account`        | GET, POST, DELETE | Account deletion          |

### Email

| Route                      | Method | Description           |
| -------------------------- | ------ | --------------------- |
| `/api/email/send`          | POST   | Send email via Resend |
| `/api/email/process-queue` | POST   | Process email queue   |

### Webhooks & Health

| Route                       | Method | Description            |
| --------------------------- | ------ | ---------------------- |
| `/api/stripe/webhook`       | POST   | Stripe webhook handler |
| `/api/health`               | GET    | Basic health check     |
| `/api/health/detailed`      | GET    | Detailed health status |
| `/api/test/create-accounts` | POST   | Create test accounts   |

---

## Supabase RPC Functions

| Function                     | Purpose                                |
| ---------------------------- | -------------------------------------- |
| `get_letter_audit_trail`     | Retrieve letter audit history          |
| `check_letter_allowance`     | Check subscriber's remaining letters   |
| `calculate_commission`       | Calculate employee commission          |
| `process_coupon_usage`       | Handle coupon redemption               |
| `get_admin_analytics`        | Aggregate analytics data               |
| `cleanup_expired_sessions`   | Session maintenance                    |
| `process_fraud_detection`    | Security checks                        |
| `get_user_data_export`       | GDPR data export                       |
| `soft_delete_user`           | GDPR account deletion                  |
| `get_subscription_status`    | Get subscription details               |
| `decrement_letter_allowance` | Decrease letter count after generation |
| `get_employee_commissions`   | Employee commission summary            |
| `validate_coupon_code`       | Coupon validation logic                |
| `log_admin_action`           | Admin audit trail logging              |

---

## Vercel Cron Jobs

Configured in `vercel.json`:

| Job                   | Schedule       | Route                                | Purpose                                |
| --------------------- | -------------- | ------------------------------------ | -------------------------------------- |
| Email Queue Processor | Every 5 min    | `/api/email/process-queue`           | Process queued emails with retry logic |
| Session Cleanup       | Every 6 hours  | `/api/cron/cleanup-expired-sessions` | Remove expired admin sessions          |
| Health Check          | Every 30 min   | `/api/cron/health-check`             | Monitor platform health                |
| Daily Analytics       | 1:00 AM daily  | `/api/cron/daily-analytics`          | Aggregate platform metrics             |
| Weekly Cleanup        | 2:00 AM Sunday | `/api/cron/weekly-cleanup`           | Archive old data, cleanup logs         |
| Monthly Reset         | 1st of month   | `/api/subscriptions/reset-monthly`   | Reset monthly letter allowances        |
| Stuck Letters Check   | Every 2 hours  | `/api/cron/check-stuck-letters`      | Detect and handle stuck letter states  |

---

## n8n Workflows (TTML)

### 1. AI-Powered Legal Letter Generation with Jurisdiction Research

**File**: `AI-Powered Legal Letter Generation with Jurisdiction Research (IMPROVED).json`

**Webhook Endpoint**: `POST /legal-letter-submission` (header auth)

**Flow**:

```
Receive Form Submission → Extract Form Data → Update Letter Status to "generating"
    ↓
Jurisdiction Research Agent (GPT-4o + Perplexity)
    ├── Researches state statutes for sender & recipient states
    ├── Finds relevant legal precedents and case law
    ├── Identifies jurisdiction-specific requirements (notice periods, delivery methods)
    └── Outputs structured JSON with citations
    ↓
Letter Drafting Agent (GPT-4o)
    ├── Uses jurisdiction research + intake data
    ├── Drafts professional legal letter with proper formatting
    ├── Cites relevant statutes and case law
    └── Outputs: letterContent, subject, statutesCited, legalBasis, nextSteps, deliveryInstructions
    ↓
Save Generated Letter to Supabase
    ├── Sets status = "pending_review"
    ├── Stores ai_draft_content, subject, statutes_cited, legal_basis
    └── Updates generated_at timestamp
    ↓
Return Success Response
```

**Key Components**:

- **Jurisdiction Research Agent**: Uses GPT-4o + Perplexity tool for real-time legal research
- **Letter Drafting Agent**: Uses GPT-4o to draft jurisdiction-compliant letters
- **Structured Output Parsers**: Ensure consistent JSON schema for database storage
- **Memory Buffer**: Maintains context between research and drafting phases

**Integration**: Called from `/api/generate-letter` when n8n workflow is enabled

---

### 2. TTML Letter PDF Generator & Storage

**File**: `TTML - Letter PDF Generator & Storage (IMPROVED).json`

**Webhook Endpoint**: `GET /generate-pdf` (header auth)

**Flow**:

```
PDF Generation Webhook → Validate Input (letterId required)
    ↓
Fetch Letter from Supabase → Fetch User Profile
    ↓
Build Letter HTML
    ├── Uses final_content for approved letters, ai_draft_content for drafts
    ├── Professional TTML letterhead styling
    ├── DRAFT watermark for non-approved letters
    ├── Proper legal formatting (Letter size, professional margins)
    └── Footer with reference number + attorney review note
    ↓
Convert HTML to PDF (html2pdf.app API)
    ├── Letter format (8.5" x 11")
    ├── Professional margins (25mm top/bottom, 20mm sides)
    └── 30-second timeout
    ↓
Upload PDF to Supabase Storage
    ├── Path: letters/{letterId}/{safe-title}.pdf
    └── Upsert enabled for regeneration
    ↓
Update Letter with PDF Path
    ├── pdf_storage_path
    └── pdf_generated_at timestamp
    ↓
Return Success Response
```

**PDF Styling Features**:

- **TTML Letterhead**: Dark navy bar + brand title + professional subtitle
- **Proper Legal Formatting**: Date, recipient block, subject line, body, closing
- **Draft Protection**: Visible watermark "DRAFT - NOT APPROVED" for unapproved letters
- **Attorney Review Badge**: "This letter has been reviewed by a licensed attorney" (approved only)
- **Reference Number**: Format `TTML-{first-8-chars-of-id}` in footer

**Integration**: Called from `/api/letters/[id]/pdf` route to generate downloadable PDFs

---

## Verification tips

- Source of truth: `supabase/migrations/*.sql` and `DATABASE_ALIGNMENT_REPORT.md`.
- Run `pnpm lint` to catch drift; `CI=1 pnpm build` may require >4GB RAM.
- **All changes must deliver: accessible and consistent UI, typed API contracts, and RLS‑protected data flows—all verified by minimal diffs and a reproducible runbook.**

## Environment Variables

- **Required variables**: See [`.env.example`](.env.example) for the complete list
- **`.env` is gitignored** — never commit secrets to the repository
- **Validation**: Run `pnpm validate-env` to verify all required variables are set
- **NO hardcoded env vars** — never hardcode environment variable values in code; always use `process.env.VAR_NAME`
