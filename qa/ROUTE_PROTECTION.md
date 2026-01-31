# Part 2 — Auth + Route Protection (Entry Points)

## Overview

This document defines all protected routes and their required roles for QA testing.

## Route Map by Role

### Public Routes (No Auth Required)
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth/login` | Login page |
| `/auth/signup` | Registration page |
| `/auth/forgot-password` | Password reset request |
| `/auth/reset-password` | Password reset form |
| `/auth/check-email` | Email confirmation notice |
| `/contact` | Contact page |
| `/faq` | FAQ page |
| `/how-it-works` | How it works page |
| `/membership` | Membership plans page |

### Subscriber Routes (role: subscriber)
| Route | Description | Auth Check |
|-------|-------------|------------|
| `/dashboard` | Main dashboard | `requireAuth()` |
| `/dashboard/letters` | Letter list | `requireAuth()` |
| `/dashboard/letters/new` | Create new letter | `requireAuth()` + entitlement check |
| `/dashboard/letters/[id]` | View specific letter | `requireAuth()` + ownership check |
| `/dashboard/billing` | Billing information | `requireAuth()` |
| `/dashboard/subscription` | Subscription management | `requireAuth()` |
| `/dashboard/settings` | Profile settings | `requireAuth()` |

### Employee Routes (role: employee)
| Route | Description | Auth Check |
|-------|-------------|------------|
| `/dashboard` | Employee dashboard | `requireAuth()` |
| `/dashboard/referrals` | Referral management | `requireRole('employee')` |
| `/dashboard/coupons` | Coupon management | `requireRole('employee')` |
| `/dashboard/commissions` | Commission tracking | `requireRole('employee')` |
| `/dashboard/payouts` | Payout requests | `requireRole('employee')` |
| `/dashboard/employee-settings` | Employee settings | `requireRole('employee')` |

### Attorney Admin Routes (role: admin, admin_sub_role: attorney_admin)
| Route | Description | Auth Check |
|-------|-------------|------------|
| `/attorney-portal/login` | Attorney portal login | Public |
| `/attorney-portal/review` | Review queue | `requireAttorneyAdminAccess()` |
| `/attorney-portal/review/[id]` | Review specific letter | `requireAttorneyAdminAccess()` |
| `/secure-admin-gateway/review` | Admin review center | `requireAdminAuth()` |
| `/secure-admin-gateway/review/[id]` | Admin review letter | `requireAdminAuth()` |

### Super Admin Routes (role: admin, admin_sub_role: super_admin)
| Route | Description | Auth Check |
|-------|-------------|------------|
| `/secure-admin-gateway/login` | Admin login | Public |
| `/secure-admin-gateway/dashboard` | Admin dashboard | `requireAdminAuth()` |
| `/secure-admin-gateway/dashboard/analytics` | Analytics | `requireSuperAdminAuth()` |
| `/secure-admin-gateway/dashboard/users` | User management | `requireSuperAdminAuth()` |
| `/secure-admin-gateway/dashboard/letters` | Letter management | `requireAdminAuth()` |
| `/secure-admin-gateway/dashboard/all-letters` | All letters view | `requireAdminAuth()` |
| `/secure-admin-gateway/dashboard/coupons` | Coupon management | `requireSuperAdminAuth()` |
| `/secure-admin-gateway/dashboard/commissions` | Commission management | `requireSuperAdminAuth()` |
| `/secure-admin-gateway/dashboard/email-queue` | Email queue | `requireSuperAdminAuth()` |

## API Route Protection

### Subscriber API Routes
| Endpoint | Method | Auth Check |
|----------|--------|------------|
| `/api/generate-letter` | POST | `requireAuth()` + entitlement |
| `/api/letters/[id]/pdf` | GET | `requireAuth()` + ownership |
| `/api/letters/[id]/submit` | POST | `requireAuth()` + ownership |
| `/api/letters/[id]/improve` | POST | `requireAuth()` + ownership |
| `/api/letters/[id]/delete` | DELETE | `requireAuth()` + ownership |
| `/api/subscriptions/*` | ALL | `requireAuth()` |
| `/api/create-checkout` | POST | `requireAuth()` |
| `/api/verify-payment` | POST | `requireAuth()` |

### Employee API Routes
| Endpoint | Method | Auth Check |
|----------|--------|------------|
| `/api/employee/referral-link` | GET | `requireRole('employee')` |
| `/api/employee/payouts` | ALL | `requireRole('employee')` |

### Admin API Routes
| Endpoint | Method | Auth Check |
|----------|--------|------------|
| `/api/admin-auth/login` | POST | Public (validates credentials) |
| `/api/admin-auth/logout` | POST | `requireAdminAuth()` |
| `/api/admin/letters` | GET | `requireAdminAuth()` |
| `/api/admin/letters/[id]/update` | PATCH | `requireAdminAuth()` |
| `/api/admin/letters/batch` | POST | `requireAdminAuth()` |
| `/api/letters/[id]/approve` | POST | `requireAttorneyAdminAccess()` |
| `/api/letters/[id]/reject` | POST | `requireAttorneyAdminAccess()` |
| `/api/letters/[id]/start-review` | POST | `requireAttorneyAdminAccess()` |
| `/api/admin/analytics` | GET | `requireSuperAdminAuth()` |
| `/api/admin/coupons` | ALL | `requireSuperAdminAuth()` |
| `/api/admin/email-queue` | ALL | `requireSuperAdminAuth()` |

## Server-Side Middleware/Guards

### Location: `lib/auth/admin-session.ts`

```typescript
// Key functions for admin auth:
requireAdminAuth()        // Any admin type
requireSuperAdminAuth()   // Super admin only
requireAttorneyAdminAccess() // Attorney admin or super admin
```

### Location: `lib/auth/authenticate-user.ts`

```typescript
// Key functions for user auth:
requireAuth()             // Any authenticated user
requireRole(role)         // Specific role required
requireLetterGeneration() // Subscriber or higher + entitlement
```

### Location: `lib/middleware/`

```typescript
// Middleware for route protection
- Rate limiting
- CSRF protection
- Session validation
```

## Test Scenarios

### Scenario 1: Unauthenticated Access
1. Clear all cookies/sessions
2. Try to access each protected route directly via URL
3. **Expected**: Redirect to login page

### Scenario 2: Wrong Role Access
1. Login as subscriber
2. Try to access `/secure-admin-gateway/dashboard`
3. **Expected**: 403 Forbidden or redirect

### Scenario 3: Cross-User Data Access
1. Login as User A
2. Get letter ID from User A
3. Logout, login as User B
4. Try to access `/dashboard/letters/[User A's letter ID]`
5. **Expected**: 403 Forbidden

### Scenario 4: API Authorization
1. Login as subscriber
2. Try to call `/api/admin/analytics`
3. **Expected**: 401 or 403 response

## Expected Behaviors

| Scenario | Expected Response |
|----------|-------------------|
| Unauthenticated → Protected Route | Redirect to `/auth/login` |
| Wrong Role → Admin Route | 403 Forbidden |
| Subscriber → Employee Route | 403 Forbidden |
| Attorney Admin → Super Admin Route | 403 Forbidden |
| Cross-User Data Access | 403 Forbidden |
| Invalid Session | Redirect to login |
