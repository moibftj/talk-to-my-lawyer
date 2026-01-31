# QA Testing Framework

## Overview

This directory contains the comprehensive QA testing framework for Talk-To-My-Lawyer, covering all 10 parts of the testing checklist.

## Directory Structure

```
qa/
├── README.md                    # This file
├── TEST_SETUP.md               # Part 1: Test accounts and environment setup
├── ROUTE_PROTECTION.md         # Part 2: Auth and route protection tests
├── BILLING_ENTITLEMENTS.md     # Part 3 & 4: Coupon codes and billing tests
├── LETTER_LIFECYCLE.md         # Part 5 & 6: Letter lifecycle and review center
├── SECURITY_TESTING.md         # Part 7, 8 & 9: Dashboards, profiles, security
├── GO_NO_GO_REPORT.md          # Part 10: Final report template
└── scripts/
    └── create-test-users.ts    # Script to create test users
```

## Quick Start

### 1. Create Test Users

```bash
# Set environment variables
export SUPABASE_URL=<your-staging-url>
export SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Run the script
pnpm tsx qa/scripts/create-test-users.ts
```

### 2. Run Through Test Parts

Follow the documentation in order:

1. **TEST_SETUP.md** - Verify test accounts are ready
2. **ROUTE_PROTECTION.md** - Test auth and route protection
3. **BILLING_ENTITLEMENTS.md** - Test coupon codes and billing
4. **LETTER_LIFECYCLE.md** - Test letter creation and review
5. **SECURITY_TESTING.md** - Test dashboards, profiles, and security

### 3. Complete the Report

Use **GO_NO_GO_REPORT.md** as a template to document findings.

## Test User Credentials

| Email | Password | Role |
|-------|----------|------|
| test-free@example.com | TestPass123! | subscriber (free) |
| test-monthly@example.com | TestPass123! | subscriber (monthly) |
| test-annual@example.com | TestPass123! | subscriber (annual) |
| test-pastdue@example.com | TestPass123! | subscriber (past_due) |
| test-employee@example.com | TestPass123! | employee |
| test-attorney@example.com | TestPass123! | admin (attorney_admin) |
| test-superadmin@example.com | TestPass123! | admin (super_admin) |

## Key Areas Covered

- **Authentication**: Login, logout, session management
- **Authorization**: Role-based access control, route protection
- **Billing**: Subscriptions, payments, entitlements
- **Core Product**: Letter creation, generation, delivery
- **Review Center**: Attorney review workflow
- **Security**: Data isolation, cross-user access prevention

## Severity Levels

| Severity | Description |
|----------|-------------|
| **Blocker** | Prevents core functionality, must fix before release |
| **High** | Major feature broken, significant user impact |
| **Medium** | Feature works but with issues, workaround exists |
| **Low** | Minor issue, cosmetic, or edge case |

## Go/No-Go Criteria

- **GO**: No blockers or high-severity issues in:
  - Billing and payments
  - Role-based access control
  - Letter lifecycle
  - Review center
  
- **NO-GO**: Any blocker or high-severity issue in critical areas
