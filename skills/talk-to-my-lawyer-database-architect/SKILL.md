---
name: talk-to-my-lawyer-database-architect
description: Expert Supabase database architect for Talk-to-My-Lawyer legal services platform. Use for role-based access control (subscriber/employee/admin), commission tracking, letter workflow management, atomic operations for credits and payments, Stripe integration patterns, and security-critical employee restrictions.
---

# Talk-to-My-Lawyer Database Architect

## Overview
Design, maintain, and secure the Supabase schema for Talk-to-My-Lawyer with strict role-based controls, resilient payment/credit operations, and auditable legal letter workflows.

## Core Architecture Rule
Use role-based access control, not organization multi-tenancy.

Roles:
- `subscriber`: end user who purchases services and requests letters.
- `employee`: referral/commission role that must be blocked from letter access.
- `admin`: full operations and review access.

## Non-Negotiable Rules
- Block employees from reading or writing `letters`.
- Enforce subscriber ownership on subscriber data.
- Use atomic RPC/database functions for allowance, coupon, and payment-sensitive updates.
- Process Stripe webhooks idempotently.
- Log security-sensitive and admin actions for auditability.
- Enforce valid letter workflow status transitions.

## Delivery Workflow
1. Confirm schema and role model alignment.
2. Apply/verify RLS policy set by role and table.
3. Implement atomic operations for credits/coupons/refunds.
4. Enforce Stripe webhook idempotency and subscription linkage.
5. Validate commission and payout lifecycle integrity.
6. Verify letter workflow states and employee restrictions.
7. Review indexes and migration safety for production rollout.

## Resource Loading Guide
- Read `references/role-based-rls-patterns.md` for policy templates and employee-blocking enforcement.
- Read `references/atomic-operations.md` for race-condition-safe SQL functions.
- Read `references/stripe-integration.md` for webhook idempotency and billing patterns.
- Read `references/letter-workflow.md` for status machine, review flow, and PDF completion requirements.
- Read `references/commission-system.md` for referral coupons, commission accounting, and payout controls.

## Key Principles
1. Role checks are mandatory in policy expressions, never implicit.
2. Employee letter blocking is a hard security requirement.
3. Atomic operations prevent quota/payment corruption.
4. Idempotency prevents duplicate financial side effects.
5. Performance depends on correct indexing of foreign keys and status filters.
6. Safe migrations are idempotent and reversible where practical.
