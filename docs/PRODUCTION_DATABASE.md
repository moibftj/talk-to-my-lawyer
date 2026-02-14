# Production Database Configuration

## Supabase Production Database

**⚠️ IMPORTANT**: This is the official production database for Talk-to-My-Lawyer.

### Database Details
- **Project Name**: New
- **Project ID**: `nomiiqzxaxyxnxndvkbe`
- **Project Ref**: `nomiiqzxaxyxnxndvkbe`
- **Region**: us-east-2 (Ohio)
- **Status**: ✅ ACTIVE_HEALTHY
- **Database Host**: `db.nomiiqzxaxyxnxndvkbe.supabase.co`
- **PostgreSQL Version**: 17.6.1.054
- **Organization ID**: `spskjtwigpjcouihqqel`
- **Created**: Nov 25, 2025

---

## Environment Variables

### Required for Next.js Application
```env
NEXT_PUBLIC_SUPABASE_URL=https://nomiiqzxaxyxnxndvkbe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

### Required for N8N Workflow
The N8N workflow uses Supabase nodes that require:
- **Supabase URL**: `https://nomiiqzxaxyxnxndvkbe.supabase.co`
- **Supabase Service Role Key**: `<service_role_key>` (for bypassing RLS in workflow)

---

## Database Schema

### Core Tables
- `profiles` - User profiles (subscriber, employee, attorney_admin, super_admin)
- `letters` - Legal letter records with AI drafts and admin review data
- `subscriptions` - Stripe subscription data
- `letter_allowances` - Monthly letter allowance tracking
- `employee_coupons` - Employee referral coupons
- `commissions` - Employee commission tracking
- `audit_logs` - System audit trail
- `email_queue` - Outbound email queue
- `payout_requests` - Attorney payout requests

### Letters Table Schema (Latest)
Key columns for N8N workflow integration:
- `id` (UUID) - Primary key
- `user_id` (UUID) - References profiles
- `title` (TEXT) - Letter title
- `status` (letter_status) - draft, generating, pending_review, under_review, approved, rejected, needs_changes, failed
- `letter_type` (TEXT) - Type of letter (Demand Letter, Cease & Desist, etc.)
- `intake_data` (JSONB) - Form data from user
- `ai_draft_content` (TEXT) - AI-generated letter content
- `subject` (TEXT) - Letter subject line (from N8N workflow)
- `statutes_cited` (JSONB) - Array of statutes cited (from jurisdiction research)
- `legal_basis` (TEXT) - Summary of legal basis
- `next_steps` (TEXT) - Recommended next steps
- `delivery_instructions` (TEXT) - Delivery method based on jurisdiction
- `generated_at` (TIMESTAMPTZ) - When AI generation completed
- `generation_metadata` (JSONB) - Metadata from generation (model, source, etc.)
- `generation_error` (TEXT) - Error message if generation failed
- `final_content` (TEXT) - Attorney-approved final content
- `pdf_url` (TEXT) - URL to generated PDF
- `is_attorney_reviewed` (BOOLEAN) - Whether reviewed by attorney
- `reviewed_by` (UUID) - Attorney who reviewed
- `reviewed_at` (TIMESTAMPTZ) - Review timestamp
- `review_notes` (TEXT) - Attorney review notes
- `rejection_reason` (TEXT) - Reason for rejection
- `approved_at` (TIMESTAMPTZ) - Approval timestamp
- `created_at` (TIMESTAMPTZ) - Record creation
- `updated_at` (TIMESTAMPTZ) - Last update

---

## Migrations

All migrations are in `/supabase/migrations/` and should be applied in order.

Latest critical migrations:
- `20260203000026_add_letter_generation_fields.sql` - Adds `generated_at`, `generation_metadata`, `generation_error`
- `20260214_add_n8n_workflow_columns.sql` - Adds `subject`, `statutes_cited`, `legal_basis`, `next_steps`, `delivery_instructions`

### Applying Migrations
```bash
# Via pnpm script (requires Supabase CLI configured)
pnpm db:migrate

# Or manually via Supabase SQL Editor
# Copy the SQL from the migration file and run it in the SQL Editor
```

---

## N8N Workflow Integration

### Workflow ID
`fRWD4L9r7WH4m81HlAkhV` - AI-Powered Legal Letter Generation with Jurisdiction Research

### Supabase Update Nodes
1. **Update Letter Status to Generating**
   - Updates `status` to `generating`
   - Updates `updated_at`

2. **Save Generated Letter**
   - Updates `status` to `pending_review`
   - Saves `ai_draft_content` (full letter text)
   - Saves `subject` (letter subject line)
   - Saves `statutes_cited` (array of statutes from research)
   - Saves `legal_basis` (summary of legal basis)
   - Saves `next_steps` (recommended actions)
   - Saves `delivery_instructions` (jurisdiction-specific delivery method)
   - Sets `generated_at` (timestamp)
   - Updates `updated_at`

---

## Security

### Row Level Security (RLS)
All tables have RLS enabled with role-based policies:
- **Subscribers**: Can only access their own letters
- **Employees**: Can view commissions and manage coupons
- **Attorney Admins**: Can review and approve letters
- **Super Admins**: Full access to all data

### Service Role Key Usage
The service role key bypasses RLS and should **only** be used:
- In N8N workflow for automated letter updates
- In server-side API routes for admin operations
- Never exposed to the client

---

## Backup & Recovery

- **Automatic Backups**: Enabled (Supabase default)
- **Point-in-Time Recovery**: Available for up to 7 days
- **Manual Backups**: Can be triggered via Supabase dashboard

---

## Monitoring

### Key Metrics to Monitor
- Database size and growth rate
- Query performance (slow queries)
- Connection pool usage
- RLS policy performance
- Failed letter generation attempts (check `generation_error` column)

### Alerts
Set up alerts for:
- Database reaching 80% capacity
- High number of failed letter generations
- Unusual spike in letter creation rate (potential abuse)

---

## Contact

For database access or issues:
- Supabase Dashboard: https://supabase.com/dashboard/project/nomiiqzxaxyxnxndvkbe
- Support: support@talk-to-my-lawyer.com
