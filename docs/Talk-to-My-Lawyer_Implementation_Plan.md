# Talk-To-My-Lawyer Implementation Plan

> **Scope**: Product, platform, and operational roadmap for Talk-To-My-Lawyer. This document tracks delivery phases, owners, and the highest-risk technical items to ship safely.

## Status legend
- **P0** — Must fix before production launch or when customer-facing risk is high.
- **P1** — Required for a stable beta; can ship shortly after P0 items are closed.
- **P2** — Enhancements and operational hardening.

## Executive summary
- **Current focus**: production readiness, stability, and reliability in auth, billing, and email flows.
- **Primary risk areas**: concurrency around subscription allowance, webhook retries, and email queue health.
- **Near-term goals**: close P0 issues, run end-to-end testing, and validate monitoring + alerting.

---

## Phase 0 — Production-readiness (P0)

### Auth & onboarding
- [ ] **Supabase Auth SMTP configuration**: confirm transactional email deliverability and branding.
- [ ] **Confirmation + welcome email sequencing**: ensure welcome email fires after confirmed state.
- [ ] **RLS policy audit**: verify per-role access in all critical tables (letters, profiles, queue).

### Billing & allowance
- [ ] **Race conditions**: eliminate double-deduction on allowance for `/api/generate-letter`.
- [ ] **Webhook idempotency**: guard against duplicate Stripe webhook events.
- [ ] **Coupon/commission edge cases**: verify stacking rules and credit application.

### Letter generation & review
- [ ] **Rate-limit enforcement**: confirm Upstash Redis keys are scoped per user.
- [ ] **Audit logging**: ensure every admin action logs to `admin_audit_log`.
- [ ] **Draft status integrity**: enforce state transitions (pending_review → under_review → approved).

### Email queue & delivery
- [ ] **Queue processor reliability**: validate `/api/cron/process-email-queue` retry path.
- [ ] **Template data integrity**: validate all 18 templates have required data.
- [ ] **Resend API errors**: track and surface deliverability failures in admin UI.

### Observability & operations
- [ ] **Health endpoints**: confirm `/api/health` and `/api/health/detailed` report deps.
- [ ] **Alerting**: connect error reporting for queue failures and Stripe webhook errors.
- [ ] **Security scans**: run `pnpm security:scan` and remediate findings.

---

## Phase 1 — Beta hardening (P1)

### Admin & attorney workflows
- [ ] **Bulk review actions**: batch approve/reject with audit trails.
- [ ] **Review SLA metrics**: measure average time-to-approval.
- [ ] **Role-specific dashboards**: attorney vs. system admin views.

### Subscriber experience
- [ ] **Draft improvements**: refine `/api/letters/[id]/improve` UX copy and feedback.
- [ ] **PDF branding**: ensure letter PDF output matches brand guidelines.
- [ ] **Notification preferences**: allow subscribers to opt into specific email types.

### Platform quality
- [ ] **End-to-end tests**: add flows for checkout, generation, and approval.
- [ ] **Performance**: monitor letter generation latency and cache profile reads.
- [ ] **Error handling polish**: unify API error shapes in UI.

---

## Phase 2 — Scale & growth (P2)

### Product enhancements
- [ ] **Template library**: user-selectable letter templates with attorney-approved variants.
- [ ] **Team accounts**: multi-user organizations with shared allowances.
- [ ] **Advanced analytics**: conversion funnel and cohort tracking.

### Operational maturity
- [ ] **SLA/uptime dashboards**: uptime tracking with internal alerting.
- [ ] **Disaster recovery**: runbook + backup restoration drills.
- [ ] **Compliance readiness**: GDPR workflows completion checks.

---

## Ownership & cadence
- **Product owner**: System Admin
- **Engineering owner**: Platform Lead
- **Review cadence**: weekly check-ins; monthly roadmap refresh.

## Links
- Deployment guide: [`docs/DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md)
- Architecture & development: [`docs/ARCHITECTURE_AND_DEVELOPMENT.md`](ARCHITECTURE_AND_DEVELOPMENT.md)
- API & integrations: [`docs/API_AND_INTEGRATIONS.md`](API_AND_INTEGRATIONS.md)
- Email system: [`lib/email/AGENTS.md`](../lib/email/AGENTS.md)
