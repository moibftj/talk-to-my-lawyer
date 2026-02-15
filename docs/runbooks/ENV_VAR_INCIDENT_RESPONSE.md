# Environment Variable Incident Response Runbook

This runbook provides step-by-step instructions for diagnosing and resolving environment variable-related production incidents.

---

## When to Use This Runbook

Use this runbook when experiencing any of the following symptoms:

- All routes returning **500 Internal Server Error**
- Health check endpoint (`/api/health`) failing with 503 or 500
- Dashboard pages not loading
- API endpoints timing out or returning 405 errors
- "Internal Server Error" displayed on homepage
- Vercel logs showing environment-related errors

---

## Incident Response Flow

```
Detect → Diagnose → Resolve → Verify → Document
```

---

## Phase 1: Detection & Initial Assessment

### Step 1: Confirm the Incident

**Objective:** Verify that an incident is occurring and assess severity.

**Actions:**

1. **Check the health endpoint:**
   ```bash
   curl https://www.talk-to-my-lawyer.com/api/health
   ```
   
   **Expected:** `{"status": "healthy", ...}`
   
   **If 500/503:** Environment variable issue confirmed

2. **Check multiple endpoints:**
   ```bash
   curl https://www.talk-to-my-lawyer.com/
   curl https://www.talk-to-my-lawyer.com/dashboard
   curl https://www.talk-to-my-lawyer.com/api/generate-letter
   ```
   
   **If all return 500:** System-wide outage, likely environment issue

3. **Assess severity:**
   - **P0 (Critical):** All routes down, production unusable
   - **P1 (High):** Some critical features broken
   - **P2 (Medium):** Non-critical features degraded

### Step 2: Notify Team

**For P0 incidents:**

1. Post in #incidents Slack channel:
   ```
   🚨 P0 INCIDENT: Production site down - all routes returning 500
   Investigating environment variable issue
   Incident commander: [Your Name]
   ```

2. Page on-call engineer if outside business hours

3. Update status page (if available)

---

## Phase 2: Diagnosis

### Step 1: Check Vercel Logs

**Objective:** Identify which environment variable is missing or invalid.

**Actions:**

1. **View recent production logs:**
   ```bash
   vercel logs talk-to-my-lawyer --prod --since 10m
   ```

2. **Search for environment-related errors:**
   ```bash
   vercel logs talk-to-my-lawyer --prod --since 10m | grep -i "environment\|supabase\|openai\|missing\|undefined\|not configured"
   ```

3. **Look for specific error patterns:**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase connection failure
   - `OPENAI_API_KEY` → AI generation failure
   - `STRIPE_SECRET_KEY` → Payment processing failure
   - `RESEND_API_KEY` → Email delivery failure

### Step 2: Verify Critical Variables

**Objective:** Confirm which variables are set in Vercel.

**Actions:**

1. **List all production environment variables:**
   ```bash
   vercel env ls production
   ```

2. **Check critical variables specifically:**
   ```bash
   vercel env ls production | grep -E "SUPABASE|OPENAI|STRIPE|RESEND"
   ```

3. **Verify values (first 20 characters only):**
   ```bash
   vercel env get NEXT_PUBLIC_SUPABASE_ANON_KEY production | head -c 20
   ```

### Step 3: Compare with Expected Configuration

**Objective:** Identify discrepancies between actual and expected configuration.

**Actions:**

1. **Review environment inventory:**
   Open `docs/VERCEL_ENV_INVENTORY.md`

2. **Check for recent changes:**
   ```bash
   git log --oneline --since="24 hours ago" -- .env.example
   ```

3. **Verify against `.env.example`:**
   Compare Vercel variables with `.env.example` to find missing variables

---

## Phase 3: Resolution

### Quick Fix: Set Missing Variable

**Time:** 5 minutes

**When to use:** Single variable is missing or has incorrect value

**Steps:**

1. **Set the missing variable:**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   ```
   
   Paste the correct value when prompted

2. **Verify it's set:**
   ```bash
   vercel env get NEXT_PUBLIC_SUPABASE_ANON_KEY production
   ```

3. **Trigger redeploy:**
   ```bash
   git commit --allow-empty -m "chore: trigger redeploy after env fix"
   git push origin main
   ```

4. **Monitor deployment:**
   ```bash
   vercel ls talk-to-my-lawyer
   ```

5. **Wait 2-3 minutes for deployment to complete**

6. **Verify health:**
   ```bash
   curl https://www.talk-to-my-lawyer.com/api/health
   ```

### Common Variable Fixes

#### Missing NEXT_PUBLIC_SUPABASE_ANON_KEY

**Symptoms:** All routes return 500, Supabase connection fails

**Fix:**
```bash
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vbWlpcXp4YXh5eG54bmR2a2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzQwNzYsImV4cCI6MjA4MzY5NDA3Nn0.Wi5A7cHcx95-mDogBbxBzLQ9K7ACbJDrGx0hAhKOK1k
```

#### Missing OPENAI_API_KEY

**Symptoms:** Letter generation fails, AI features broken

**Fix:**
```bash
vercel env add OPENAI_API_KEY production
# Paste your OpenAI API key (starts with sk-)
```

#### Missing STRIPE_SECRET_KEY

**Symptoms:** Payment processing fails, checkout broken

**Fix:**
```bash
vercel env add STRIPE_SECRET_KEY production
# Paste your Stripe secret key (starts with sk_)
```

### Advanced Fix: Multiple Variables Missing

**Time:** 15 minutes

**When to use:** Multiple variables are missing or configuration is severely broken

**Steps:**

1. **Pull current production environment:**
   ```bash
   vercel env pull .env.production --environment=production
   ```

2. **Compare with `.env.example`:**
   ```bash
   diff .env.example .env.production
   ```

3. **Identify all missing variables**

4. **Set each missing variable:**
   ```bash
   for var in VAR1 VAR2 VAR3; do
     vercel env add $var production
   done
   ```

5. **Verify all are set:**
   ```bash
   vercel env ls production
   ```

6. **Trigger redeploy**

### Emergency Rollback

**Time:** 10 minutes

**When to use:** Fix is taking too long, need to restore service immediately

**Steps:**

1. **Identify last known good deployment:**
   ```bash
   vercel ls talk-to-my-lawyer --prod
   ```

2. **Find the deployment before the current one**

3. **Rollback:**
   ```bash
   vercel rollback <previous-deployment-url>
   ```

4. **Verify health after rollback:**
   ```bash
   curl https://www.talk-to-my-lawyer.com/api/health
   ```

5. **Notify team that service is restored**

6. **Continue investigating root cause**

---

## Phase 4: Verification

### Step 1: Verify Health

**Objective:** Confirm the fix resolved the issue.

**Actions:**

1. **Check health endpoint:**
   ```bash
   curl https://www.talk-to-my-lawyer.com/api/health | jq
   ```
   
   **Expected:**
   ```json
   {
     "status": "healthy",
     "startup": {
       "healthy": true,
       "errors": [],
       "warnings": []
     }
   }
   ```

2. **Check for warnings:**
   If `startup.warnings` is not empty, review warnings and address if critical

### Step 2: Test Critical Flows

**Objective:** Verify user-facing functionality works.

**Actions:**

1. **Homepage loads:**
   ```bash
   curl -I https://www.talk-to-my-lawyer.com/
   ```
   Expected: `HTTP/2 200`

2. **Login works:**
   Test manually in browser

3. **Dashboard loads:**
   Test manually in browser (requires authentication)

4. **Letter generation works:**
   Create a test letter and verify it completes

5. **Admin portal accessible:**
   Test admin login

### Step 3: Monitor for Stability

**Objective:** Ensure the fix is stable over time.

**Actions:**

1. **Monitor logs for 15 minutes:**
   ```bash
   vercel logs --follow
   ```

2. **Check error rate:**
   - Sentry dashboard (if configured)
   - Vercel analytics
   - UptimeRobot status

3. **Verify no new errors appear**

---

## Phase 5: Documentation

### Step 1: Update Incident Log

**Objective:** Document the incident for future reference.

**Actions:**

1. **Create incident report:**
   ```bash
   touch docs/incidents/2026-02-15-env-var-outage.md
   ```

2. **Document:**
   - What happened
   - When it happened
   - How it was detected
   - Root cause
   - Resolution steps
   - Time to detect (MTTD)
   - Time to resolve (MTTR)
   - Lessons learned

### Step 2: Update Inventory

**Objective:** Keep environment variable documentation current.

**Actions:**

1. **Update `docs/VERCEL_ENV_INVENTORY.md`:**
   - Add newly discovered required variables
   - Update "Last Updated" dates
   - Document any new dependencies

2. **Update `.env.example` if needed:**
   - Add missing variables
   - Update comments/documentation
   - Commit changes

### Step 3: Improve Prevention

**Objective:** Prevent this incident from happening again.

**Actions:**

1. **Add to pre-deploy checklist:**
   Update `docs/checklists/DEPLOYMENT_CHECKLIST.md` with new checks

2. **Add monitoring:**
   - Create alert for this specific variable
   - Add to health check if not already monitored

3. **Update runbook:**
   Add any new troubleshooting steps discovered during this incident

### Step 4: Team Communication

**Objective:** Share learnings with the team.

**Actions:**

1. **Post incident summary in #incidents:**
   ```
   ✅ RESOLVED: Production outage due to missing NEXT_PUBLIC_SUPABASE_ANON_KEY
   Duration: [X] minutes
   Root cause: [Description]
   Resolution: [Description]
   Prevention: [Description]
   Full report: docs/incidents/YYYY-MM-DD-description.md
   ```

2. **Schedule post-mortem meeting (for P0/P1 incidents):**
   - Review timeline
   - Identify improvement opportunities
   - Assign action items

3. **Update team knowledge base**

---

## Troubleshooting Guide

### Issue: Variable is set but still getting errors

**Possible causes:**

1. **Typo in variable name:**
   - Vercel is case-sensitive
   - Check for trailing spaces
   - Verify correct prefix (`NEXT_PUBLIC_` for client-side)

2. **Wrong environment:**
   - Variable set in Preview but not Production
   - Use `vercel env ls production` to verify

3. **Deployment hasn't picked up new variable:**
   - Trigger new deployment
   - Clear Vercel build cache if needed

4. **Value is incorrect:**
   - Verify format (JWT should start with `eyJ`, API keys have specific prefixes)
   - Check for copy-paste errors
   - Regenerate key if needed

### Issue: Health check passes but feature still broken

**Possible causes:**

1. **Feature-specific variable missing:**
   - Check logs for feature-specific errors
   - Verify all variables for that feature are set

2. **External service down:**
   - Check Supabase status
   - Check OpenAI status
   - Check Stripe status

3. **Code issue, not environment:**
   - Review recent code changes
   - Check for logic errors
   - Consider rollback

### Issue: Deployment fails after setting variable

**Possible causes:**

1. **Build-time validation failing:**
   - Check build logs
   - Verify variable format is correct
   - Check for conflicting variables

2. **Vercel build timeout:**
   - Check build duration
   - Optimize build if needed

3. **Dependency issue:**
   - Check for missing dependencies
   - Verify package.json is correct

---

## Reference: Critical Environment Variables

| Variable | Required | Format | Impact if Missing |
|----------|----------|--------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | URL | Complete outage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | JWT (eyJ...) | Complete outage |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | JWT (eyJ...) | Server-side operations fail |
| `OPENAI_API_KEY` | Yes | sk-... | Letter generation fails |
| `STRIPE_SECRET_KEY` | Production | sk_... | Payment processing fails |
| `RESEND_API_KEY` | Production | re_... | Email delivery fails |
| `N8N_WEBHOOK_URL` | Optional | URL | Degraded letter generation |
| `KV_REST_API_URL` | Optional | URL | Rate limiting disabled |

---

## Escalation

### When to Escalate

Escalate if:
- Issue persists after 30 minutes
- Multiple quick fixes have failed
- Root cause is unclear
- External service outage suspected

### Escalation Contacts

1. **Vercel Support:** https://vercel.com/support
2. **Supabase Support:** https://supabase.com/support
3. **Team Lead:** [Contact info]
4. **CTO:** [Contact info]

### Escalation Template

```
Subject: P0 Incident - Production Outage - Environment Variable Issue

Summary:
- Incident started: [Time]
- Symptoms: [Description]
- Suspected cause: [Description]
- Steps taken: [List]
- Current status: [Description]
- Assistance needed: [Description]

Logs attached: [Yes/No]
```

---

## Post-Incident Review Template

Use this template for the post-incident review document:

```markdown
# Incident Report: [Date] - [Brief Description]

## Summary

- **Incident ID:** INC-YYYY-MM-DD-XXX
- **Severity:** P0 / P1 / P2
- **Status:** Resolved
- **Duration:** [X] minutes
- **Impact:** [Description]

## Timeline

- **[Time]** - Incident detected
- **[Time]** - Team notified
- **[Time]** - Root cause identified
- **[Time]** - Fix applied
- **[Time]** - Service restored
- **[Time]** - Incident closed

## Root Cause

[Detailed description of what caused the incident]

## Resolution

[Detailed description of how the incident was resolved]

## Impact

- **Users affected:** [Number/Percentage]
- **Services affected:** [List]
- **Revenue impact:** [If applicable]

## Lessons Learned

### What Went Well

- [Item 1]
- [Item 2]

### What Could Be Improved

- [Item 1]
- [Item 2]

## Action Items

- [ ] [Action 1] - Owner: [Name] - Due: [Date]
- [ ] [Action 2] - Owner: [Name] - Due: [Date]

## Prevention

[Description of measures taken to prevent recurrence]
```

---

**Last Updated:** February 15, 2026
**Owner:** Engineering Team
**Review Schedule:** After each environment-related incident
