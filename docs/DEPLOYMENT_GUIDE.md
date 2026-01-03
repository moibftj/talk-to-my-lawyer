# Deployment Guide

Complete guide for deploying Talk-To-My-Lawyer to production, including CI/CD, Vercel deployment, and monitoring.

---

## Table of Contents

1. [Production Deployment Checklist](#production-deployment-checklist)
2. [Vercel Deployment](#vercel-deployment)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Production Monitoring](#production-monitoring)
5. [Production Runbook](#production-runbook)

---

## Production Deployment Checklist

### Pre-Deployment Validation

#### Code Quality & Security
- [ ] All tests passing: `pnpm test`
- [ ] Linting clean: `pnpm lint`
- [ ] Security audit passed: `pnpm audit --audit-level=high`
- [ ] Build successful: `CI=1 pnpm build`
- [ ] No console errors or warnings in build output

#### Environment Configuration
- [ ] All required environment variables set in Vercel
- [ ] **STRIPE_SECRET_KEY** starts with `sk_live_` (not `sk_test_`)
- [ ] **STRIPE_WEBHOOK_SECRET** matches Stripe Dashboard production webhook
- [ ] **ADMIN_PORTAL_KEY** is secure and documented
- [ ] **OPENAI_API_KEY** has sufficient credits
- [ ] Email provider API keys are production-ready

#### Database Preparation
- [ ] Latest migrations applied: `pnpm db:migrate`
- [ ] Database backup completed
- [ ] RLS policies verified and tested
- [ ] Admin users configured with correct roles
- [ ] Test data removed from production database

#### Third-Party Services
- [ ] Stripe account verified and activated for live payments
- [ ] Webhook endpoints updated to production URLs
- [ ] Email provider domains verified (Resend/Brevo/SendGrid)
- [ ] Supabase project ready for production load
- [ ] Redis/Upstash configured and tested

### Deployment Process

#### 1. Final Code Review
- [ ] Code reviewed by at least one other developer
- [ ] All sensitive data removed from codebase
- [ ] No hardcoded secrets or test data
- [ ] Production configurations verified

#### 2. Staging Deployment (if applicable)
- [ ] Deploy to staging environment first
- [ ] Test complete user journey (signup → payment → letter generation)
- [ ] Verify admin dashboard functionality
- [ ] Test email delivery and templates
- [ ] Performance testing completed

#### 3. Production Deployment

```bash
# Deploy via git push (triggers Vercel deployment)
git add .
git commit -m "Production deployment - $(date)"
git push origin main
```

#### 4. Post-Deployment Verification
- [ ] Health check endpoint responding: `/api/health`
- [ ] Detailed health check passing: `/api/health/detailed`
- [ ] Admin portal accessible: `/secure-admin-gateway`
- [ ] Payment processing working (small test transaction)
- [ ] Letter generation functional
- [ ] Email delivery working

### Production Health Verification

#### Critical Path Testing

```bash
# Run production health check
pnpm health-check:production

# Test API endpoints
curl https://www.talk-to-my-lawyer.com/api/health
curl https://www.talk-to-my-lawyer.com/api/health/detailed
```

#### Manual Testing Checklist
- [ ] **User Registration**: New user can sign up successfully
- [ ] **Payment Processing**: Can complete checkout flow with real payment method
- [ ] **Letter Generation**: Can generate and submit letter for review
- [ ] **Admin Review**: Admin can access review dashboard and approve letters
- [ ] **Email Delivery**: Users receive email notifications
- [ ] **PDF Generation**: Letters can be downloaded as PDF

#### Performance Verification
- [ ] Page load times < 3 seconds
- [ ] API response times < 2 seconds
- [ ] Database queries < 500ms average
- [ ] No memory leaks or resource issues
- [ ] CDN and caching working properly

### Security Verification

#### Access Control
- [ ] Admin portal requires correct portal key
- [ ] User data isolation working (RLS)
- [ ] API rate limiting active
- [ ] CSRF protection enabled
- [ ] Input validation and sanitization working

#### Secrets Management
- [ ] All API keys stored securely in Vercel environment variables
- [ ] No secrets in git repository or logs
- [ ] Database connection strings secured
- [ ] Webhook secrets properly configured

### Post-Launch Monitoring (First 24 Hours)

#### Hour 1: Critical Monitoring
- [ ] Payment processing monitored continuously
- [ ] Error logs reviewed every 15 minutes
- [ ] System performance metrics watched
- [ ] User registration and activity tracked

#### Hour 6: System Stability
- [ ] No critical errors reported
- [ ] Performance metrics within acceptable ranges
- [ ] Email delivery functioning normally
- [ ] Database performance stable

#### Hour 24: Full System Review
- [ ] All services operating normally
- [ ] Customer support tickets reviewed
- [ ] Revenue tracking accurate
- [ ] No security incidents detected

### Rollback Plan (If Needed)

#### Emergency Rollback Procedure

```bash
# Via Vercel CLI
vercel rollback --app=talk-to-my-lawyer

# Via Vercel Dashboard
# Go to Deployments → Select previous version → Promote to Production
```

#### When to Consider Rollback
- Payment processing failure rate > 10%
- Critical functionality broken (letter generation, admin access)
- Security vulnerability discovered
- Database corruption detected
- Performance degradation > 50%

#### Post-Rollback Actions
- [ ] Investigate root cause
- [ ] Fix identified issues
- [ ] Re-test in staging
- [ ] Document lessons learned
- [ ] Plan re-deployment

---

## Vercel Deployment

### Prerequisites

Before deploying to Vercel, ensure you have:

- [ ] A Vercel account ([vercel.com](https://vercel.com))
- [ ] A Supabase project ([supabase.com](https://supabase.com))
- [ ] A Stripe account ([stripe.com](https://stripe.com))
- [ ] An OpenAI API key ([platform.openai.com](https://platform.openai.com))
- [ ] An email service account (Resend recommended)
- [ ] An Upstash Redis account for rate limiting

### Environment Variables Configuration

#### Required Variables for ALL Environments

| Variable | Description | Type |
|----------|-------------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Public |
| `OPENAI_API_KEY` | OpenAI API key | Secret |
| `NEXT_PUBLIC_SITE_URL` | Production site URL | Public |

#### Production-Only Variables

| Variable | Description | Type |
|----------|-------------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | **Secret** |
| `STRIPE_SECRET_KEY` | Stripe secret key | **Secret** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Public |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | **Secret** |
| `ADMIN_EMAIL` | Admin email address | Plain |
| `ADMIN_PORTAL_KEY` | Admin portal authentication | **Secret** |
| `CRON_SECRET` | Cron job authentication | **Secret** |

#### Email Configuration

| Variable | Description | Type |
|----------|-------------|------|
| `RESEND_API_KEY` | Resend API key (recommended) | Secret |
| `SENDGRID_API_KEY` | SendGrid API key (alternative) | Secret |
| `BREVO_API_KEY` | Brevo API key (alternative) | Secret |
| `EMAIL_FROM` | From email address | Plain |

#### Rate Limiting

| Variable | Description | Type |
|----------|-------------|------|
| `KV_REST_API_URL` | Upstash Redis URL | Secret |
| `KV_REST_API_TOKEN` | Upstash Redis token | Secret |

#### Test Mode Configuration

| Variable | Description | Value |
|----------|-------------|-------|
| `ENABLE_TEST_MODE` | Test mode toggle | **MUST be `"false"` in production** |

### Deploying to Vercel

#### Option 1: Connect Git Repository (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `pnpm build`
   - **Install Command**: `pnpm install`
4. Click **Deploy**

#### Option 2: Vercel CLI Deployment

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

### Post-Deployment Tasks

#### Database Setup
- [ ] Run database migrations: `pnpm db:migrate`
- [ ] Verify Row Level Security (RLS) policies are enabled
- [ ] Test database connections

#### Stripe Configuration
- [ ] Configure Stripe webhook endpoint: `https://yourdomain.com/api/stripe/webhook`
- [ ] Test webhook delivery with Stripe CLI
- [ ] Verify products and prices are configured

#### Email Delivery
- [ ] Send test email to verify configuration
- [ ] Check spam/junk folder settings
- [ ] Configure email domain authentication (SPF/DKIM)

#### Admin Access
- [ ] Create admin account using CLI script
- [ ] Test admin portal login at `/secure-admin-gateway/login`
- [ ] Verify admin dashboard loads correctly

#### Critical Functionality
- [ ] Test user registration and login
- [ ] Test subscription creation with Stripe test cards
- [ ] Test letter generation flow
- [ ] Test admin review workflow
- [ ] Verify rate limiting is active

#### Security Verification
- [ ] Confirm `ENABLE_TEST_MODE=false` in production
- [ ] Verify security headers are applied
- [ ] Test CSP headers with security scanner
- [ ] Check for exposed environment variables

### Troubleshooting

#### Build Failures

```bash
# Run locally to identify issues
pnpm build
```

**Solution**: Fix type errors before deploying. Do not disable `ignoreBuildErrors`.

#### Function Timeouts

**Issue**: AI generation timing out

**Solution**: `vercel.json` already configures extended timeouts:
- `/api/generate-letter`: 60 seconds
- `/api/stripe/webhook`: 30 seconds

#### Webhook Failures

**Solutions**:
1. Verify webhook secret matches Vercel environment variable
2. Check webhook endpoint is reachable
3. Review Stripe webhook delivery logs

---

## CI/CD Pipeline

### Overview

The CI/CD pipeline is implemented using GitHub Actions with three main workflows:

1. **`ci-cd.yml`** - Main CI/CD pipeline with build, test, and deployment
2. **`auto-pr.yml`** - Automated pull request creation for maintenance tasks
3. **`dependabot.yml`** - Automated dependency updates

### Main CI/CD Pipeline Jobs

#### 1. Lint & Type Check
- Runs ESLint for code quality
- Performs TypeScript type checking
- Continues on error to allow other jobs

#### 2. Build Application
- Builds Next.js application with CI=1
- Uses placeholder env vars for public variables
- Uploads build artifacts
- Depends on successful lint/type check

#### 3. Security Audit
- Runs `pnpm audit` for vulnerabilities
- Checks for outdated dependencies
- Continues on error

#### 4. Auto-fix & Commit
- Automatically fixes linting issues
- Commits and pushes fixes back to branch
- **Only runs on push to non-main branches**
- Skips CI with `[skip ci]` tag

#### 5. Deploy to Vercel
- Deploys to Vercel production
- **Only runs on pushes to `main` branch**
- Requires `VERCEL_TOKEN` secret
- Posts deployment status as commit comment

### Required GitHub Secrets

Add these secrets to Settings → Secrets and variables → Actions:

```
VERCEL_TOKEN          - Vercel deployment token
GITHUB_TOKEN          - Automatically provided by GitHub Actions
```

### Workflow Behavior

#### On Feature Branch Push
```
Lint → Build → Security Audit → Auto-fix & Commit
```

#### On Pull Request to Main
```
Lint → Build → Security Audit
```
(Auto-fix does not run on PRs)

#### On Push to Main
```
Lint → Build → Security Audit → Deploy to Vercel
```

#### Weekly (via Dependabot)
```
Check Dependencies → Create Grouped PRs
```

### Dependabot Configuration

#### Package Ecosystems Monitored

**npm/pnpm Dependencies**
- **Schedule**: Weekly on Mondays at 09:00 UTC
- **Max Open PRs**: 10

**GitHub Actions**
- **Schedule**: Weekly on Mondays at 09:00 UTC
- **Max Open PRs**: 5

#### Dependency Grouping

Dependencies are grouped to reduce PR noise:
- **radix-ui** - All Radix UI components
- **dev-dependencies** - All dev dependencies
- **react** - React and React-related packages
- **nextjs** - Next.js packages (patch only)
- **typescript** - TypeScript and type definitions
- **stripe** - Stripe packages
- **supabase** - Supabase packages
- **tailwind** - TailwindCSS packages
- **github-actions** - All GitHub Actions

---

## Production Monitoring

### Key Performance Indicators (KPIs)

#### Business Metrics
- **Monthly Recurring Revenue (MRR)**
- **Customer Acquisition Cost (CAC)**
- **Letter Generation Success Rate**
- **Payment Conversion Rate**
- **Customer Satisfaction Score**

#### Technical Metrics
- **API Response Times**
- **Database Query Performance**
- **Email Delivery Rate**
- **System Uptime**
- **Error Rates by Service**

### Alert Thresholds

#### Critical (Immediate Response Required)

```yaml
Payment Processing:
  - Payment failure rate > 5% in 1 hour
  - Stripe webhook failures > 10 in 15 minutes
  
System Health:
  - API response time > 5 seconds (95th percentile)
  - Database connection failures > 3 in 5 minutes
  - System error rate > 2% in 15 minutes

Security:
  - Failed admin login attempts > 5 in 15 minutes
  - Suspicious payment patterns detected
  - Rate limit threshold breached > 50% above normal
```

#### Warning (Monitor Closely)

```yaml
Performance:
  - API response time > 2 seconds (95th percentile)
  - Database query time > 1 second average
  - Email delivery rate < 95%

Business:
  - Letter generation failure rate > 10% in 1 hour
  - Customer support tickets increase > 200%
  - Daily active users drop > 20%
```

### Health Check Endpoints

```bash
# Basic health check
curl https://www.talk-to-my-lawyer.com/api/health

# Detailed system status
curl https://www.talk-to-my-lawyer.com/api/health/detailed

# Service-specific checks
curl https://www.talk-to-my-lawyer.com/api/health/stripe
curl https://www.talk-to-my-lawyer.com/api/health/database  
curl https://www.talk-to-my-lawyer.com/api/health/email
curl https://www.talk-to-my-lawyer.com/api/health/ai
```

---

## Production Runbook

### Emergency Contacts & Resources

- **Primary Domain**: https://www.talk-to-my-lawyer.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Stripe Dashboard**: https://dashboard.stripe.com

### Common Production Issues & Solutions

#### 1. Stripe Payment Failures

**Symptoms:**
- Users can't complete checkout
- 500 errors on payment processing
- Webhook failures

**Solutions:**
- Verify webhook endpoint URL in Stripe Dashboard
- Check `STRIPE_WEBHOOK_SECRET` matches dashboard
- Ensure `STRIPE_SECRET_KEY` starts with `sk_live_`
- Verify webhook events are enabled

#### 2. Admin Portal Access Issues

**Symptoms:**
- Can't access `/secure-admin-gateway`
- "Invalid portal key" errors
- Admin sessions timing out

**Solutions:**
- Verify `ADMIN_PORTAL_KEY` environment variable
- Check admin user has `role = 'admin'` in database
- Clear browser cookies and try again
- Check session timeout (30 minutes max)

#### 3. Letter Generation Failures

**Symptoms:**
- Letters stuck in "generating" status
- AI generation timeouts
- OpenAI API errors

**Solutions:**
- Verify `OPENAI_API_KEY` is valid and has credits
- Check rate limits in OpenAI dashboard
- Restart stuck letters: Update status from 'generating' to 'draft'
- Review AI prompt for content policy violations

#### 4. Email Delivery Issues

**Symptoms:**
- Users not receiving emails
- Email queue backing up
- Provider API failures

**Solutions:**
- Check email provider API keys
- Verify domain verification in email provider dashboard
- Process email queue manually: `POST /api/cron/process-email-queue`
- Switch to backup email provider if needed

### Regular Maintenance Tasks

#### Daily
- [ ] Check error logs
- [ ] Monitor payment processing
- [ ] Review email queue status

#### Weekly  
- [ ] Review performance metrics
- [ ] Check database growth
- [ ] Update security patches
- [ ] Test backup recovery

#### Monthly
- [ ] Rotate sensitive API keys
- [ ] Review user access permissions
- [ ] Update dependencies
- [ ] Capacity planning review

---

## Success Criteria

### Technical Success
- ✅ All health checks passing
- ✅ Zero critical errors in first hour
- ✅ Performance metrics within targets
- ✅ All integrations functioning

### Business Success  
- ✅ Payment processing working with real money
- ✅ Letter generation and approval workflow active
- ✅ Customer onboarding functional
- ✅ Admin operations running smoothly

### Operational Success
- ✅ Monitoring and alerting active
- ✅ Support processes ready
- ✅ Documentation complete
- ✅ Team prepared for production operations
