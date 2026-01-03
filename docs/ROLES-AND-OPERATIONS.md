# Talk-To-My-Lawyer: User Roles & Technical Operations

> Last Updated: January 3, 2026

## Overview

This platform has **3 main roles** with distinct permissions and access levels. All access is enforced via Row Level Security (RLS) in Supabase.

**Role Types** (from `lib/database.types.ts`):
```typescript
type UserRole = 'subscriber' | 'employee' | 'admin'
type AdminSubRole = 'super_admin' | 'attorney_admin'
```

---

## 1. Subscriber (`role = 'subscriber'`)

The primary paying user who generates legal letters.

### Permissions

| Operation | API Endpoint | UI Location |
|-----------|--------------|-------------|
| Generate AI letter drafts | `POST /api/generate-letter` | `/dashboard/letters/new` |
| View own letters | `GET /api/letters/drafts` | `/dashboard/letters` |
| View letter details | N/A (client-side) | `/dashboard/letters/[id]` |
| Submit letter for review | `POST /api/letters/[id]/submit` | Letter detail page |
| Resubmit rejected letters | `POST /api/letters/[id]/resubmit` | Letter detail page |
| Request AI improvements | `POST /api/letters/[id]/improve` | Letter detail page |
| Download approved PDFs | `GET /api/letters/[id]/pdf` | Letter detail page |
| Delete draft letters | `DELETE /api/letters/[id]/delete` | Letter detail page |
| Manage subscription | Various `/api/subscriptions/*` | `/dashboard/subscription` |
| Check letter allowance | `GET /api/subscriptions/check-allowance` | Dashboard header |
| View billing history | `GET /api/subscriptions/billing-history` | `/dashboard/billing` |
| Export personal data (GDPR) | `POST /api/gdpr/export-data` | `/dashboard/settings` |
| Delete account (GDPR) | `POST /api/gdpr/delete-account` | `/dashboard/settings` |
| Accept privacy policy | `POST /api/gdpr/accept-privacy-policy` | Settings |
| Reset password | `POST /api/auth/reset-password` | `/auth/forgot-password` |
| Update password | `POST /api/auth/update-password` | Settings |

### Restrictions

- Limited by `check_letter_allowance()` based on subscription tier
- Can only view/edit **own** letters (RLS enforced)
- Cannot access admin portal or employee features

### Letter Status Flow (from `lib/database.types.ts`)

```
LetterStatus = 'draft' | 'generating' | 'pending_review' | 'under_review' 
             | 'approved' | 'completed' | 'rejected' | 'failed'

Flow:
draft → generating → pending_review → under_review → approved/rejected
                                                          ↓
                                                     completed (downloadable)
```

---

## 2. Employee (`role = 'employee'`)

Referral partner who earns commissions. **Never sees letter content.**

### Permissions

| Operation | API Endpoint | UI Location |
|-----------|--------------|-------------|
| Get unique referral link | `GET /api/employee/referral-link` | `/dashboard/referrals` |
| View commission stats | N/A (client-side) | `/dashboard/commissions` |
| View coupon usage stats | N/A (client-side) | `/dashboard/coupons` |
| Request payouts | `POST /api/employee/payouts` | `/dashboard/payouts` |
| View payout history | `GET /api/employee/payouts` | `/dashboard/payouts` |
| Update profile settings | N/A | `/dashboard/employee-settings` |

### Restrictions

- **Cannot access** `/api/generate-letter`
- **Cannot access** any `/api/letters/*` endpoints
- **Cannot see** letter content, titles, or details
- Only sees aggregate statistics (count of signups, total commissions)

### Commission Structure

- **20% discount** for referred subscribers (via coupon code)
- **5% commission** on referred subscriber payments

### Employee Coupon System

Employees receive a unique coupon code stored in `employee_coupons` table. The referral link format:
- Homepage: `{APP_URL}?ref={COUPON_CODE}`
- Signup: `{APP_URL}/auth/signup?coupon={COUPON_CODE}`

---

## 3. Admin (`role = 'admin'`)

Platform administrators with two sub-roles defined by `admin_sub_role`.

### 3a. Super Admin (`admin_sub_role = 'super_admin'`)

Full platform access and management capabilities.

**Auth Guard**: `requireSuperAdminAuth()` from `lib/auth/admin-session.ts`

| Operation | API Endpoint | UI Location |
|-----------|--------------|-------------|
| View platform analytics | `GET /api/admin/analytics` | `/secure-admin-gateway/dashboard/analytics` |
| Manage all users | N/A (client-side) | `/secure-admin-gateway/dashboard/users` |
| View all letters | `GET /api/admin/letters` | `/secure-admin-gateway/dashboard/all-letters` |
| Create coupons | `POST /api/admin/coupons/create` | `/secure-admin-gateway/dashboard/coupons` |
| Manage coupons | `GET/PUT /api/admin/coupons` | `/secure-admin-gateway/dashboard/coupons` |
| Manage commissions | N/A | `/secure-admin-gateway/dashboard/commissions` |
| Review letters | `POST /api/letters/[id]/approve\|reject` | `/secure-admin-gateway/review/[id]` |
| Batch letter operations | `POST /api/admin/letters/batch` | All letters page |
| View email queue | `GET /api/admin/email-queue` | `/secure-admin-gateway/dashboard/email-queue` |
| CSRF token management | `GET /api/admin/csrf` | Internal |

### 3b. Attorney Admin (`admin_sub_role = 'attorney_admin'`)

Limited to letter review only.

**Auth Guard**: `requireAttorneyAdminAccess()` from `lib/auth/admin-session.ts`

| Operation | API Endpoint | UI Location |
|-----------|--------------|-------------|
| View pending letters | `GET /api/admin/letters` | `/secure-admin-gateway/dashboard/letters` |
| Start letter review | `POST /api/letters/[id]/start-review` | Review page |
| Approve letters | `POST /api/letters/[id]/approve` | `/secure-admin-gateway/review/[id]` |
| Reject letters | `POST /api/letters/[id]/reject` | `/secure-admin-gateway/review/[id]` |
| Mark as completed | `POST /api/letters/[id]/complete` | Review page |
| Send letter via email | `POST /api/letters/[id]/send-email` | Review page |
| View letter audit trail | `GET /api/letters/[id]/audit` | Review page |
| View own profile | N/A | `/secure-admin-gateway/dashboard` |

### Restrictions (Attorney Admin Only)

- **Cannot access** analytics dashboard (`requireSuperAdminAuth` blocks)
- **Cannot access** user management
- **Cannot access** coupon management
- **Cannot access** commission management
- **Cannot access** email queue

---

## Authentication Requirements

| Role | Login Path | Authentication Method |
|------|------------|----------------------|
| Subscriber | `/auth/login` | Email + Password (Supabase Auth) |
| Employee | `/auth/login` | Email + Password (Supabase Auth) |
| Admin (all) | `/secure-admin-gateway/login` | Email + Password (individual admin accounts) |

### Admin Authentication Flow

From `lib/auth/admin-session.ts`:

1. Admin submits email + password to `/api/admin-auth/login`
2. `verifyAdminCredentials()` authenticates with Supabase Auth
3. Verifies `profiles.role = 'admin'` in database
4. Creates secure HTTP-only cookie session (`admin_session`)
5. Session timeout: **30 minutes** of inactivity

```typescript
const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
```

**Note**: The `ADMIN_PORTAL_KEY` mentioned in copilot-instructions is used at the UI level for additional portal access control, not in the core auth flow.

---

## Database Role Checks

### SQL Helper Functions

```sql
-- Check if current user is super admin
is_super_admin()
-- Returns: true if role='admin' AND admin_sub_role='super_admin'

-- Check if current user is attorney admin
is_attorney_admin()
-- Returns: true if role='admin' AND admin_sub_role='attorney_admin'

-- Get dashboard stats (super admin only)
get_admin_dashboard_stats()
-- Returns: Comprehensive platform statistics
```

### TypeScript Helper Functions (from `lib/auth/admin-session.ts`)

```typescript
// Check auth status
isAdminAuthenticated(): Promise<boolean>
isSuperAdmin(): Promise<boolean>
isAttorneyAdmin(): Promise<boolean>

// API route guards
requireAdminAuth(): Promise<NextResponse | undefined>      // Any admin
requireSuperAdminAuth(): Promise<NextResponse | undefined> // Super admin only
requireAttorneyAdminAccess(): Promise<NextResponse | undefined> // Both admin types

// Session management
getCurrentAdminSubRole(): Promise<AdminSubRole | null>
getAdminSubRole(userId: string): Promise<AdminSubRole | null>
```

### Profile Schema (from `lib/database.types.ts`)

```typescript
interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'subscriber' | 'employee' | 'admin'
  admin_sub_role: 'super_admin' | 'attorney_admin' | null
  phone: string | null
  company_name: string | null
  free_trial_used: boolean
  stripe_customer_id: string | null
  total_letters_generated: number
  is_licensed_attorney: boolean
  created_at: string
  updated_at: string
}
```

---

## Creating Admin Users

Admins are **never** created through normal signup flow.

### Method 1: CLI Script (Recommended)

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password>
```

### Method 2: Promote Existing User

```sql
UPDATE profiles
SET role = 'admin', admin_sub_role = 'super_admin'
WHERE email = 'user@example.com';
```

---

## API Rate Limits (from `lib/rate-limit-redis.ts`)

| Limiter | Requests | Window | Applied To |
|---------|----------|--------|------------|
| `authRateLimit` | 5 | 15 min | Login/signup |
| `apiRateLimit` | 100 | 1 min | General API |
| `adminRateLimit` | 10 | 15 min | Admin API |
| `letterGenerationRateLimit` | 5 | 1 hour | Letter generation |
| `subscriptionRateLimit` | 3 | 1 hour | Subscription changes |

Rate limiting uses Upstash Redis when available, falls back to in-memory.

---

## Letter Endpoints Summary

All letter-related endpoints under `/api/letters/[id]/`:

| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/approve` | POST | Approve a letter | Admin |
| `/audit` | GET | Get audit trail | Admin |
| `/complete` | POST | Mark as completed | Admin |
| `/delete` | DELETE | Delete a letter | Owner |
| `/improve` | POST | Request AI improvements | Owner |
| `/pdf` | GET | Download PDF | Owner (approved only) |
| `/reject` | POST | Reject a letter | Admin |
| `/resubmit` | POST | Resubmit rejected letter | Owner |
| `/send-email` | POST | Send letter via email | Admin |
| `/start-review` | POST | Begin review process | Admin |
| `/submit` | POST | Submit for review | Owner |

---

## Security Notes

1. **RLS is always enabled** - Database queries respect row-level security
2. **Employees are data-isolated** - Cannot see any letter content
3. **Audit logging** - All letter operations logged via `log_letter_audit()` RPC
4. **CSRF protection** - Admin routes use CSRF tokens via `/api/admin/csrf`
5. **Rate limiting** - Redis-backed with in-memory fallback
6. **Session security** - HTTP-only cookies, 30-minute timeout
7. **Individual admin accounts** - No shared secrets; each admin uses own credentials