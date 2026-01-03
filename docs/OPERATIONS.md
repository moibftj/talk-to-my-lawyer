# Production Operations Guide

Complete guide for production operations, monitoring, incident response, and maintenance procedures for Talk-To-My-Lawyer.

## Table of Contents

1. [Production Runbook](#production-runbook)
2. [Monitoring & Alerts](#monitoring--alerts)
3. [Incident Response](#incident-response)
4. [Regular Maintenance](#regular-maintenance)
5. [Backup & Recovery](#backup--recovery)

---

## Production Runbook

### Emergency Contacts & Resources

- **Primary Domain**: https://www.talk-to-my-lawyer.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Stripe Dashboard**: https://dashboard.stripe.com

### Common Production Issues

#### 1. Stripe Payment Failures

**Symptoms**:
- Users can't complete checkout
- 500 errors on payment processing
- Webhook failures

**Diagnostics**:
```bash
# Check Stripe webhook logs
curl -H "Authorization: Bearer $STRIPE_SECRET_KEY" \
  "https://api.stripe.com/v1/webhook_endpoints"

# Check application logs
vercel logs --app=talk-to-my-lawyer
```

**Solutions**:
- Verify webhook endpoint URL in Stripe Dashboard
- Check `STRIPE_WEBHOOK_SECRET` matches dashboard
- Ensure `STRIPE_SECRET_KEY` starts with `sk_live_`
- Verify webhook events enabled: `checkout.session.completed`, `payment_intent.*`

#### 2. Admin Portal Access Issues

**Symptoms**:
- Can't access `/secure-admin-gateway`
- "Invalid portal key" errors
- Admin sessions timing out

**Solutions**:
```bash
# Check admin portal key
echo $ADMIN_PORTAL_KEY

# Verify admin user role
psql $DATABASE_URL -c "SELECT email, role FROM profiles WHERE role = 'admin';"
```

**Fix Steps**:
1. Verify `ADMIN_PORTAL_KEY` environment variable
2. Check admin user has `role = 'admin'` in database
3. Clear browser cookies and try again
4. Check session timeout (30 minutes max)

#### 3. Letter Generation Failures

**Symptoms**:
- Letters stuck in "generating" status
- AI generation timeouts
- OpenAI API errors

**Diagnostics**:
```bash
# Check OpenAI API status
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  "https://api.openai.com/v1/models/gpt-4-turbo"

# Check letter status distribution
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM letters GROUP BY status;"
```

**Solutions**:
- Verify `OPENAI_API_KEY` is valid and has credits
- Check rate limits in OpenAI dashboard
- Restart stuck letters: Update status from 'generating' to 'draft'
- Review AI prompt for content policy violations

#### 4. Email Delivery Issues

**Symptoms**:
- Users not receiving emails
- Email queue backing up
- Provider API failures

**Diagnostics**:
```bash
# Check email queue status
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM email_queue GROUP BY status;"

# Check Resend API status
curl -H "Authorization: Bearer $RESEND_API_KEY" \
  "https://api.resend.com/domains"
```

**Solutions**:
- Check email provider API keys (Resend, Brevo, SendGrid)
- Verify domain verification in provider dashboard
- Process email queue manually: `POST /api/cron/process-email-queue`
- Switch to backup email provider if needed

#### 5. Database Connection Issues

**Symptoms**:
- 500 errors across the application
- "Connection refused" errors
- Slow query performance

**Diagnostics**:
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT version();"

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
psql $DATABASE_URL -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

**Solutions**:
- Check Supabase dashboard for database health
- Review connection pool settings
- Optimize slow queries identified
- Consider database scaling if needed

#### 6. Rate Limiting Issues

**Symptoms**:
- Users getting 429 errors
- "Rate limit exceeded" messages
- Unable to generate letters

**Solutions**:
```bash
# Check Redis/Upstash status
curl -H "Authorization: Bearer $KV_REST_API_TOKEN" \
  "$KV_REST_API_URL/ping"
```

**Fix Steps**:
1. Check Upstash Redis dashboard for connectivity
2. Review rate limit configurations in code
3. Temporarily increase limits if legitimate traffic spike
4. Clear rate limit cache if needed: `FLUSHALL` in Redis

---

## Monitoring & Alerts

### Key Performance Indicators (KPIs)

#### Business Metrics
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Letter Generation Success Rate
- Payment Conversion Rate
- Customer Satisfaction Score

#### Technical Metrics
- API Response Times
- Database Query Performance
- Email Delivery Rate
- System Uptime
- Error Rates by Service

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

# Expected response
{
  "status": "healthy",
  "timestamp": "2026-01-03T12:00:00Z",
  "services": {
    "database": "healthy",
    "stripe": "healthy",
    "email": "healthy",
    "ai": "healthy",
    "redis": "healthy"
  },
  "performance": {
    "avgResponseTime": "150ms",
    "memoryUsage": "45%",
    "cpuUsage": "23%"
  }
}
```

### Performance Baselines

#### API Response Times (95th percentile)
- **Authentication**: < 500ms
- **Letter Generation**: < 30 seconds
- **Payment Processing**: < 3 seconds
- **Admin Dashboard**: < 1 second
- **File Downloads**: < 2 seconds

#### Database Performance
- **Query Response**: < 100ms average
- **Connection Pool**: < 80% utilization
- **Lock Wait Time**: < 50ms
- **Index Hit Ratio**: > 99%

#### Email Delivery
- **Success Rate**: > 98%
- **Delivery Time**: < 5 minutes
- **Queue Processing**: < 2 minutes per batch
- **Bounce Rate**: < 2%

---

## Incident Response

### Severity Levels

#### Level 1: Critical (System Down)
- **Response Time**: Immediate (< 15 minutes)
- **Examples**: Payment processing down, database offline, site inaccessible
- **Actions**:
  1. Page on-call engineer
  2. Emergency rollback if needed
  3. Customer communication within 30 minutes
  4. Post-incident review within 24 hours

#### Level 2: High (Degraded Performance)
- **Response Time**: < 1 hour
- **Examples**: Slow response times, partial service outage, email delays
- **Actions**:
  1. Investigate root cause
  2. Implement temporary fix
  3. Monitor for improvement
  4. Customer update if customer-facing

#### Level 3: Medium (Feature Issues)
- **Response Time**: < 4 hours
- **Examples**: Letter generation errors, admin panel issues, email formatting
- **Actions**:
  1. Triage and prioritize
  2. Assign to appropriate team
  3. Fix within 24 hours
  4. Test thoroughly before deployment

#### Level 4: Low (Minor Issues)
- **Response Time**: Next business day
- **Examples**: UI inconsistencies, documentation updates, minor bugs
- **Actions**:
  1. Add to backlog
  2. Schedule for next sprint
  3. Include in regular release cycle

### Emergency Procedures

#### Rollback Procedure

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

#### API Key Rotation

In case of suspected security breach:

```bash
# Environment variables to rotate immediately
ADMIN_PORTAL_KEY
OPENAI_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## Regular Maintenance

### Daily Tasks

- [ ] Check error logs
- [ ] Monitor payment processing
- [ ] Review email queue status
- [ ] Verify system health endpoints

### Weekly Tasks

- [ ] Review performance metrics
- [ ] Check database growth
- [ ] Update security patches
- [ ] Test backup recovery
- [ ] Review admin activity logs

### Monthly Tasks

- [ ] Rotate sensitive API keys
- [ ] Review user access permissions
- [ ] Update dependencies
- [ ] Capacity planning review
- [ ] Security audit

### Quarterly Tasks

- [ ] Full system audit
- [ ] Disaster recovery drill
- [ ] Performance optimization review
- [ ] User feedback analysis
- [ ] Cost optimization review

---

## Backup & Recovery

### Database Backups

- **Frequency**: Every 6 hours (Supabase automatic)
- **Retention**: 30 days
- **Testing**: Weekly recovery test
- **RTO**: < 4 hours (Recovery Time Objective)
- **RPO**: < 6 hours (Recovery Point Objective)

### Application Backups

- **Code**: Git repository (GitHub)
- **Configuration**: Environment variables (Vercel)
- **Dependencies**: Package lock files
- **Documentation**: Version controlled

### Disaster Recovery Plan

1. **Assessment** (0-15 minutes): Determine scope of outage
2. **Communication** (15-30 minutes): Notify stakeholders
3. **Recovery** (30 minutes - 4 hours): Restore services
4. **Validation** (1-2 hours): Verify system integrity
5. **Post-Mortem** (24-48 hours): Document lessons learned

### Recovery Procedures

```bash
# Database point-in-time recovery
# Via Supabase Dashboard → Database → Backups → Restore

# Application rollback
vercel rollback

# Verify recovery
curl https://www.talk-to-my-lawyer.com/api/health/detailed
```

---

## Notification Channels

### Critical Alerts
- **Email**: admin@talk-to-my-lawyer.com
- **SMS**: Emergency contact number
- **Slack**: #production-alerts (if configured)

### Warning Alerts
- **Email**: ops-team@talk-to-my-lawyer.com
- **Dashboard**: Real-time alerts in admin panel

### Status Updates
- **Status Page**: status.talk-to-my-lawyer.com (if configured)
- **Customer Email**: support@talk-to-my-lawyer.com
- **Social Media**: @talktomylawyer (if applicable)

---

## Capacity Planning

### Growth Projections
- **Users**: 20% month-over-month growth
- **Letters**: 25% increase per month
- **Revenue**: Target $10k MRR by Q2 2026
- **Database**: Plan for 10x current size

### Scaling Triggers
- **Database**: > 80% CPU utilization
- **API**: > 2 second response time
- **Storage**: > 75% capacity used
- **Bandwidth**: > 70% of plan limit

---

**Configuration Updated**: January 2026  
**Next Review**: February 2026  
**Owner**: Production Operations Team
