---
name: ttml-legal-letter-generation
description: End-to-end workflow for generating professional legal letters with AI plus attorney review in Talk-to-My-Lawyer. Use when building or updating demand letters, cease and desist notices, contract breach letters, eviction notices, employment disputes, consumer complaints, or any legal correspondence pipeline requiring allowance checks, audit trails, and reviewer approval.
---

# Legal Letter Generation Workflow

## Overview
Implement and maintain the full pipeline from user intake through reviewed PDF delivery. Enforce subscriber gating, strict status transitions, auditable events, and resilient generation with n8n-primary and OpenAI fallback.

## Execution Order
1. Enforce pre-flight checks in `POST /api/generate-letter`.
2. Validate intake and deduce letter-type-specific requirements.
3. Deduct allowance atomically, create draft record, set `generating`.
4. Attempt n8n generation first; fallback to OpenAI only on n8n failure.
5. Transition to `pending_review`, log status transition, notify attorneys.
6. Route review actions (approve/reject) with optimistic status checks.
7. Generate/store PDF before marking `completed`.
8. Expose subscriber download/email actions with signed URL access.
9. Refund allowance atomically on eligible failures/rejections.

## Non-Negotiable Rules
- Allow generation for subscribers with active subscriptions only.
- Verify and deduct allowance atomically before generation.
- Prefer n8n generation path; use OpenAI as fallback only.
- Enforce valid status transitions and log every transition.
- Protect long generation with timeout and background-safe behavior.
- Refund allowance on generation failures requiring rollback.
- Notify attorney admins when letter reaches `pending_review`.
- Require `pdf_url` before final `completed` state.
- Validate intake with Zod before processing.
- Apply per-user rate limiting to generation endpoint.

## Status State Machine
`draft -> generating -> pending_review -> under_review -> approved|rejected -> completed`

Never skip mandatory intermediate states. Run transition logging on every change.

## Resource Loading Guide
- Read `references/workflow-spec.md` for end-to-end implementation details (phases, APIs, payloads, fallback rules, and delivery).
- Read `references/testing-monitoring-security.md` for test coverage, runtime alerts, access control, and data-protection controls.
- Use these references as operational spec and keep route/service code aligned with them.
