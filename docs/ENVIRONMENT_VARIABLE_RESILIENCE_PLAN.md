# Environment Variable Resilience Plan

## Executive Summary

This document outlines a comprehensive, multi-layered preventative strategy to avoid environment variable-related outages in the Talk-to-My-Lawyer production application. Drawing from veteran software engineering practices and the recent production incident, this plan implements defense-in-depth across validation, monitoring, documentation, and operational procedures.

**Incident Context:** On February 15, 2026, the production application experienced a complete outage due to a missing/incorrect `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variable, resulting in all routes returning 500 errors.

---

## Table of Contents

1. [Preventative Layers](#preventative-layers)
2. [Layer 1: Startup Validation](#layer-1-startup-validation)
3. [Layer 2: Runtime Health Monitoring](#layer-2-runtime-health-monitoring)
4. [Layer 3: Deployment Safeguards](#layer-3-deployment-safeguards)
5. [Layer 4: Documentation & Knowledge Management](#layer-4-documentation--knowledge-management)
6. [Layer 5: Operational Procedures](#layer-5-operational-procedures)
7. [Implementation Checklist](#implementation-checklist)
8. [Testing & Validation](#testing--validation)

---

## Preventative Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Operational Procedures                             │
│ • Deployment checklists • Incident response playbooks       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Documentation & Knowledge Management                │
│ • .env.example sync • Vercel variable inventory             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Deployment Safeguards                              │
│ • Pre-deploy validation • Smoke tests • Rollback triggers   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Runtime Health Monitoring                          │
│ • Continuous health checks • Alerting • Degradation         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Startup Validation                                 │
│ • Fail-fast on missing critical vars • Clear error messages │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Startup Validation

### Principle: Fail Fast, Fail Clearly

**Goal:** Detect missing or invalid environment variables **before** the application accepts any traffic.

### Implementation

#### 1.1. Environment Variable Schema

Create `lib/config/env-schema.ts`:

```typescript
import { z } from 'zod'

/**
 * Environment Variable Schema
 * 
 * Defines all required and optional environment variables with validation rules.
 * This schema is checked at application startup to prevent runtime failures.
 */

const envSchema = z.object({
  // ============================================================================
  // CRITICAL VARIABLES (Application will not start without these)
  // ============================================================================
  
  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(100, 'Anon key appears invalid (too short)'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(100, 'Service role key appears invalid'),
  
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().startsWith('sk-', 'Must start with sk-'),
  
  // ============================================================================
  // PRODUCTION-REQUIRED VARIABLES (Required when NODE_ENV === 'production')
  // ============================================================================
  
  // Stripe Configuration
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // Email Configuration
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  
  // Security
  CSRF_SECRET: z.string().min(32, 'Must be at least 32 characters').optional(),
  ADMIN_SESSION_SECRET: z.string().min(32, 'Must be at least 32 characters').optional(),
  CRON_SECRET: z.string().min(16, 'Must be at least 16 characters').optional(),
  
  // Rate Limiting
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  
  // ============================================================================
  // OPTIONAL VARIABLES (Application can run without these, but with degraded functionality)
  // ============================================================================
  
  // n8n Integration (fallback to OpenAI if missing)
  N8N_WEBHOOK_URL: z.string().url().optional(),
  N8N_WEBHOOK_AUTH_USER: z.string().optional(),
  N8N_WEBHOOK_AUTH_PASSWORD: z.string().optional(),
  
  // Legal Research APIs
  TAVILY_API_KEY: z.string().optional(),
  BING_SEARCH_API_KEY: z.string().optional(),
  
  // Monitoring
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  
  // Feature Flags
  ENABLE_TEST_MODE: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_TEST_MODE: z.enum(['true', 'false']).default('false'),
})

/**
 * Production-specific validation
 * 
 * In production, certain optional variables become required.
 */
function validateProductionEnv(env: z.infer<typeof envSchema>) {
  const isProduction = process.env.NODE_ENV === 'production'
  
  if (!isProduction) return { success: true, errors: [] }
  
  const errors: string[] = []
  
  // Stripe is required in production
  if (!env.STRIPE_SECRET_KEY) errors.push('STRIPE_SECRET_KEY is required in production')
  if (!env.STRIPE_WEBHOOK_SECRET) errors.push('STRIPE_WEBHOOK_SECRET is required in production')
  
  // Email is required in production
  if (!env.RESEND_API_KEY) errors.push('RESEND_API_KEY is required in production')
  if (!env.EMAIL_FROM) errors.push('EMAIL_FROM is required in production')
  
  // Security secrets are required in production
  if (!env.CSRF_SECRET) errors.push('CSRF_SECRET is required in production')
  if (!env.CRON_SECRET) errors.push('CRON_SECRET is required in production')
  
  // Rate limiting is strongly recommended in production
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
    console.warn('[ENV] WARNING: Rate limiting is not configured in production. This is a security risk.')
  }
  
  // Test mode must be disabled in production
  if (env.ENABLE_TEST_MODE === 'true') {
    errors.push('ENABLE_TEST_MODE must be "false" in production')
  }
  if (env.NEXT_PUBLIC_TEST_MODE === 'true') {
    errors.push('NEXT_PUBLIC_TEST_MODE must be "false" in production')
  }
  
  return { success: errors.length === 0, errors }
}

/**
 * Validate environment variables at application startup
 * 
 * This function is called in next.config.js to fail the build if env vars are invalid.
 */
export function validateEnv() {
  console.log('[ENV] Validating environment variables...')
  
  try {
    // Parse and validate schema
    const parsed = envSchema.parse(process.env)
    
    // Additional production validation
    const prodValidation = validateProductionEnv(parsed)
    
    if (!prodValidation.success) {
      console.error('[ENV] ❌ Production validation failed:')
      prodValidation.errors.forEach(err => console.error(`  - ${err}`))
      throw new Error('Production environment validation failed')
    }
    
    console.log('[ENV] ✅ Environment validation passed')
    
    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[ENV] ❌ Environment validation failed:')
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
      
      // In production, fail hard
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Critical environment variables are missing or invalid. Application cannot start.')
      }
      
      // In development, warn but continue
      console.warn('[ENV] ⚠️  Continuing in development mode with invalid environment')
    }
    
    throw error
  }
}

/**
 * Type-safe environment variable access
 * 
 * Use this instead of process.env to get type-checked environment variables.
 */
export const env = validateEnv()
```

#### 1.2. Integrate Validation into Build Process

Update `next.config.js`:

```javascript
const { validateEnv } = require('./lib/config/env-schema')

// Validate environment variables at build time
// This will fail the build if critical variables are missing
if (process.env.CI || process.env.NODE_ENV === 'production') {
  validateEnv()
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config
}

module.exports = nextConfig
```

#### 1.3. Runtime Startup Check

Create `lib/config/startup-check.ts`:

```typescript
/**
 * Startup Health Check
 * 
 * Performs critical checks before the application accepts traffic.
 * This runs on every serverless function cold start.
 */

import { createClient } from '@/lib/supabase/server'

export async function performStartupCheck(): Promise<{
  healthy: boolean
  errors: string[]
  warnings: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check 1: Supabase connectivity
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('profiles').select('id').limit(1)
    
    if (error) {
      errors.push(`Supabase connection failed: ${error.message}`)
    }
  } catch (error) {
    errors.push(`Supabase initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  // Check 2: OpenAI API key format
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey || !openaiKey.startsWith('sk-')) {
    errors.push('OPENAI_API_KEY is missing or invalid')
  }
  
  // Check 3: n8n availability (warning only, not critical)
  const n8nUrl = process.env.N8N_WEBHOOK_URL
  if (!n8nUrl) {
    warnings.push('N8N_WEBHOOK_URL not configured - will use OpenAI fallback only')
  }
  
  // Check 4: Rate limiting (warning only in non-production)
  const hasRateLimiting = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  if (!hasRateLimiting && process.env.NODE_ENV === 'production') {
    warnings.push('Rate limiting not configured - security risk in production')
  }
  
  return {
    healthy: errors.length === 0,
    errors,
    warnings
  }
}
```

---

## Layer 2: Runtime Health Monitoring

### Principle: Detect Degradation Early

**Goal:** Continuously monitor the health of critical services and alert before users are impacted.

### Implementation

#### 2.1. Enhanced Health Check Endpoint

Update `app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { performStartupCheck } from '@/lib/config/startup-check'
import { healthChecker } from '@/lib/monitoring/health-check'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Perform comprehensive health check
    const health = await healthChecker.checkHealth()
    
    // Also run startup check to verify environment
    const startupCheck = await performStartupCheck()
    
    // Combine results
    const combinedHealth = {
      ...health,
      environment: {
        healthy: startupCheck.healthy,
        errors: startupCheck.errors,
        warnings: startupCheck.warnings
      }
    }
    
    // Determine overall status
    const statusCode = 
      !startupCheck.healthy || health.status === 'unhealthy' ? 503 :
      health.status === 'degraded' ? 200 :
      200
    
    return NextResponse.json(combinedHealth, { status: statusCode })
  } catch (error) {
    console.error('[Health] Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}
```

#### 2.2. External Health Monitoring

**Recommended Services:**
- **UptimeRobot** (free tier): https://uptimerobot.com
- **Better Uptime**: https://betteruptime.com
- **Vercel Monitoring** (built-in)

**Configuration:**

1. **Create health check monitor:**
   - URL: `https://www.talk-to-my-lawyer.com/api/health`
   - Interval: 5 minutes
   - Alert on: HTTP 503 or timeout
   - Alert channels: Email, Slack, SMS

2. **Create critical endpoint monitors:**
   - `/api/generate-letter` (POST with auth)
   - `/dashboard` (authenticated)
   - `/secure-admin-gateway/login`

3. **Set up alert escalation:**
   - 1st failure: Log only
   - 2nd consecutive failure: Slack notification
   - 3rd consecutive failure: Email + SMS to on-call engineer

#### 2.3. Vercel Log Monitoring

Create `scripts/monitor-vercel-logs.sh`:

```bash
#!/bin/bash
# Monitor Vercel runtime logs for environment-related errors

# Requires: VERCEL_TOKEN environment variable

PROJECT_NAME="talk-to-my-lawyer"
TEAM_ID="moizs-projects-34494b93"

# Search for environment-related errors in the last hour
vercel logs $PROJECT_NAME --team $TEAM_ID --since 1h | \
  grep -E "environment|SUPABASE|OPENAI|STRIPE|missing|undefined|not configured" | \
  tee /tmp/vercel-env-errors.log

# If errors found, send alert
if [ -s /tmp/vercel-env-errors.log ]; then
  echo "⚠️  Environment-related errors detected in Vercel logs"
  # Send to monitoring service (e.g., Sentry, Slack webhook)
fi
```

---

## Layer 3: Deployment Safeguards

### Principle: Validate Before Deploy, Verify After Deploy

**Goal:** Catch environment issues before they reach production.

### Implementation

#### 3.1. Pre-Deployment Validation Script

Create `scripts/pre-deploy-check.sh`:

```bash
#!/bin/bash
# Pre-deployment validation script
# Run this before every production deployment

set -e

echo "🔍 Running pre-deployment checks..."

# Check 1: Validate .env.example is up to date
echo "Checking .env.example completeness..."
node scripts/validate-env-example.js

# Check 2: Verify Vercel environment variables
echo "Verifying Vercel environment variables..."
node scripts/verify-vercel-env.js

# Check 3: Run build locally
echo "Running production build..."
CI=1 pnpm build

# Check 4: Run tests
echo "Running test suite..."
pnpm test

# Check 5: Check for hardcoded secrets
echo "Scanning for hardcoded secrets..."
git diff --cached | grep -E "(sk-|pk_|whsec_|eyJ)" && {
  echo "❌ Potential secrets detected in commit!"
  exit 1
} || echo "✅ No secrets detected"

echo "✅ All pre-deployment checks passed"
```

#### 3.2. Vercel Environment Variable Verification

Create `scripts/verify-vercel-env.js`:

```javascript
#!/usr/bin/env node
/**
 * Verify Vercel Environment Variables
 * 
 * Checks that all required environment variables are set in Vercel.
 * Requires VERCEL_TOKEN environment variable.
 */

const { execSync } = require('child_process')
const fs = require('fs')

// Parse .env.example to get required variables
const envExample = fs.readFileSync('.env.example', 'utf8')
const requiredVars = []

envExample.split('\n').forEach(line => {
  // Skip comments and empty lines
  if (line.trim().startsWith('#') || !line.trim()) return
  
  // Extract variable name
  const match = line.match(/^([A-Z_]+)=/)
  if (match) {
    const varName = match[1]
    
    // Check if it's marked as required
    const isRequired = 
      line.includes('REQUIRED') ||
      line.includes('Required') ||
      envExample.includes(`${varName} is required`)
    
    if (isRequired) {
      requiredVars.push(varName)
    }
  }
})

console.log(`Found ${requiredVars.length} required environment variables`)

// Fetch Vercel environment variables
try {
  const output = execSync(
    'vercel env ls production --json',
    { encoding: 'utf8' }
  )
  
  const vercelEnv = JSON.parse(output)
  const vercelVarNames = vercelEnv.map(v => v.key)
  
  // Check for missing variables
  const missing = requiredVars.filter(v => !vercelVarNames.includes(v))
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables in Vercel:')
    missing.forEach(v => console.error(`  - ${v}`))
    process.exit(1)
  }
  
  console.log('✅ All required environment variables are set in Vercel')
} catch (error) {
  console.error('Failed to verify Vercel environment variables:', error.message)
  console.warn('⚠️  Skipping Vercel environment check (VERCEL_TOKEN may not be set)')
}
```

#### 3.3. Post-Deployment Smoke Tests

Create `scripts/post-deploy-smoke-test.sh`:

```bash
#!/bin/bash
# Post-deployment smoke tests
# Run immediately after deployment to verify critical functionality

SITE_URL="${1:-https://www.talk-to-my-lawyer.com}"

echo "🧪 Running post-deployment smoke tests on $SITE_URL"

# Test 1: Health endpoint
echo "Testing /api/health..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/api/health")
if [ "$HEALTH_STATUS" != "200" ]; then
  echo "❌ Health check failed with status $HEALTH_STATUS"
  exit 1
fi
echo "✅ Health check passed"

# Test 2: Homepage loads
echo "Testing homepage..."
HOME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL")
if [ "$HOME_STATUS" != "200" ]; then
  echo "❌ Homepage failed with status $HOME_STATUS"
  exit 1
fi
echo "✅ Homepage loads"

# Test 3: Login page loads
echo "Testing login page..."
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/auth/login")
if [ "$LOGIN_STATUS" != "200" ]; then
  echo "❌ Login page failed with status $LOGIN_STATUS"
  exit 1
fi
echo "✅ Login page loads"

# Test 4: API responds (without auth)
echo "Testing API responsiveness..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL/api/generate-letter")
# Should return 401 (unauthorized) or 405 (method not allowed), not 500
if [ "$API_STATUS" = "500" ]; then
  echo "❌ API returning 500 errors"
  exit 1
fi
echo "✅ API is responsive"

echo "✅ All smoke tests passed"
```

#### 3.4. Automated Rollback Trigger

Create `.github/workflows/auto-rollback.yml`:

```yaml
name: Auto Rollback on Health Check Failure

on:
  deployment_status:

jobs:
  health-check:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Wait for deployment to stabilize
        run: sleep 30
      
      - name: Run smoke tests
        run: |
          bash scripts/post-deploy-smoke-test.sh ${{ github.event.deployment_status.target_url }}
      
      - name: Trigger rollback on failure
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.repos.createDeployment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              ref: '${{ github.event.deployment_status.deployment.sha }}~1',
              environment: 'production',
              description: 'Auto-rollback due to health check failure'
            })
```

---

## Layer 4: Documentation & Knowledge Management

### Principle: Single Source of Truth

**Goal:** Ensure `.env.example` is always accurate and Vercel configuration is documented.

### Implementation

#### 4.1. Automated .env.example Sync Check

Create `scripts/validate-env-example.js`:

```javascript
#!/usr/bin/env node
/**
 * Validate .env.example Completeness
 * 
 * Ensures that all environment variables used in the codebase are documented
 * in .env.example.
 */

const fs = require('fs')
const { execSync } = require('child_process')

// Find all environment variable references in the codebase
const envRefs = new Set()

// Search for process.env.* references
const grepOutput = execSync(
  'grep -roh "process\\.env\\.[A-Z_]*" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" .',
  { encoding: 'utf8', cwd: process.cwd() }
)

grepOutput.split('\n').forEach(line => {
  const match = line.match(/process\.env\.([A-Z_]+)/)
  if (match) {
    envRefs.add(match[1])
  }
})

// Parse .env.example
const envExample = fs.readFileSync('.env.example', 'utf8')
const documentedVars = new Set()

envExample.split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=/)
  if (match) {
    documentedVars.add(match[1])
  }
})

// Find undocumented variables
const undocumented = [...envRefs].filter(v => 
  !documentedVars.has(v) &&
  !v.startsWith('VERCEL_') &&  // Vercel auto-provides these
  !v.startsWith('NODE_') &&    // Node.js built-ins
  v !== 'CI'                    // Common CI variable
)

if (undocumented.length > 0) {
  console.error('❌ Environment variables used in code but not documented in .env.example:')
  undocumented.forEach(v => console.error(`  - ${v}`))
  process.exit(1)
}

console.log('✅ All environment variables are documented in .env.example')
```

#### 4.2. Vercel Environment Variable Inventory

Create `docs/VERCEL_ENV_INVENTORY.md`:

```markdown
# Vercel Environment Variable Inventory

**Last Updated:** [Auto-generated date]

This document provides a complete inventory of all environment variables configured in Vercel for the Talk-to-My-Lawyer project.

## Critical Variables (Required for Application to Start)

| Variable | Environments | Sensitive | Last Updated | Notes |
|----------|--------------|-----------|--------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | All | No | 2026-01-20 | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Yes | 2026-02-15 | **CRITICAL:** Missing this causes 500 errors |
| `SUPABASE_SERVICE_ROLE_KEY` | All | Yes | 2026-01-20 | Server-side Supabase access |
| `OPENAI_API_KEY` | All | Yes | 2026-01-20 | Required for letter generation fallback |

## Production-Required Variables

| Variable | Environments | Sensitive | Last Updated | Notes |
|----------|--------------|-----------|--------------|-------|
| `STRIPE_SECRET_KEY` | Production | Yes | 2026-01-20 | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Production | Yes | 2026-01-20 | Webhook signature verification |
| `RESEND_API_KEY` | Production | Yes | 2026-01-20 | Email delivery |
| `CSRF_SECRET` | Production | Yes | 2026-01-20 | CSRF token signing |
| `CRON_SECRET` | Production | Yes | 2026-01-20 | Cron job authentication |

## Optional Variables (Graceful Degradation)

| Variable | Environments | Sensitive | Last Updated | Notes |
|----------|--------------|-----------|--------------|-------|
| `N8N_WEBHOOK_URL` | All | No | 2026-02-14 | Primary letter generation method |
| `N8N_WEBHOOK_AUTH_USER` | All | No | 2026-02-14 | n8n webhook authentication |
| `N8N_WEBHOOK_AUTH_PASSWORD` | All | Yes | 2026-02-14 | n8n webhook authentication |
| `KV_REST_API_URL` | All | No | 2026-01-20 | Rate limiting (Upstash Redis) |
| `KV_REST_API_TOKEN` | All | Yes | 2026-01-20 | Rate limiting (Upstash Redis) |

## Verification Commands

```bash
# List all production environment variables
vercel env ls production

# Pull production environment variables to .env.local (for local testing)
vercel env pull .env.local --environment=production

# Add a new environment variable
vercel env add VARIABLE_NAME production

# Remove an environment variable
vercel env rm VARIABLE_NAME production
```

## Incident Response

If the application is returning 500 errors on all routes:

1. **Check Supabase variables first:**
   ```bash
   vercel env ls production | grep SUPABASE
   ```

2. **Verify the anon key is set:**
   ```bash
   vercel env get NEXT_PUBLIC_SUPABASE_ANON_KEY production
   ```

3. **If missing, set it immediately:**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   # Paste the key when prompted
   ```

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

## Maintenance Schedule

- **Quarterly:** Rotate all sensitive keys (CSRF_SECRET, CRON_SECRET, etc.)
- **Monthly:** Review this inventory and update "Last Updated" dates
- **After each deployment:** Verify critical variables are still set
```

#### 4.3. Runbook for Environment Variable Incidents

Create `docs/runbooks/ENV_VAR_INCIDENT_RESPONSE.md`:

```markdown
# Environment Variable Incident Response Runbook

## Symptoms

- ✅ **All routes returning 500 errors**
- ✅ **Health check endpoint failing**
- ✅ **Dashboard not loading**
- ✅ **API timeouts or 405 errors**
- ✅ **"Internal Server Error" on homepage**

## Diagnosis

### Step 1: Check Health Endpoint

```bash
curl https://www.talk-to-my-lawyer.com/api/health
```

**Expected:** `{"status": "healthy", ...}`
**If 500:** Environment variable issue confirmed

### Step 2: Check Vercel Logs

```bash
vercel logs talk-to-my-lawyer --prod --since 10m
```

Look for:
- `environment`
- `SUPABASE`
- `OPENAI`
- `missing`
- `undefined`
- `not configured`

### Step 3: Verify Critical Variables

```bash
vercel env ls production | grep -E "SUPABASE|OPENAI"
```

**Must see:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## Resolution

### Quick Fix (5 minutes)

1. **Set missing variable in Vercel:**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   ```

2. **Verify it's set:**
   ```bash
   vercel env get NEXT_PUBLIC_SUPABASE_ANON_KEY production
   ```

3. **Trigger redeploy:**
   ```bash
   git commit --allow-empty -m "chore: trigger redeploy"
   git push origin main
   ```

4. **Wait 2-3 minutes for deployment**

5. **Verify health:**
   ```bash
   curl https://www.talk-to-my-lawyer.com/api/health
   ```

### If Quick Fix Doesn't Work

1. **Check for typos in variable names:**
   - Vercel is case-sensitive
   - No trailing spaces
   - Correct prefix (`NEXT_PUBLIC_` for client-side)

2. **Verify the value is correct:**
   - Anon key should start with `eyJ`
   - Service role key should start with `eyJ`
   - OpenAI key should start with `sk-`

3. **Check deployment status:**
   ```bash
   vercel ls talk-to-my-lawyer
   ```

4. **If deployment failed, check build logs:**
   ```bash
   vercel logs talk-to-my-lawyer --build
   ```

## Prevention

After resolving the incident:

1. **Update inventory:**
   - Document what was missing
   - Update `docs/VERCEL_ENV_INVENTORY.md`

2. **Add to monitoring:**
   - Create alert for this specific variable
   - Add to pre-deploy checklist

3. **Conduct post-mortem:**
   - Why was the variable missing?
   - How can we prevent this?
   - Update this runbook with lessons learned

## Escalation

If the issue persists after 30 minutes:

1. **Contact Vercel Support:** https://vercel.com/support
2. **Check Vercel Status:** https://www.vercel-status.com
3. **Consider rollback to last known good deployment**
```

---

## Layer 5: Operational Procedures

### Principle: Checklists Prevent Errors

**Goal:** Standardize deployment and maintenance procedures to prevent human error.

### Implementation

#### 5.1. Deployment Checklist

Create `docs/checklists/DEPLOYMENT_CHECKLIST.md`:

```markdown
# Production Deployment Checklist

**Before every production deployment, complete this checklist.**

## Pre-Deployment (30 minutes before)

- [ ] Run `pnpm validate-env` locally
- [ ] Run `scripts/pre-deploy-check.sh`
- [ ] Verify all tests pass: `pnpm test`
- [ ] Review `docs/VERCEL_ENV_INVENTORY.md` for recent changes
- [ ] Check Vercel dashboard for any pending alerts
- [ ] Notify team in #deployments Slack channel

## Deployment

- [ ] Merge PR to `main` branch
- [ ] Monitor Vercel build logs for errors
- [ ] Wait for deployment to complete (2-3 minutes)
- [ ] Check deployment status: `vercel ls talk-to-my-lawyer`

## Post-Deployment (immediately after)

- [ ] Run `scripts/post-deploy-smoke-test.sh`
- [ ] Check health endpoint: `curl https://www.talk-to-my-lawyer.com/api/health`
- [ ] Test critical user flows:
  - [ ] Homepage loads
  - [ ] Login works
  - [ ] Dashboard loads
  - [ ] Letter generation works (create test letter)
- [ ] Monitor Vercel logs for 10 minutes: `vercel logs --follow`
- [ ] Check error rate in Sentry (if configured)
- [ ] Update #deployments Slack channel with status

## Rollback Procedure (if issues detected)

- [ ] Identify last known good deployment
- [ ] Revert to previous commit: `git revert HEAD`
- [ ] Push to `main`: `git push origin main`
- [ ] Monitor new deployment
- [ ] Document incident in `docs/incidents/YYYY-MM-DD-description.md`

## Environment Variable Changes

If this deployment includes environment variable changes:

- [ ] Update `docs/VERCEL_ENV_INVENTORY.md`
- [ ] Verify new variables are set in Vercel: `vercel env ls production`
- [ ] Test locally with production-like environment: `vercel env pull .env.local --environment=production`
- [ ] Document changes in PR description
- [ ] Add to team knowledge base

## Sign-Off

- **Deployed by:** _______________
- **Date/Time:** _______________
- **Deployment ID:** _______________
- **Status:** ✅ Success / ❌ Rolled Back
```

#### 5.2. Quarterly Maintenance Checklist

Create `docs/checklists/QUARTERLY_MAINTENANCE.md`:

```markdown
# Quarterly Maintenance Checklist

**Perform these tasks every quarter (every 3 months).**

## Environment Variable Audit

- [ ] Review `docs/VERCEL_ENV_INVENTORY.md`
- [ ] Verify all variables are still in use
- [ ] Remove deprecated variables
- [ ] Update "Last Updated" dates

## Secret Rotation

- [ ] Generate new `CSRF_SECRET`: `openssl rand -hex 32`
- [ ] Generate new `ADMIN_SESSION_SECRET`: `openssl rand -hex 32`
- [ ] Generate new `CRON_SECRET`: `openssl rand -hex 32`
- [ ] Update in Vercel: `vercel env add CSRF_SECRET production`
- [ ] Deploy and verify
- [ ] Document rotation in security log

## Dependency Updates

- [ ] Update Next.js: `pnpm update next`
- [ ] Update Supabase client: `pnpm update @supabase/supabase-js`
- [ ] Update OpenAI SDK: `pnpm update openai`
- [ ] Run tests: `pnpm test`
- [ ] Deploy to staging first, then production

## Documentation Review

- [ ] Review and update `README.md`
- [ ] Review and update `.env.example`
- [ ] Review and update all runbooks in `docs/runbooks/`
- [ ] Review and update deployment checklists

## Monitoring Review

- [ ] Review UptimeRobot alerts (if configured)
- [ ] Review Sentry error trends (if configured)
- [ ] Review Vercel analytics
- [ ] Adjust alert thresholds if needed

## Team Knowledge Transfer

- [ ] Conduct deployment walkthrough with new team members
- [ ] Update incident response contacts
- [ ] Review and update escalation procedures
```

#### 5.3. New Team Member Onboarding

Create `docs/onboarding/ENVIRONMENT_SETUP.md`:

```markdown
# Environment Setup for New Team Members

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/moibftj/talk-to-my-lawyer.git
cd talk-to-my-lawyer
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

```bash
# Copy example file
cp .env.example .env.local

# Pull production variables (requires Vercel access)
vercel env pull .env.local --environment=production

# OR manually fill in .env.local with development values
```

### 4. Verify Environment

```bash
pnpm validate-env
```

### 5. Start Development Server

```bash
pnpm dev
```

### 6. Verify Setup

- [ ] Homepage loads at http://localhost:3000
- [ ] Health check passes: http://localhost:3000/api/health
- [ ] No console errors in browser
- [ ] Can create test letter (with test mode enabled)

## Vercel Access Setup

### 1. Request Access

Ask team lead to invite you to:
- Vercel team: `moizs-projects-34494b93`
- Project: `talk-to-my-lawyer`

### 2. Install Vercel CLI

```bash
pnpm add -g vercel
```

### 3. Login

```bash
vercel login
```

### 4. Link Project

```bash
vercel link
```

## Required Reading

Before making your first deployment, read:

1. `docs/VERCEL_ENV_INVENTORY.md` - Environment variable reference
2. `docs/checklists/DEPLOYMENT_CHECKLIST.md` - Deployment procedure
3. `docs/runbooks/ENV_VAR_INCIDENT_RESPONSE.md` - Incident response
4. `docs/ENVIRONMENT_VARIABLE_RESILIENCE_PLAN.md` - This document

## Emergency Contacts

- **On-Call Engineer:** [Phone/Slack]
- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support

## Questions?

Ask in #engineering Slack channel or contact [Team Lead Name].
```

---

## Implementation Checklist

Use this checklist to implement the preventative measures plan:

### Phase 1: Immediate (Week 1)

- [ ] Create `lib/config/env-schema.ts` with validation
- [ ] Integrate validation into `next.config.js`
- [ ] Update `app/api/health/route.ts` with enhanced checks
- [ ] Create `docs/VERCEL_ENV_INVENTORY.md`
- [ ] Create `docs/runbooks/ENV_VAR_INCIDENT_RESPONSE.md`
- [ ] Set up UptimeRobot monitoring (free tier)

### Phase 2: Short-term (Week 2-3)

- [ ] Create `scripts/pre-deploy-check.sh`
- [ ] Create `scripts/post-deploy-smoke-test.sh`
- [ ] Create `scripts/validate-env-example.js`
- [ ] Create `scripts/verify-vercel-env.js`
- [ ] Add pre-commit hook to run validation
- [ ] Create deployment checklist
- [ ] Document in team wiki

### Phase 3: Medium-term (Month 1-2)

- [ ] Set up automated smoke tests in CI/CD
- [ ] Create `.github/workflows/auto-rollback.yml`
- [ ] Set up Sentry error tracking (if not already)
- [ ] Create quarterly maintenance checklist
- [ ] Conduct team training on new procedures
- [ ] Create onboarding documentation

### Phase 4: Long-term (Ongoing)

- [ ] Review and update documentation quarterly
- [ ] Rotate secrets quarterly
- [ ] Conduct incident response drills
- [ ] Gather feedback and improve procedures
- [ ] Share lessons learned with team

---

## Testing & Validation

### Test Scenario 1: Missing Critical Variable

**Setup:**
1. Remove `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Vercel
2. Trigger deployment

**Expected:**
- Build fails with clear error message
- Deployment does not reach production
- Team is alerted

### Test Scenario 2: Invalid Variable Value

**Setup:**
1. Set `OPENAI_API_KEY` to invalid value (e.g., `sk-invalid`)
2. Trigger deployment

**Expected:**
- Validation catches invalid format
- Build fails or health check fails
- Clear error message indicates which variable is invalid

### Test Scenario 3: Degraded Service

**Setup:**
1. Remove `N8N_WEBHOOK_URL` (optional variable)
2. Trigger deployment

**Expected:**
- Deployment succeeds
- Health check shows warning
- Letter generation falls back to OpenAI
- No user-facing errors

### Test Scenario 4: Post-Deployment Health Check

**Setup:**
1. Deploy with all variables correct
2. Run smoke tests

**Expected:**
- All smoke tests pass
- Health endpoint returns 200
- Critical user flows work
- No alerts triggered

---

## Metrics & Success Criteria

Track these metrics to measure the effectiveness of the preventative measures:

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| **Environment-related incidents** | 0 per quarter | - | Track in incident log |
| **Deployment success rate** | >99% | - | Vercel analytics |
| **Health check uptime** | >99.9% | - | UptimeRobot |
| **Mean time to detect (MTTD)** | <5 minutes | - | From incident to alert |
| **Mean time to resolve (MTTR)** | <15 minutes | - | From alert to resolution |
| **Pre-deploy check failures** | >0 (catching issues) | - | CI/CD logs |

---

## Conclusion

This multi-layered preventative strategy provides defense-in-depth against environment variable-related outages. By implementing validation at build time, monitoring at runtime, and standardizing operational procedures, we significantly reduce the risk of production incidents.

**Key Takeaways:**

1. **Fail Fast:** Catch issues at build time, not runtime
2. **Monitor Continuously:** Detect degradation before users are impacted
3. **Automate Validation:** Remove human error from the equation
4. **Document Everything:** Ensure knowledge is shared and accessible
5. **Practice Procedures:** Regular drills and reviews keep the team prepared

**Next Steps:**

1. Review this plan with the engineering team
2. Prioritize implementation phases
3. Assign owners for each task
4. Schedule quarterly reviews
5. Conduct first incident response drill

---

**Document Version:** 1.0
**Last Updated:** February 15, 2026
**Owner:** Engineering Team
**Review Schedule:** Quarterly
