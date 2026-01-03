# Architecture & Development Guide

Complete architectural overview and development guidelines for Talk-To-My-Lawyer platform.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Non-Negotiable Rules](#non-negotiable-rules)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Domain Model](#domain-model)
6. [Core Workflows](#core-workflows)
7. [Development Guidelines](#development-guidelines)
8. [Testing Guidelines](#testing-guidelines)

---

## System Overview

Talk-To-My-Lawyer is an AI-powered legal letter generation platform with mandatory attorney review. It follows a SaaS model with subscription-based pricing and employee referral functionality.

### Key Features

- **AI Letter Generation**: OpenAI GPT-4 Turbo via Vercel AI SDK
- **Attorney Review Workflow**: Multi-admin letter approval system
- **Subscription Management**: Monthly/Yearly plans with credit system
- **Employee Referrals**: 5% commission system with payout requests
- **Production Email System**: Professional templates via Resend
- **Security & Rate Limiting**: Upstash Redis protection
- **Admin Analytics**: Revenue, user, and performance dashboards

### Live Production

- **Site**: https://www.talk-to-my-lawyer.com
- **Admin Portal**: https://www.talk-to-my-lawyer.com/secure-admin-gateway
- **Status**: ✅ LIVE with real payment processing

---

## Non-Negotiable Rules

1. **Use pnpm exclusively** - `packageManager=pnpm@10.27.0`, never add npm/yarn lockfiles
2. **Always run linting and build** - `pnpm lint` and `CI=1 pnpm build` before delivery
3. **Only subscribers can generate letters** - Employees and admins must never access letter generation APIs
4. **Admin review is mandatory** - No "raw AI" letters reach subscribers; every letter requires approval
5. **Employees never see letter content** - They only see coupon stats and commissions
6. **Respect RLS** - Never disable Row Level Security; all DB access respects role scoping
7. **Do not leak secrets** - Never log env var values; refer to names like `OPENAI_API_KEY` only
8. **Keep Supabase auth helpers** in request path when touching API routes
9. **Use shared API error handling** helpers in `lib/api/api-error-handler.ts`
10. **Prefer functional React components** - Add `'use client'` only when needed

---

## Tech Stack

### Core Technologies

- **Framework**: Next.js 16 (App Router) with React 19 and TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **Payments**: Stripe integration
- **AI**: Vercel AI SDK (`ai`, `@ai-sdk/openai`), model default `gpt-4-turbo`
- **Email**: Resend (primary), with Brevo, SendGrid, SMTP fallback
- **Rate Limiting**: Upstash Redis (`@upstash/redis`, `@upstash/ratelimit`)
- **Package Manager**: pnpm

### Runtime Boundaries

- Server components by default; use `'use client'` for interactive components
- API routes are Node runtime (`export const runtime = 'nodejs'` where needed)
- Supabase client usage:
  - `lib/supabase/client.ts` for browser/client components
  - `lib/supabase/server.ts` for server/API routes
- Admin sessions are cookie-based and validated in `lib/auth/admin-session.ts`

---

## Architecture

### Directory Structure

```
talk-to-my-lawyer/
├── app/                        # Next.js App Router
│   ├── api/                    # API route handlers
│   │   ├── admin/              # Admin-only endpoints
│   │   ├── auth/               # Authentication endpoints
│   │   ├── letters/            # Letter CRUD operations
│   │   ├── subscriptions/      # Subscription management
│   │   ├── employee/           # Employee functionality
│   │   └── stripe/             # Stripe webhooks
│   ├── auth/                   # Auth pages (login, signup, reset)
│   ├── dashboard/              # Subscriber/employee dashboard
│   └── secure-admin-gateway/   # Admin portal
├── components/                 # Reusable React components
│   ├── admin/                  # Admin-specific components
│   └── ui/                     # shadcn/ui primitives
├── lib/                        # Server utilities and domain logic
│   ├── ai/                     # AI service integrations
│   ├── auth/                   # Auth guards and helpers
│   ├── email/                  # Email service providers
│   ├── security/               # Security and validation
│   ├── supabase/               # Supabase client configs
│   └── validation/             # Input validation schemas
├── scripts/                    # Database migration scripts (SQL)
├── supabase/                   # Supabase-specific migrations
├── docs/                       # Documentation
└── types/                      # Shared TypeScript types
```

### API Route Structure

All routes under `app/api/` follow this pattern:

```typescript
import { createClient } from "@/lib/supabase/server"
import { safeApplyRateLimit, letterGenerationRateLimit } from '@/lib/rate-limit-redis'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'

export async function POST(request: NextRequest) {
  // 1. Rate limit
  const rateLimitResponse = await safeApplyRateLimit(request, letterGenerationRateLimit, 5, "1 h")
  if (rateLimitResponse) return rateLimitResponse

  // 2. Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return errorResponses.unauthorized()

  // 3. Role check via profiles table
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "subscriber") return errorResponses.forbidden("Only subscribers can...")

  // 4. Business logic...
  return successResponse(data)
}
```

### Admin Routes

Use `requireAdminAuth()` from `lib/auth/admin-guard.ts`:

```typescript
import { requireAdminAuth } from '@/lib/auth/admin-guard'

const authError = await requireAdminAuth()
if (authError) return authError
```

---

## Domain Model

### User Roles

```typescript
export type UserRole = 'subscriber' | 'employee' | 'admin'

export type AdminSubRole = 'system_admin' | 'attorney_admin'
```

**Role Hierarchy:**
- `subscriber` - Generate letters, view own letters, manage subscription
- `employee` - Coupon code (20% off), commission tracking (5%), never sees letters
- `admin` - Two sub-roles:
  - `system_admin` - Full access: Analytics, all users, all letters, coupons, commissions
  - `attorney_admin` - Limited: Letter review center, profile settings only

### Letter Status Lifecycle

```typescript
export type LetterStatus =
  | 'draft'          // Initial state - user is filling form
  | 'generating'     // AI is generating content
  | 'pending_review' // Waiting for attorney review
  | 'under_review'   // Attorney has started review
  | 'approved'       // Attorney approved the letter
  | 'completed'      // Letter delivered to user
  | 'rejected'       // Attorney rejected the letter
  | 'failed'         // Generation failed
```

**State Transitions:**
```
Draft → Generating → Pending Review → Under Review → Approved → Completed
                                                    ↘ Rejected → Resubmit
                    ↘ Failed
```

### Core Entities

**Profile:**
```typescript
interface Profile {
  id: string                    // UUID - FK to auth.users
  email: string
  full_name: string | null
  role: UserRole
  admin_sub_role: AdminSubRole | null  // For admin role separation
  phone: string | null
  company_name: string | null
  total_letters_generated: number
  created_at: string
  updated_at: string
}
```

**Letter:**
```typescript
interface Letter {
  id: string
  user_id: string
  title: string
  letter_type: string
  status: LetterStatus
  intake_data: Record<string, any>    // Form data from user
  ai_draft_content: string | null     // AI-generated draft
  final_content: string | null        // Attorney-approved content
  reviewed_by: string | null          // Admin who reviewed
  review_notes: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}
```

**Subscription:**
```typescript
interface Subscription {
  id: string
  user_id: string
  plan_type: string              // single, monthly, yearly
  status: SubscriptionStatus
  price: number
  discount: number
  coupon_code: string | null
  employee_id: string | null
  credits_remaining: number      // Letters remaining
  current_period_start: string
  current_period_end: string
  stripe_customer_id: string | null
  created_at: string
}
```

### Database RPC Functions

Key PostgreSQL functions:

**Letter Allowance:**
- `check_letter_allowance(u_id)` - Returns `{has_allowance, remaining, plan_type, is_active}`
- `deduct_letter_allowance(u_id)` - Atomic credit deduction, returns boolean
- `add_letter_allowances(u_id, amount)` - Add credits

**Audit:**
- `log_letter_audit(letter_id, action, old_status, new_status, notes)`
- `increment_total_letters(user_id)`

**Admin:**
- `is_system_admin()` - Check if user is system admin
- `is_attorney_admin()` - Check if user is attorney admin
- `get_admin_dashboard_stats()` - Comprehensive stats for System Admin

**Employee:**
- `get_employee_coupon(employee_id)` - Get coupon for employee
- `get_commission_summary(emp_id)` - Commission totals

---

## Core Workflows

### 1. User Registration Flow

```
User → /auth/signup
    ↓
Supabase Auth signup
    ↓
Database Trigger: handle_new_user()
    ↓
Creates Profile Record (role: 'subscriber')
    ↓
Redirect to /dashboard
```

### 2. Letter Generation Flow

```
User fills form → POST /api/generate-letter
    ↓
Rate Limit Check (5/hour)
    ↓
Auth Check (subscriber role required)
    ↓
Allowance Check (free trial or active subscription)
    ↓
Input Validation (letter type, intake data)
    ↓
Deduct Allowance (BEFORE AI - prevents race condition)
    ↓
Create Letter Record (status: 'generating')
    ↓
AI Generation (OpenAI GPT-4 Turbo)
    ├─ Success → status: 'pending_review'
    ├─ Failure → status: 'failed' + refund allowance
    └─ Update: ai_draft_content, increment_total_letters
    ↓
Return {letterId, status, aiDraft}
```

### 3. Attorney Review Flow

```
Admin logs in → /secure-admin-gateway/login
    (requires email + password + ADMIN_PORTAL_KEY)
    ↓
/secure-admin-gateway/review (Review Center)
    ↓
Lists letters with status: 'pending_review'
    ↓
POST /api/letters/[id]/start-review
    ↓
Status: 'under_review'
    ↓
Admin actions:
├─ Approve → POST /api/letters/[id]/approve
│    ├─ Update: status='approved', final_content, reviewed_by
│    ├─ Log audit trail
│    └─ Send email: letter-approved
├─ Reject → POST /api/letters/[id]/reject
│    ├─ Update: status='rejected', rejection_reason
│    ├─ Log audit trail
│    └─ Send email: letter-rejected
└─ Improve → POST /api/letters/[id]/improve
     └─ Generate new AI content with improvements
```

### 4. Subscription & Payment Flow

```
User selects plan → POST /api/create-checkout
    ↓
Rate Limit (3/hour)
    ↓
Validate plan selection
    ↓
Check coupon (if provided)
    ├─ Validate via employee_coupons table
    ├─ Apply discount_percent
    └─ Log fraud detection data
    ↓
Test Mode?
├─ Yes → Create subscription directly, skip Stripe
└─ No → Create Stripe Checkout session
    ↓
Redirect to Stripe Checkout
    ↓
User completes payment
    ↓
POST /api/stripe/webhook (checkout.session.completed)
    ↓
Create Subscription Record
    ├─ Set credits_remaining
    ├─ Set status: 'active'
    └─ If coupon used → Create Commission Record
    ↓
Send email: subscription-confirmation
    ↓
Redirect to /dashboard?payment=success
```

### 5. Employee Referral Flow

```
Employee → /dashboard/coupons
    ↓
View auto-generated coupon code
    (Created via trigger on role = 'employee')
    ↓
Share coupon code with customers
    ↓
Customer uses coupon at checkout
    ↓
Coupon validated during checkout
    ↓
Discount applied to subscription
    ↓
Commission record created (5% rate, status: 'pending')
    ↓
Employee views commissions → /dashboard/commissions
    ↓
Request payout → POST /api/employee/payouts
    ↓
Admin processes payout
    ↓
Commission status updated to 'paid'
```

---

## Development Guidelines

### Component Conventions

- **Functional React components** with hooks
- **`'use client'` directive** only when interactive
- **shadcn/ui primitives** in `components/ui/`
- **Tailwind for styling** - use existing design tokens from `lib/design-tokens.ts`

### API Error Handling

Use helpers from `lib/api/api-error-handler.ts`:

```typescript
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'

// Success responses
return successResponse(data, 200)

// Error responses
return errorResponses.unauthorized()
return errorResponses.forbidden("Custom message")
return errorResponses.validation("Invalid input", errors)
return errorResponses.notFound()

// In catch blocks
try {
  // ... logic
} catch (error) {
  return handleApiError(error, "ContextName")
}
```

### Rate Limiting

Predefined limiters in `lib/rate-limit-redis.ts`:

```typescript
import { safeApplyRateLimit, authRateLimit, apiRateLimit, letterGenerationRateLimit } from '@/lib/rate-limit-redis'

// Apply rate limit
const rateLimitResponse = await safeApplyRateLimit(
  request,
  letterGenerationRateLimit,
  5,      // fallback limit
  "1 h"   // fallback window
)
if (rateLimitResponse) return rateLimitResponse
```

**Available Limiters:**
- `authRateLimit` - 5/15min
- `apiRateLimit` - 100/1min
- `adminRateLimit` - 10/15min
- `letterGenerationRateLimit` - 5/1hr
- `subscriptionRateLimit` - 3/1hr

### Input Validation

Use schema-based validation from `lib/validation/letter-schema.ts`:

```typescript
import { validateLetterGenerationRequest } from '@/lib/validation/letter-schema'

const validation = validateLetterGenerationRequest(letterType, intakeData)
if (!validation.valid) {
  return errorResponses.validation("Invalid input", validation.errors)
}
```

### Email Sending

Provider-agnostic email service:

```typescript
import { sendTemplateEmail } from '@/lib/email/service'

await sendTemplateEmail(
  'letter-approved',
  userEmail,
  { letterTitle, finalContent, downloadUrl }
)
```

### Security Best Practices

1. **Never expose sensitive env vars** - Use `process.env.VAR_NAME` server-side only
2. **Always validate user input** - Use Zod schemas and sanitizers
3. **Check user roles** - Verify via profiles table, not just auth
4. **Log security events** - Use audit trail and admin_audit_log tables
5. **Rate limit everything** - Especially auth, payment, and generation endpoints
6. **Use CSRF protection** - For admin actions via `lib/security/csrf.ts`

---

## Testing Guidelines

### Manual Testing (No Automated Tests)

The project uses manual testing. Follow these guidelines:

#### Authentication Flow
- Test user registration and login
- Verify password reset functionality
- Test role-based access control
- Validate session management

#### Admin Access
- Test admin login with multiple admin accounts
- Verify each admin can access `/secure-admin-gateway`
- Test admin actions (approve, reject, review letters)

#### Letter Generation
- Test each letter type with various inputs
- Verify AI generation via Vercel AI Gateway
- Test attorney review process
- Verify PDF generation and download

#### Payment Processing
- Test subscription creation with Stripe test cards
- Verify subscription upgrades/downgrades
- Test payment failure scenarios
- Verify webhooks handling

#### Email Services
- Test email delivery with configured provider
- Verify email templates and formatting
- Test fallback to console provider in development

### Test Data Management

- Use test email addresses: `test+{type}@example.com`
- Stripe test cards: https://stripe.com/docs/testing
- Use Supabase local development for isolated testing

### Key Test Scenarios

**Edge Cases:**
- Network failures during AI generation
- Payment processing interruptions
- Email service outages
- Database constraint violations

**Security Testing:**
- Input validation and sanitization
- Rate limiting effectiveness
- Authentication bypass attempts
- SQL injection prevention

---

## Agent Workflow (AI Assistants)

This section is for AI coding assistants working on this repository.

### Core Subsystems

- **UI and dashboards**: App Router pages in `app/*`
- **API layer**: Route handlers in `app/api/*`
- **Auth and sessions**: Supabase Auth plus admin session cookies
- **Letter lifecycle**: Draft generation, review, approval, delivery
- **Billing**: Stripe Checkout, webhooks, subscription allowances
- **Email**: Provider-agnostic service with queueing
- **Admin portal**: Secure gateway with portal key and role checks
- **Rate limiting**: Upstash with in-memory fallback
- **PDF generation**: Server-side PDF generation for letters

### Before Making Changes

1. **Understand the issue** fully before coding
2. **Explore repository** and related files
3. **Run existing checks**:
   ```bash
   pnpm lint
   CI=1 pnpm build
   pnpm validate-env
   ```
4. **Check for similar patterns** in existing code
5. **Respect non-negotiables** listed above

### Making Changes

1. **Make minimal modifications** - surgical, precise changes only
2. **Follow existing patterns** - API routes, error handling, validation
3. **Test your changes** - manually verify functionality
4. **Run validation**:
   ```bash
   pnpm lint
   CI=1 pnpm build
   ```
5. **Document if needed** - update README or docs if adding features

### Common Tasks

**Adding a new API route:**
1. Follow structure in existing routes (see API Route Structure above)
2. Include rate limiting, auth check, role check
3. Use error handling helpers
4. Add to API Routes list in documentation

**Adding a new database function:**
1. Create SQL file in `scripts/` with proper numbering
2. Test locally via psql
3. Document in this guide under Database RPC Functions
4. Run migration: `pnpm db:migrate`

**Adding a new feature:**
1. Check if similar feature exists
2. Follow domain model patterns
3. Add validation schema if needed
4. Add email template if needed
5. Update relevant documentation

---

## Additional Resources

- **Production Runbook**: `docs/DEPLOYMENT_GUIDE.md`
- **API & Integrations**: `docs/API_AND_INTEGRATIONS.md`
- **Setup Guide**: `docs/SETUP_AND_CONFIGURATION.md`
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
