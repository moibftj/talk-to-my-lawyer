# Part 1 — Test Setup (Accounts + Environment)

## Overview

This document provides the complete test setup for QA testing of Talk-To-My-Lawyer.

## Database Schema Reference

### Roles (profiles.role)
| Role | Description |
|------|-------------|
| `subscriber` | Regular users who can create and manage letters |
| `employee` | Staff members with referral/coupon capabilities |
| `admin` | Administrative users (Attorney Admin or Super Admin) |

### Admin Sub-Roles (profiles.admin_sub_role)
| Sub-Role | Description |
|----------|-------------|
| `attorney_admin` | Can review/approve/reject letters |
| `super_admin` | Full system access including analytics, user management, payouts |

### Subscription Status (subscriptions.status)
| Status | Description |
|--------|-------------|
| `active` | Active subscription |
| `canceled` | Subscription canceled |
| `past_due` | Payment overdue |
| `payment_failed` | Payment failed |
| `trialing` | Trial period |

### Letter Status (letters.status)
| Status | Description |
|--------|-------------|
| `draft` | Initial draft state |
| `generating` | AI is generating content |
| `pending_review` | Awaiting attorney review |
| `under_review` | Currently being reviewed |
| `approved` | Approved by attorney |
| `completed` | Finalized and delivered |
| `rejected` | Rejected, needs revision |
| `failed` | Generation failed |

## Required Test Users

### Standard Role/Plan Combinations

| # | Email | Password | Role | Plan Status | Letter Quota | Notes |
|---|-------|----------|------|-------------|--------------|-------|
| 1 | `test-free@example.com` | `TestPass123!` | subscriber | unpaid/free | 0 | Free tier user |
| 2 | `test-monthly@example.com` | `TestPass123!` | subscriber | active (monthly) | unlimited | $200/mo membership |
| 3 | `test-annual@example.com` | `TestPass123!` | subscriber | active (annual) | 48 | $2,000/year plan |
| 4 | `test-pastdue@example.com` | `TestPass123!` | subscriber | past_due | 0 | Payment failed |
| 5 | `test-employee@example.com` | `TestPass123!` | employee | N/A | N/A | Staff member |
| 6 | `test-attorney@example.com` | `TestPass123!` | admin | N/A | N/A | Attorney Admin |
| 7 | `test-superadmin@example.com` | `TestPass123!` | admin | N/A | N/A | Super Admin |

### Special Case Users

| # | Email | Password | Role | Special Condition |
|---|-------|----------|------|-------------------|
| 8 | `test-newuser@example.com` | `TestPass123!` | subscriber | Fresh signup with auto-assigned coupon |
| 9 | `test-noletters@example.com` | `TestPass123!` | subscriber | 0 letters created |
| 10 | `test-multiletters@example.com` | `TestPass123!` | subscriber | 3+ letters created |
| 11 | `test-edgecase@example.com` | `TestPass123!` | subscriber | Long name + special characters |

## Environment Configuration

### Staging Environment
```
NEXT_PUBLIC_SITE_URL=https://staging.talk-to-my-lawyer.com
SUPABASE_URL=<staging-supabase-url>
SUPABASE_ANON_KEY=<staging-anon-key>
STRIPE_SECRET_KEY=<stripe-test-key>
```

## Answers to Dev Questions

### Q: Where do roles live (DB field name + enum list)?
**A:** Roles are stored in the `profiles` table:
- Field: `role` (type: `UserRole`)
- Enum values: `subscriber`, `employee`, `admin`
- Admin sub-roles: `admin_sub_role` field with values `super_admin`, `attorney_admin`

### Q: Where do entitlements live and which is the source of truth?
**A:** Entitlements are managed in two places:
1. **Stripe** (billing provider): Source of truth for payment status, subscription validity
2. **Database** (`subscriptions` table): Local cache of subscription state
   - `remaining_letters`: Letter quota for annual plans
   - `credits_remaining`: Alternative credit system
   - `status`: Synced from Stripe via webhooks

The **Stripe webhook** is the source of truth - it updates the database when payment events occur.
