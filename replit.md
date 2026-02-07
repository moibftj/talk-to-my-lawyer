# Talk-To-My-Lawyer

## Overview
A Next.js web application that provides professional lawyer-drafted letters for various legal needs (breach of contract, demand for payment, cease and desist, etc.). Users can get letters for $50 each with attorney review and PDF download.

## Project Architecture
- **Framework**: Next.js 16.x with App Router (Turbopack in dev)
- **Language**: TypeScript
- **Package Manager**: pnpm 10.x
- **Styling**: Tailwind CSS 4.x with Radix UI components
- **Auth**: Supabase Auth (user accounts) + JWT-signed admin sessions (admin portals)
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe via Replit Connector (stripe-replit-sync for managed webhooks)
- **AI**: n8n workflow (primary, with jurisdiction research) + OpenAI direct (fallback), gpt-4o model
- **Email**: Resend (via queued template emails)
- **Rate Limiting**: Upstash Redis

## Key Configuration
- Dev server runs on port 5000 (0.0.0.0)
- `next.config.mjs` configured with `allowedDevOrigins` for Replit proxy
- Frame-ancestors set to `*` to allow Replit iframe embedding
- Standalone output mode for production deployment

## Admin Architecture (Dual Portal System)

### Admin Roles
The `profiles` table has two key fields for admin access:
- `role = 'admin'` - Marks a user as an admin
- `admin_sub_role` - Determines portal access:
  - `'super_admin'` - Full system access (analytics, users, coupons, commissions, review)
  - `'attorney_admin'` - Letter review access only

### Shared Login Endpoint
Both admin types use the same login endpoint:
- **Endpoint**: `POST /api/admin-auth/login`
- **Three-factor authentication**:
  1. `ADMIN_PORTAL_KEY` (shared portal secret)
  2. Individual email/password (Supabase Auth)
  3. `role = 'admin'` in the profiles table
- **Role-based redirect**: Login response includes `redirectUrl` based on `admin_sub_role`:
  - `super_admin` → `/secure-admin-gateway/dashboard`
  - `attorney_admin` → `/attorney-portal/review`

### Super Admin Gateway (`/secure-admin-gateway/`)
Full administrative portal with these pages:
- `/secure-admin-gateway/login` - Super admin login page
- `/secure-admin-gateway/dashboard` - Main dashboard (analytics overview)
- `/secure-admin-gateway/dashboard/analytics` - Detailed analytics
- `/secure-admin-gateway/dashboard/letters` - Letter management
- `/secure-admin-gateway/dashboard/all-letters` - All letters view
- `/secure-admin-gateway/dashboard/users` - User management
- `/secure-admin-gateway/dashboard/coupons` - Coupon management
- `/secure-admin-gateway/dashboard/commissions` - Commission tracking
- `/secure-admin-gateway/dashboard/email-queue` - Email queue management
- `/secure-admin-gateway/review` - Letter review center
- `/secure-admin-gateway/review/[id]` - Individual letter review

### Attorney Portal (`/attorney-portal/`)
Restricted portal for letter review only:
- `/attorney-portal/login` - Attorney login page
- `/attorney-portal/review` - Letter review queue (pending_review + under_review)
- `/attorney-portal/review/[id]` - Individual letter review with approve/reject actions

### Shared Review API Endpoints
Both portal types use the same API endpoints for letter actions:
- `POST /api/letters/[id]/start-review` - Mark letter as "under_review"
- `POST /api/letters/[id]/approve` - Approve letter (requires `finalContent`)
- `POST /api/letters/[id]/reject` - Reject letter (requires `rejectionReason`)
- `GET /api/letters/[id]/approve` - Get CSRF token for approve action

All review endpoints use `requireAttorneyAdminAccess()` (allows both roles).
Super admins can override status restrictions (e.g., reject an already-approved letter).

### Super Admin Only API Endpoints
- `GET/POST /api/admin/letters` - Manage all letters
- `GET/POST /api/admin/letters/batch` - Batch letter operations
- `PUT /api/admin/letters/[id]/update` - Update individual letter
- `GET /api/admin/analytics` - Analytics data
- `GET/POST /api/admin/coupons` - Coupon management
- `POST /api/admin/coupons/create` - Create new coupon
- `GET /api/admin/email-queue` - Email queue status
- `GET /api/admin/csrf` - CSRF token generation

### Access Control Functions (`lib/auth/admin-session.ts`)
- `requireAdminAuth()` - Any admin (super or attorney)
- `requireSuperAdminAuth()` - Super admin only
- `requireAttorneyAdminAccess()` - Both admin types (for letter review)
- `isSuperAdmin()` - Check if current user is super admin
- `isAttorneyAdmin()` - Check if current user is attorney admin

## Letter Generation & Review Flow

### Complete Data Flow
1. **User submits letter request** → `POST /api/generate-letter`
2. **PRIMARY: n8n workflow** (if configured):
   - n8n receives form data via webhook (header auth)
   - n8n researches state-specific statutes, disclosures, conventions (GPT-4o + Google Search)
   - n8n generates letter with jurisdiction context via GPT-4o
   - n8n updates Supabase directly (`ai_draft_content`, `status=pending_review`, `research_data`)
   - n8n returns success response with `generatedContent`, `researchApplied`, `state`
3. **FALLBACK: OpenAI direct** (if n8n unavailable/fails):
   - App generates letter directly via OpenAI (gpt-4o)
   - App updates Supabase with generated content
4. **Both admin types notified** → `notifyAdminsNewLetter()` sends emails:
   - Super admins get link to `/secure-admin-gateway/review/{id}`
   - Attorney admins get link to `/attorney-portal/review/{id}`
5. **Admin starts review** → `POST /api/letters/[id]/start-review` → Status: `under_review`
6. **Admin approves/rejects**:
   - Approve → `POST /api/letters/[id]/approve` → Status: `approved` → User notified
   - Reject → `POST /api/letters/[id]/reject` → Status: `rejected` → User notified
7. **User downloads PDF** → Available from dashboard after approval

### Letter Status Flow
`draft` → `generating` → `pending_review` → `under_review` → `approved` / `rejected`

### Key Components
- `lib/services/n8n-webhook-service.ts` - n8n webhook integration (primary generation with jurisdiction research)
- `lib/services/letter-generation-service.ts` - OpenAI direct letter generation (fallback)
- `lib/services/notification-service.ts` - All email notifications (admin alerts, user updates)
- `lib/api/admin-action-handler.ts` - Consolidated approve/reject logic with CSRF + audit trail
- `lib/admin/letter-actions.ts` - Shared admin utilities (status updates, sanitization, admin queries)
- `components/attorney-review-modal.tsx` - Review UI component for approve/reject actions

## Required Environment Variables
### Critical (needed for basic dev)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### n8n Integration (Primary Letter Generation)
- `N8N_WEBHOOK_URL` - n8n webhook URL for letter generation (e.g., https://your-n8n.app/webhook/generate-letter)
- `N8N_WEBHOOK_AUTH_KEY` - Header auth key for n8n webhook authentication
- `N8N_EVENTS_WEBHOOK_URL` - (Optional) n8n webhook for monitoring/alerting events

### Production
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- Stripe keys are auto-managed by Replit Connector (no env vars needed)
- `STRIPE_SECRET_KEY` - Stripe secret key (fallback, optional if Connector configured)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (optional, managed webhooks handle this)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (auto-set by Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (auto-set by Replit AI Integrations)
- `OPENAI_API_KEY` - OpenAI API key (fallback, optional if AI Integrations configured)
- `RESEND_API_KEY` - Resend email API key
- `ADMIN_EMAIL` - Admin email
- `ADMIN_PORTAL_KEY` - Admin portal access key (shared 3rd auth factor)
- `CRON_SECRET` - Cron job auth secret

## Project Structure
- `app/` - Next.js App Router pages and API routes
- `app/api/` - Backend API endpoints (auth, stripe, letters, admin, etc.)
- `app/api/admin/` - Super admin only API endpoints
- `app/api/admin-auth/` - Shared admin authentication (login/logout)
- `app/api/letters/[id]/` - Letter action endpoints (approve, reject, start-review, submit)
- `app/api/generate-letter/` - AI letter generation endpoint
- `app/api/stripe/webhook/` - Stripe payment webhook
- `app/dashboard/` - User dashboard pages
- `app/secure-admin-gateway/` - Super admin portal (full access)
- `app/attorney-portal/` - Attorney admin portal (review only)
- `app/auth/` - Authentication pages (login, signup, etc.)
- `components/` - Reusable UI components
- `lib/` - Utility libraries and helpers
- `lib/auth/` - Authentication (user + admin session management)
- `lib/admin/` - Admin utilities (letter actions, sanitization)
- `lib/api/` - API handler utilities (admin action handler, error handling)
- `lib/ai/` - OpenAI client and retry logic
- `lib/stripe/` - Stripe client (Replit Connector + fallback)
- `lib/services/` - Business logic services (notification, letter generation)
- `lib/email/` - Email templates and queue
- `lib/security/` - CSRF, JWT, input sanitization, webhook signatures
- `scripts/` - Build/deploy/migration scripts
- `public/` - Static assets

### Letter Assignment Flow
`pending_review` → (Super Admin assigns via dropdown) → `assigned_to` set → Attorney sees in "Assigned to You" section → Attorney starts review → `under_review` → approve/reject

### Admin Account Management
- Super admins create attorney/admin accounts via `/secure-admin-gateway/dashboard/users`
- API: `POST /api/admin/users/create` (service role, creates Supabase Auth user + profile upsert)
- API: `GET /api/admin/attorneys` (list all admins for assignment dropdowns)

### Letter Assignment API
- `POST /api/admin/letters/[id]/assign` - Assign/unassign letter to attorney (super admin only)
- `GET /api/admin/check-schema` - Check if assignment columns exist in database
- Migration: `scripts/add-assignment-columns.sql` (run manually in Supabase SQL Editor)

### Components
- `components/admin/create-admin-form.tsx` - Client form for creating admin accounts
- `components/admin/letter-assign-dropdown.tsx` - Client dropdown for assigning letters to attorneys

## Recent Changes
- 2026-02-07: Aligned app with n8n letter generation workflow - n8n is now primary (with jurisdiction research), OpenAI is fallback
- 2026-02-07: Updated n8n webhook service with auth header support (N8N_WEBHOOK_AUTH_KEY) and structured response types
- 2026-02-07: Updated generate-letter route to try n8n first, fall back to OpenAI if n8n unavailable/fails
- 2026-02-07: n8n handles Supabase update directly (ai_draft_content, status, research_data) - app skips duplicate update
- 2026-02-07: Added research_data JSONB column migration for jurisdiction-specific legal research data
- 2026-02-07: Updated all integration tests and webhook service tests for n8n-primary architecture
- 2026-02-07: Removed all Zapier integration code and references
- 2026-02-07: Built admin account creation tool (API + UI) - super admins can create attorney accounts from dashboard
- 2026-02-07: Built letter assignment system - super admins can assign letters to specific attorneys via dropdown
- 2026-02-07: Improved attorney portal - shows assigned letters first, then unassigned, then others' letters
- 2026-02-07: Added assignment notification service (`notifyAttorneyLetterAssigned`)
- 2026-02-07: Added migration script for `assigned_to`/`assigned_at` columns on letters table
- 2026-02-07: Added schema check endpoint and graceful fallback when assignment columns don't exist
- 2026-02-07: UI touchup - added subtle animations: button press feedback, card hover lift, nav underline slide, input focus glow, scroll-reveal fade-ins, status badge shimmer, primary CTA glow pulse, pricing card hover highlight, auth card entrance animation, footer link hover effects. All with prefers-reduced-motion accessibility support.
- 2026-02-07: Created ScrollReveal component (Intersection Observer-based fade-in-on-scroll)
- 2026-02-07: Fixed admin notifications to send role-appropriate portal links (super admin vs attorney)
- 2026-02-07: Added `getAdminEmailsWithRoles()` for role-based notification routing
- 2026-02-07: Comprehensive documentation update (dual portal architecture, data flow, endpoints)
- 2026-02-07: Integrated Stripe via Replit Connector (managed webhooks, auto credentials)
- 2026-02-07: Added stripe-replit-sync for webhook management and Stripe data sync
- 2026-02-07: Supabase credentials configured (URL, anon key, service role key)
- 2026-02-06: Integrated Replit AI Integrations for OpenAI (auto-managed API key, gpt-4o model)
- 2026-02-06: Updated OpenAI client with AI integrations priority + backward compat fallback
- 2026-02-06: Fixed TypeScript type errors in letter generation endpoint
- 2026-02-06: Verified notification flow: generation → admin notify → review → approve/reject → user notify
- 2026-02-06: Configured for Replit environment (port 5000, proxy support, iframe embedding)
