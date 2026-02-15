# Production Deployment Checklist

**Before every production deployment, complete this checklist.**

---

## Pre-Deployment (30 minutes before)

### Code Quality

- [ ] All tests pass: `pnpm test`
- [ ] Linting passes: `pnpm lint`
- [ ] TypeScript compiles: `pnpm build`
- [ ] No console errors or warnings in development

### Environment Variables

- [ ] Run environment validation: `pnpm validate-env`
- [ ] Review `docs/VERCEL_ENV_INVENTORY.md` for recent changes
- [ ] If adding new env vars, update `.env.example`
- [ ] Verify new env vars are set in Vercel: `vercel env ls production`

### Documentation

- [ ] Update CHANGELOG.md with changes
- [ ] Update relevant documentation in `docs/`
- [ ] If API changes, update API documentation
- [ ] If database changes, document in migration file

### Team Communication

- [ ] Notify team in #deployments Slack channel
- [ ] Confirm no other deployments are in progress
- [ ] Identify on-call engineer for this deployment
- [ ] Schedule deployment during low-traffic window (if major changes)

---

## Deployment

### Merge & Deploy

- [ ] Merge PR to `main` branch
- [ ] Monitor Vercel build logs for errors
- [ ] Wait for deployment to complete (typically 2-3 minutes)
- [ ] Check deployment status: `vercel ls talk-to-my-lawyer`
- [ ] Note deployment ID for rollback reference

### Deployment Details

- **Deployed by:** _______________
- **Date/Time:** _______________
- **Deployment ID:** _______________
- **Commit SHA:** _______________

---

## Post-Deployment (immediately after)

### Automated Checks

- [ ] Health endpoint returns 200: `curl https://www.talk-to-my-lawyer.com/api/health`
- [ ] No startup errors in health check response
- [ ] No warnings in health check response (or warnings are expected)

### Critical User Flows

- [ ] **Homepage** loads without errors
- [ ] **Login** works (test with a real account)
- [ ] **Dashboard** loads for authenticated user
- [ ] **Letter generation** works (create a test letter)
- [ ] **Admin portal** accessible (if changes affect admin)
- [ ] **Payment flow** works (if changes affect Stripe integration)

### Monitoring

- [ ] Monitor Vercel logs for 10 minutes: `vercel logs --follow`
- [ ] Check error rate in Sentry (if configured)
- [ ] Verify no spike in 500 errors
- [ ] Check Uptime Robot status (if configured)

### Team Communication

- [ ] Update #deployments Slack channel with status
- [ ] If issues detected, immediately notify team
- [ ] Document any unexpected behavior

---

## Rollback Procedure (if issues detected)

### When to Rollback

Rollback immediately if:
- Health check fails (returns 503)
- Critical user flows are broken
- Error rate spikes above 5%
- Database migrations fail
- Payment processing fails

### Rollback Steps

- [ ] Identify last known good deployment ID
- [ ] Revert to previous commit: `git revert HEAD`
- [ ] Push to `main`: `git push origin main`
- [ ] Monitor new deployment
- [ ] Verify health check passes after rollback
- [ ] Notify team in #deployments
- [ ] Document incident in `docs/incidents/YYYY-MM-DD-description.md`

### Post-Rollback

- [ ] Investigate root cause
- [ ] Create bug ticket
- [ ] Schedule post-mortem meeting
- [ ] Update this checklist with lessons learned

---

## Environment Variable Changes

**If this deployment includes environment variable changes:**

### Before Deployment

- [ ] Document changes in PR description
- [ ] Update `docs/VERCEL_ENV_INVENTORY.md`
- [ ] Verify new variables are set in Vercel
- [ ] Test locally with production-like environment:
  ```bash
  vercel env pull .env.local --environment=production
  pnpm dev
  ```

### After Deployment

- [ ] Verify application uses new environment variables
- [ ] Check health endpoint for environment warnings
- [ ] Test functionality that depends on new variables
- [ ] Update team knowledge base

---

## Database Migration Changes

**If this deployment includes database migrations:**

### Before Deployment

- [ ] Review migration SQL in `supabase/migrations/`
- [ ] Test migration on staging database first
- [ ] Backup production database (Supabase auto-backups daily)
- [ ] Verify migration is idempotent (can run multiple times safely)
- [ ] Check for breaking changes to existing queries

### After Deployment

- [ ] Verify migration applied successfully
- [ ] Check Supabase dashboard for migration status
- [ ] Test queries that use new schema
- [ ] Monitor database performance

---

## Special Deployment Types

### Hotfix Deployment

For urgent production fixes:

- [ ] Create hotfix branch from `main`
- [ ] Make minimal changes to fix issue
- [ ] Skip non-critical checklist items
- [ ] Deploy immediately
- [ ] Monitor closely for 30 minutes
- [ ] Schedule proper fix for next regular deployment

### Feature Flag Deployment

For features behind feature flags:

- [ ] Verify feature flag is OFF by default
- [ ] Test with feature flag ON in staging
- [ ] Deploy with feature flag OFF
- [ ] Gradually enable for test users
- [ ] Monitor metrics before full rollout

### Breaking Change Deployment

For changes that break backward compatibility:

- [ ] Notify all stakeholders 48 hours in advance
- [ ] Update API documentation
- [ ] Provide migration guide for API consumers
- [ ] Schedule deployment during maintenance window
- [ ] Have rollback plan ready

---

## Post-Deployment Review (within 24 hours)

- [ ] Review error logs for new issues
- [ ] Check performance metrics (response times, etc.)
- [ ] Verify no user complaints in support channels
- [ ] Update deployment log in team wiki
- [ ] Share learnings with team

---

## Sign-Off

- **Deployed by:** _______________
- **Reviewed by:** _______________
- **Status:** ✅ Success / ⚠️ Success with issues / ❌ Rolled back
- **Notes:** _______________

---

## Appendix: Useful Commands

```bash
# Check Vercel deployment status
vercel ls talk-to-my-lawyer

# View production logs
vercel logs talk-to-my-lawyer --prod

# View logs for specific deployment
vercel logs talk-to-my-lawyer --deployment <deployment-id>

# Test health endpoint
curl https://www.talk-to-my-lawyer.com/api/health | jq

# Check environment variables
vercel env ls production

# Pull production env vars for local testing
vercel env pull .env.local --environment=production

# Trigger manual deployment
vercel --prod

# Rollback to specific deployment
vercel rollback <deployment-url>
```

---

**Last Updated:** February 15, 2026
**Owner:** Engineering Team
**Review Schedule:** After each deployment, update lessons learned
