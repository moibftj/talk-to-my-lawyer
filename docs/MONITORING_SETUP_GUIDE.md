# Monitoring & Alerting Setup Guide

This guide provides step-by-step instructions for setting up comprehensive monitoring and alerting for the Talk-to-My-Lawyer application, with a focus on detecting environment variable issues before they cause outages.

---

## Overview

The monitoring strategy consists of three layers:

1. **External Uptime Monitoring** - Detects when the site is down
2. **Health Check Monitoring** - Detects environment and service issues
3. **Error Tracking** - Captures and alerts on application errors

---

## Layer 1: External Uptime Monitoring

### Option A: UptimeRobot (Recommended - Free Tier Available)

**Why UptimeRobot:**
- Free tier includes 50 monitors
- 5-minute check intervals
- Email and Slack alerts
- Public status pages
- No credit card required

**Setup Steps:**

1. **Create Account:**
   - Go to https://uptimerobot.com
   - Sign up with your work email

2. **Create Health Check Monitor:**
   - Click "Add New Monitor"
   - Monitor Type: HTTP(s)
   - Friendly Name: `Talk-to-My-Lawyer - Health Check`
   - URL: `https://www.talk-to-my-lawyer.com/api/health`
   - Monitoring Interval: 5 minutes
   - Monitor Timeout: 30 seconds
   - Alert Contacts: Add your email and Slack webhook

3. **Create Homepage Monitor:**
   - Monitor Type: HTTP(s)
   - Friendly Name: `Talk-to-My-Lawyer - Homepage`
   - URL: `https://www.talk-to-my-lawyer.com`
   - Monitoring Interval: 5 minutes

4. **Create API Monitor:**
   - Monitor Type: HTTP(s)
   - Friendly Name: `Talk-to-My-Lawyer - API`
   - URL: `https://www.talk-to-my-lawyer.com/api/generate-letter`
   - Monitoring Interval: 5 minutes
   - Expected Status: 401 or 405 (not 500)

5. **Set Up Alert Contacts:**
   - Email: Add all team members
   - Slack: Add webhook URL for #alerts channel
   - SMS: Add on-call engineer's phone (paid feature)

6. **Configure Alert Thresholds:**
   - Alert when down for: 2 consecutive checks (10 minutes)
   - Alert when back up: Immediately
   - Alert frequency: Every 10 minutes until resolved

### Option B: Better Uptime

**Why Better Uptime:**
- More advanced features
- Better Slack integration
- Incident management
- On-call scheduling

**Setup Steps:**

1. Go to https://betteruptime.com
2. Create account and team
3. Add monitors (similar to UptimeRobot)
4. Set up on-call schedule
5. Configure escalation policies

---

## Layer 2: Health Check Monitoring

### Vercel Monitoring (Built-in)

**Setup Steps:**

1. **Enable Vercel Analytics:**
   - Go to Vercel Dashboard → Project Settings → Analytics
   - Enable Web Analytics
   - Enable Speed Insights

2. **Configure Alerts:**
   - Go to Project Settings → Notifications
   - Enable "Deployment Failed" alerts
   - Enable "Deployment Succeeded" alerts
   - Add Slack webhook

3. **Monitor Deployment Health:**
   - Check Vercel Dashboard regularly
   - Review deployment logs
   - Monitor build times

### Custom Health Check Monitoring

**Create a monitoring script that runs periodically:**

Create `scripts/monitor-health.sh`:

```bash
#!/bin/bash
# Health monitoring script
# Run this via cron or CI/CD to monitor health endpoint

SITE_URL="https://www.talk-to-my-lawyer.com"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Fetch health status
HEALTH_RESPONSE=$(curl -s "$SITE_URL/api/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status')
STARTUP_HEALTHY=$(echo "$HEALTH_RESPONSE" | jq -r '.startup.healthy')
STARTUP_ERRORS=$(echo "$HEALTH_RESPONSE" | jq -r '.startup.errors | length')
STARTUP_WARNINGS=$(echo "$HEALTH_RESPONSE" | jq -r '.startup.warnings | length')

# Check for issues
if [ "$HEALTH_STATUS" != "healthy" ] || [ "$STARTUP_HEALTHY" != "true" ]; then
  MESSAGE="🚨 Health check failed!\nStatus: $HEALTH_STATUS\nStartup healthy: $STARTUP_HEALTHY\nErrors: $STARTUP_ERRORS\nWarnings: $STARTUP_WARNINGS"
  
  # Send to Slack
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\": \"$MESSAGE\"}"
  fi
  
  echo "$MESSAGE"
  exit 1
fi

# Check for warnings
if [ "$STARTUP_WARNINGS" -gt 0 ]; then
  MESSAGE="⚠️  Health check has warnings\nWarnings: $STARTUP_WARNINGS"
  echo "$MESSAGE"
fi

echo "✅ Health check passed"
```

**Schedule via GitHub Actions:**

Create `.github/workflows/health-check.yml`:

```yaml
name: Health Check Monitoring

on:
  schedule:
    # Run every 15 minutes
    - cron: '*/15 * * * *'
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check health endpoint
        run: |
          HEALTH_STATUS=$(curl -s https://www.talk-to-my-lawyer.com/api/health | jq -r '.status')
          if [ "$HEALTH_STATUS" != "healthy" ]; then
            echo "❌ Health check failed: $HEALTH_STATUS"
            exit 1
          fi
          echo "✅ Health check passed"
      
      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: '🚨 Production health check failed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Layer 3: Error Tracking

### Option A: Sentry (Recommended)

**Why Sentry:**
- Real-time error tracking
- Source map support
- Release tracking
- Performance monitoring
- Free tier available

**Setup Steps:**

1. **Create Sentry Account:**
   - Go to https://sentry.io
   - Sign up and create organization

2. **Create Project:**
   - Click "Create Project"
   - Platform: Next.js
   - Project name: talk-to-my-lawyer

3. **Install Sentry SDK:**
   ```bash
   pnpm add @sentry/nextjs
   ```

4. **Initialize Sentry:**
   ```bash
   npx @sentry/wizard@latest -i nextjs
   ```

5. **Configure Environment Variables:**
   Add to Vercel:
   ```
   NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   SENTRY_AUTH_TOKEN=your-auth-token
   ```

6. **Configure Alerts:**
   - Go to Sentry → Alerts → Create Alert Rule
   - Alert name: "Environment Variable Errors"
   - Conditions:
     - Event message contains "environment"
     - OR Event message contains "SUPABASE"
     - OR Event message contains "OPENAI"
   - Actions: Send to Slack, Email team

7. **Create Alert for High Error Rate:**
   - Alert name: "High Error Rate"
   - Conditions: Error count > 10 in 5 minutes
   - Actions: Send to Slack, Page on-call

### Option B: Vercel Log Drains

**Setup Steps:**

1. **Go to Vercel Project Settings → Log Drains**

2. **Add Log Drain:**
   - Drain Type: HTTP
   - Endpoint: Your log aggregation service (e.g., Datadog, Logtail)
   - Sources: Select all (Static, Lambda, Edge, Build)

3. **Configure Log Aggregation Service:**
   - Set up alerts for error patterns
   - Create dashboards for monitoring

---

## Monitoring Checklist

### Daily Checks (Automated)

- [ ] Health endpoint status
- [ ] Error rate < 1%
- [ ] Response time < 2 seconds
- [ ] No 500 errors in logs

### Weekly Checks (Manual)

- [ ] Review UptimeRobot uptime percentage (target: >99.9%)
- [ ] Review Sentry error trends
- [ ] Review Vercel analytics
- [ ] Check for new environment variable warnings

### Monthly Checks (Manual)

- [ ] Review alert thresholds and adjust if needed
- [ ] Test alert delivery (trigger test alert)
- [ ] Review and update monitoring documentation
- [ ] Verify all team members receive alerts

---

## Alert Configuration

### Critical Alerts (Immediate Response Required)

**Trigger:** Health check fails (returns 503)

**Response Time:** < 5 minutes

**Escalation:**
1. Slack notification to #alerts
2. Email to on-call engineer
3. SMS to on-call engineer (after 5 minutes)
4. Page manager (after 15 minutes)

**Actions:**
1. Check health endpoint response
2. Follow ENV_VAR_INCIDENT_RESPONSE runbook
3. Notify team in #incidents

### High Priority Alerts (Response Within 30 Minutes)

**Trigger:** Error rate > 5% for 5 minutes

**Response Time:** < 30 minutes

**Escalation:**
1. Slack notification to #alerts
2. Email to on-call engineer

**Actions:**
1. Check Sentry for error details
2. Review Vercel logs
3. Determine if rollback is needed

### Medium Priority Alerts (Response Within 2 Hours)

**Trigger:** Response time > 5 seconds for 10 minutes

**Response Time:** < 2 hours

**Escalation:**
1. Slack notification to #engineering

**Actions:**
1. Check Vercel analytics
2. Review database query performance
3. Investigate slow endpoints

### Low Priority Alerts (Response Within 24 Hours)

**Trigger:** Environment variable warnings in health check

**Response Time:** < 24 hours

**Escalation:**
1. Slack notification to #engineering

**Actions:**
1. Review health endpoint response
2. Check VERCEL_ENV_INVENTORY.md
3. Add missing optional variables if needed

---

## Slack Integration

### Create Slack Channels

1. **#alerts** - Critical production alerts
2. **#deployments** - Deployment notifications
3. **#incidents** - Active incident coordination
4. **#engineering** - General engineering notifications

### Configure Slack Webhooks

1. Go to Slack → Apps → Incoming Webhooks
2. Create webhook for each channel
3. Add webhook URLs to monitoring services
4. Test each webhook

### Slack Alert Format

**Critical Alert:**
```
🚨 CRITICAL: Production health check failed
Status: unhealthy
Errors: NEXT_PUBLIC_SUPABASE_ANON_KEY validation failed
Time: 2026-02-15 10:30:00 UTC
Runbook: docs/runbooks/ENV_VAR_INCIDENT_RESPONSE.md
```

**Deployment Alert:**
```
🚀 Deployment started
Branch: main
Commit: c5f45d6 - "fix: letter generation pipeline"
Deployer: @moiz
Status: Building...
```

**Resolution Alert:**
```
✅ RESOLVED: Production health check passed
Duration: 15 minutes
Resolution: Set missing NEXT_PUBLIC_SUPABASE_ANON_KEY
Incident report: docs/incidents/2026-02-15-env-var-outage.md
```

---

## Dashboard Setup

### Vercel Dashboard

**Metrics to Monitor:**
- Deployment frequency
- Build time
- Error rate
- Response time (p50, p95, p99)
- Bandwidth usage

### Custom Dashboard (Optional)

**Tools:**
- Grafana + Prometheus
- Datadog
- New Relic

**Key Metrics:**
- Health check status over time
- Environment variable validation results
- API endpoint response times
- Error rate by endpoint
- Database query performance

---

## Testing Alerts

### Test Alert Delivery

**Monthly test procedure:**

1. **Test UptimeRobot:**
   - Temporarily set wrong URL
   - Verify alert received
   - Restore correct URL

2. **Test Sentry:**
   - Trigger test error in production
   - Verify alert received
   - Mark as resolved

3. **Test Slack webhooks:**
   - Send test message to each webhook
   - Verify received in correct channel

4. **Test escalation:**
   - Simulate critical alert
   - Verify all escalation steps trigger

### Document Test Results

Create `docs/monitoring/ALERT_TEST_LOG.md`:

```markdown
# Alert Test Log

| Date | Alert Type | Delivery Method | Status | Notes |
|------|------------|----------------|--------|-------|
| 2026-02-15 | Health Check | Slack | ✅ Pass | Received in 30 seconds |
| 2026-02-15 | Health Check | Email | ✅ Pass | Received in 2 minutes |
| 2026-02-15 | Sentry Error | Slack | ✅ Pass | Received immediately |
```

---

## Monitoring Costs

### Free Tier Options

| Service | Free Tier | Sufficient For |
|---------|-----------|----------------|
| UptimeRobot | 50 monitors, 5-min checks | Yes, for basic monitoring |
| Better Uptime | 10 monitors | Yes, for critical endpoints |
| Sentry | 5K errors/month | Yes, for early stage |
| Vercel Analytics | Included | Yes, always |

### Paid Options (If Scaling)

| Service | Cost | When to Upgrade |
|---------|------|-----------------|
| UptimeRobot Pro | $7/month | Need 1-min checks or SMS alerts |
| Better Uptime | $20/month | Need on-call scheduling |
| Sentry Team | $26/month | >5K errors/month |
| Datadog | $15/host/month | Need advanced APM |

---

## Maintenance

### Weekly Tasks

- [ ] Review alert logs
- [ ] Check for false positives
- [ ] Verify all monitors are active
- [ ] Review error trends in Sentry

### Monthly Tasks

- [ ] Test all alert delivery methods
- [ ] Review and adjust alert thresholds
- [ ] Update monitoring documentation
- [ ] Review monitoring costs

### Quarterly Tasks

- [ ] Conduct monitoring drill
- [ ] Review monitoring strategy
- [ ] Evaluate new monitoring tools
- [ ] Update escalation contacts

---

## Troubleshooting

### Alerts Not Received

**Possible causes:**
1. Webhook URL incorrect
2. Slack app not installed
3. Email in spam folder
4. Alert threshold not met

**Resolution:**
1. Test webhook manually
2. Check Slack app permissions
3. Whitelist sender email
4. Review alert configuration

### False Positive Alerts

**Possible causes:**
1. Threshold too sensitive
2. Expected downtime not excluded
3. Network issues

**Resolution:**
1. Adjust alert threshold
2. Schedule maintenance windows
3. Add retry logic to monitors

### Missing Alerts

**Possible causes:**
1. Monitor disabled
2. Service outage
3. Alert fatigue (too many alerts)

**Resolution:**
1. Verify monitor is active
2. Check monitoring service status
3. Reduce alert noise

---

## Next Steps

After completing this setup:

1. **Test all alerts** - Verify delivery works
2. **Document runbooks** - Ensure team knows how to respond
3. **Train team** - Conduct monitoring walkthrough
4. **Schedule drills** - Practice incident response
5. **Iterate** - Continuously improve based on feedback

---

**Last Updated:** February 15, 2026
**Owner:** Engineering Team
**Review Schedule:** Monthly
