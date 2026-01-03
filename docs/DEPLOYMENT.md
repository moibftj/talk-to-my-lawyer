# Deployment Guide - Talk-To-My-Lawyer

Complete deployment guide covering CI/CD pipeline, Vercel deployment, and production configuration.

## Table of Contents

1. [CI/CD Pipeline](#cicd-pipeline)
2. [Vercel Deployment](#vercel-deployment)
3. [Environment Configuration](#environment-configuration)
4. [Post-Deployment Checklist](#post-deployment-checklist)
5. [Monitoring](#monitoring)
6. [Troubleshooting](#troubleshooting)

---

## CI/CD Pipeline

### Overview

The project uses GitHub Actions for continuous integration and automated deployment. The pipeline runs on every push to `main` and on pull requests.

### Workflows

#### Main CI/CD Pipeline (`ci-cd.yml`)

**Triggers**: Push to any branch, PR to main

| Job | When | Purpose |
|-----|------|---------|
| Lint & Type Check | Always | Code quality validation |
| Build | After lint | Next.js build verification |
| Security Audit | Parallel | Dependency vulnerability check |
| Auto-fix | Non-main branches | Auto-fix and commit linting issues |
| Deploy | Main branch only | Deploy to Vercel production |

#### Auto PR Workflow (`auto-pr.yml`)

**Triggers**: Manual dispatch

- Fixes linting and creates a PR
- Useful for bulk maintenance
- Go to Actions → Auto Create PR → Run workflow

#### Dependabot (`dependabot.yml`)

**Triggers**: Weekly (Mondays 09:00 UTC)

- Automatically creates PRs for dependency updates
- Groups related dependencies
- Review and merge as needed

### Required GitHub Secrets

Add these in **Settings → Secrets and variables → Actions**:

#### Application Secrets
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
OPENAI_API_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ADMIN_EMAIL
ADMIN_PORTAL_KEY
CRON_SECRET
KV_REST_API_URL
KV_REST_API_TOKEN
RESEND_API_KEY
```

#### Vercel Deployment Secrets
```
VERCEL_TOKEN          # From https://vercel.com/account/tokens
VERCEL_ORG_ID         # From vercel.json or project settings
VERCEL_PROJECT_ID     # From .vercel/project.json
```

### Workflow Behavior

**On Feature Branch Push:**
1. Lint & Type Check runs
2. Build runs (if lint passes)
3. Security Audit runs
4. Auto-fix runs and commits fixes (if any)

**On Pull Request to Main:**
1. Lint & Type Check runs
2. Build runs (if lint passes)
3. Security Audit runs
4. Auto-fix does NOT run (to avoid permission issues)

**On Push to Main:**
1. Lint & Type Check runs
2. Build runs (if lint passes)
3. Security Audit runs
4. Deploy to Vercel runs (if all pass)
5. Deployment status posted as commit comment

---

## Vercel Deployment

### Prerequisites

- Vercel account ([vercel.com](https://vercel.com))
- GitHub repository connected to Vercel
- All required environment variables prepared

### Deployment Methods

#### Option 1: Git Integration (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `pnpm build`
   - **Install Command**: `pnpm install`
4. Add environment variables (see below)
5. Click **Deploy**

#### Option 2: Vercel CLI

```bash
# Install Vercel CLI
pnpm add -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## Environment Configuration

### Production Environment Variables

Configure in **Vercel Dashboard → Settings → Environment Variables**

#### Required for ALL Environments

| Variable | Type | Example |
|----------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | https://xxx.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | eyJhbGc... |
| `OPENAI_API_KEY` | Secret | sk-proj-... |
| `NEXT_PUBLIC_SITE_URL` | Public | https://www.talk-to-my-lawyer.com |

#### Production-Only Variables

| Variable | Type | Notes |
|----------|------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Full database access |
| `STRIPE_SECRET_KEY` | **Secret** | Must start with `sk_live_` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | pk_live_... |
| `STRIPE_WEBHOOK_SECRET` | **Secret** | From Stripe Dashboard |
| `ADMIN_PORTAL_KEY` | **Secret** | Generate with `openssl rand -hex 32` |
| `CRON_SECRET` | **Secret** | For cron job authentication |

#### Email Configuration

| Variable | Type | Notes |
|----------|------|-------|
| `EMAIL_PROVIDER` | Plain | resend, brevo, sendgrid, smtp |
| `RESEND_API_KEY` | Secret | Recommended provider |
| `EMAIL_FROM` | Plain | noreply@talk-to-my-lawyer.com |
| `EMAIL_FROM_NAME` | Plain | Talk-To-My-Lawyer |

#### Rate Limiting (Required)

| Variable | Type | Source |
|----------|------|--------|
| `KV_REST_API_URL` | Secret | Upstash Dashboard |
| `KV_REST_API_TOKEN` | Secret | Upstash Dashboard |

#### Critical Configuration

| Variable | Value | Importance |
|----------|-------|------------|
| `ENABLE_TEST_MODE` | **`false`** | **MUST** be false in production |

### Environment Scopes

| Scope | Description | Use For |
|-------|-------------|---------|
| **Production** | Main deployment | Live site |
| **Preview** | PR deployments | Testing |
| **Development** | Branch deployments | Dev testing |

---

## Post-Deployment Checklist

### Database Setup

- [ ] Run database migrations: `pnpm db:migrate`
- [ ] Verify Row Level Security (RLS) policies enabled
- [ ] Test database connections
- [ ] Create backup

### Stripe Configuration

- [ ] Configure webhook: `https://yourdomain.com/api/stripe/webhook`
- [ ] Test webhook delivery
- [ ] Verify products and prices
- [ ] Enable domain for Stripe Checkout

### Email Delivery

- [ ] Send test email
- [ ] Configure domain authentication (SPF/DKIM)
- [ ] Check spam folder settings

### Admin Access

- [ ] Create admin account: `npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password>`
- [ ] Test admin portal login at `/secure-admin-gateway/login`
- [ ] Verify dashboard loads

### Critical Functionality Tests

- [ ] User registration and login
- [ ] Subscription creation with Stripe
- [ ] Letter generation flow
- [ ] Admin review workflow
- [ ] Rate limiting active
- [ ] Email delivery working

### Security Verification

- [ ] Confirm `ENABLE_TEST_MODE=false` in production
- [ ] Verify security headers applied
- [ ] Test CSP headers
- [ ] Check for exposed environment variables
- [ ] Verify HTTPS enabled

---

## Monitoring

### Vercel Built-in Monitoring

Access via **Vercel Dashboard → Analytics**:

| Metric | Description |
|--------|-------------|
| **Page Views** | Total views and unique visitors |
| **Core Web Vitals** | LCP, FID, CLS scores |
| **Function Duration** | Serverless function execution time |
| **Error Rate** | Failed requests and errors |
| **Build Status** | Deployment success/failure |

### Health Check Endpoints

```bash
# Basic health check
curl https://www.talk-to-my-lawyer.com/api/health

# Detailed system status
curl https://www.talk-to-my-lawyer.com/api/health/detailed
```

### Log Management

- **Vercel Dashboard**: Your Project → Logs
- **Vercel CLI**: `vercel logs`
- **Real-time**: `vercel logs --follow`

---

## Troubleshooting

### Build Failures

**Issue**: TypeScript build errors

```bash
# Run locally to identify issues
pnpm build
```

**Solution**: Fix type errors before deploying. Do not disable `ignoreBuildErrors`.

### Function Timeouts

**Issue**: AI generation timing out

**Solution**: `vercel.json` already configures extended timeouts:
- `/api/generate-letter`: 60 seconds
- `/api/stripe/webhook`: 30 seconds

### Webhook Failures

**Issue**: Stripe webhooks not received

**Solutions**:
1. Verify webhook secret matches Vercel environment variable
2. Check endpoint is reachable: `curl https://yourdomain.com/api/stripe/webhook`
3. Review Stripe webhook delivery logs

### Environment Variables Not Available

**Issue**: `process.env.VARIABLE` is undefined

**Solutions**:
1. Ensure variable is added to Vercel project settings
2. Check variable name matches exactly (case-sensitive)
3. Redeploy after adding new variables

### Deployment Protection

**Issue**: Preview deployments publicly accessible

**Solutions**:
1. Enable Vercel Authentication for preview deployments
2. Password-protect staging environments
3. IP whitelist admin endpoints if needed

---

## Production Deployment Workflow

### 1. Pre-Deployment

```bash
# Run tests locally
pnpm lint
CI=1 pnpm build
pnpm validate-env

# Check security
pnpm audit --audit-level=high
```

### 2. Staging Deployment

```bash
# Deploy to staging branch
git checkout -b staging
git push origin staging
vercel --env=staging
```

### 3. Production Promotion

```bash
# Merge staging to main
git checkout main
git merge staging
git push origin main
# Vercel auto-deploys main branch
```

### 4. Rollback Procedure

If issues occur:

**Via Vercel Dashboard**:
1. Go to Deployments
2. Find previous successful deployment
3. Click "Promote to Production"

**Via CLI**:
```bash
vercel rollback
```

---

## Quick Reference

### Deploy to Production

```bash
git push origin main
# Automatic deployment triggered
# Check Actions tab for status
```

### Check Deployment Status

1. Go to Actions tab
2. Click on latest workflow run
3. Check "Deploy to Vercel" job
4. See deployment URL in job output

### Manual Trigger Auto-fix

```bash
# Go to GitHub Actions → Auto Create PR → Run workflow
```

### Review Dependency Updates

1. Dependabot creates PRs weekly
2. Review changes in PR
3. CI runs automatically
4. Merge when ready

---

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Last Updated**: January 2026  
**Version**: Production CI/CD v2.0
