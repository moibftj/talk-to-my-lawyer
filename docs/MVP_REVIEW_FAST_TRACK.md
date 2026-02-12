# Fastest Path: Production-Ready MVP + Repo Review

## 1) Build the MVP repo in one sprint
1. Define one user, one pain, one paid action (single KPI: activation or paid conversion).
2. Ship only one vertical slice: landing page → auth → core action → confirmation.
3. Use boring defaults:
   - Next.js App Router + TypeScript strict
   - Supabase (auth + Postgres + RLS)
   - Stripe for billing
   - Vercel deploy previews + production
4. Add minimum production guardrails on day 1:
   - `.env.example`, env validation, error boundaries
   - request logging + health endpoint
   - lint, typecheck, tests, build in CI
   - rate limit + CSRF + role checks on sensitive routes
5. Launch behind a feature flag, collect real user feedback, then iterate weekly.

## 2) Fastest way to make it “production-ready”
- Definition of done for each feature:
  - happy path works end-to-end
  - failure path returns safe error
  - auth/authorization enforced
  - telemetry captures success/failure
  - one test at API layer + one at UI layer
- Block release unless these pass: `lint`, `typecheck`, `tests`, `build`, and env validation.

## 3) How to review every file and deduce purpose
You *can* inspect every line, but do it with a triage workflow so it finishes quickly:
1. Build an inventory: all routes, components, services, DB migrations, scripts.
2. Map dependencies: “who calls this?” and “what data enters/leaves?”
3. For each file, record:
   - Why it exists (business/system reason)
   - Inputs/outputs (types, schema, side effects)
   - Security impact (auth, secrets, PII, permissions)
   - Runtime risk (network, retries, timeouts, cleanup)
4. Rank risk: auth, payments, data mutation, email/queue, cron, admin tools first.
5. Confirm with execution: run tests, build, and key manual flows; match observed behavior to code intent.

## 4) Practical truth
Reading every file line-by-line is useful once, but for ongoing speed use:
- architecture map + ownership notes
- automated checks in CI
- focused deep reviews on high-risk files

That gives near-complete understanding without slowing delivery.
