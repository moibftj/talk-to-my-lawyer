# Production Runbook - Talk-To-My-Lawyer

## 🚨 Emergency Contacts & Resources

- **Primary Domain**: https://www.talk-to-my-lawyer.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Stripe Dashboard**: https://dashboard.stripe.com

## 🔧 Common Production Issues & Solutions

### 1. Stripe Payment Failures

**Symptoms:**
- Users can't complete checkout
- 500 errors on payment processing
- Webhook failures

**Diagnostics:**
```bash
# Check Stripe webhook logs
curl -H "Authorization: Bearer $STRIPE_SECRET_KEY" \
  "https://api.stripe.com/v1/webhook_endpoints"

# Check application logs
vercel logs --app=talk-to-my-lawyer
```

**Solutions:**
- Verify webhook endpoint URL in Stripe Dashboard
- Check `STRIPE_WEBHOOK_SECRET` matches dashboard
- Ensure `STRIPE_SECRET_KEY` starts with `sk_live_`
- Verify webhook events are enabled: `checkout.session.completed`, `payment_intent.*`

### 2. Admin Portal Access Issues

**Symptoms:**
- Can't access `/secure-admin-gateway`
- "Invalid portal key" errors
- Admin sessions timing out

**Solutions:**
```bash
# Check admin portal key
echo $ADMIN_PORTAL_KEY

# Verify admin user role in database
psql $DATABASE_URL -c "SELECT email, role FROM profiles WHERE role = 'admin';"
```

**Fix Steps:**
1. Verify `ADMIN_PORTAL_KEY` environment variable
2. Check admin user has `role = 'admin'` in database
3. Clear browser cookies and try again
4. Check session timeout (30 minutes max)

### 3. Letter Generation Failures

**Symptoms:**
- Letters stuck in "generating" status
- AI generation timeouts
- OpenAI API errors

**Diagnostics:**
```bash
# Check OpenAI API status
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  "https://api.openai.com/v1/models/gpt-4-turbo"

# Check letter status in database  
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM letters GROUP BY status;"
```

**Solutions:**
- Verify `OPENAI_API_KEY` is valid and has credits
- Check rate limits in OpenAI dashboard
- Restart stuck letters: Update status from 'generating' to 'draft'
- Review AI prompt for content policy violations

### 4. Email Delivery Issues

**Symptoms:**
- Users not receiving emails
- Email queue backing up
- Provider API failures

**Diagnostics:**
```bash
# Check email queue status
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM email_queue GROUP BY status;"

# Check Resend API status
curl -H "Authorization: Bearer $RESEND_API_KEY" \
  "https://api.resend.com/domains"
```

**Solutions:**
- Check email provider API keys (Resend, Brevo, SendGrid)
- Verify domain verification in email provider dashboard
- Process email queue manually: `POST /api/cron/process-email-queue`
- Switch to backup email provider if needed

### 5. Database Connection Issues

**Symptoms:**
- 500 errors across the application
- "Connection refused" errors
- Slow query performance

**Diagnostics:**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT version();"

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
psql $DATABASE_URL -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

**Solutions:**
- Check Supabase dashboard for database health
- Review connection pool settings
- Optimize slow queries identified
- Consider database scaling if needed

### 6. Rate Limiting Issues

**Symptoms:**
- Users getting 429 errors
- "Rate limit exceeded" messages
- Unable to generate letters

**Solutions:**
```bash
# Check Redis/Upstash status
curl -H "Authorization: Bearer $KV_REST_API_TOKEN" \
  "$KV_REST_API_URL/ping"
```

**Fix Steps:**
1. Check Upstash Redis dashboard for connectivity
2. Review rate limit configurations in code
3. Temporarily increase limits if legitimate traffic spike
4. Clear rate limit cache if needed: `FLUSHALL` in Redis

## 🚀 Deployment & Rollback Procedures

### Emergency Rollback
```bash
# Via Vercel CLI
vercel rollback --app=talk-to-my-lawyer

# Via Vercel Dashboard
# Go to Deployments tab, click "Promote to Production" on previous version
```

### Production Deployment Checklist
- [ ] Run tests: `pnpm test`
- [ ] Run linting: `pnpm lint`
- [ ] Build check: `CI=1 pnpm build`
- [ ] Environment variables updated
- [ ] Database migrations applied
- [ ] Backup current state
- [ ] Deploy via git push to main
- [ ] Verify health endpoints
- [ ] Test critical paths (signup, payment, letter generation)

## 📊 Production Monitoring

### Health Check Endpoints
- **Basic**: `/api/health` - Returns 200 if app is running
- **Detailed**: `/api/health/detailed` - Full system status
- **Script**: `./scripts/production-health-check.sh`

### Key Metrics to Monitor
- Payment success rate (Stripe dashboard)
- Letter generation success rate
- Email delivery rate
- Database response times
- Error rates by endpoint

### Alerting Thresholds
- Payment failures > 5% in 1 hour
- Letter generation failures > 10% in 1 hour
- Email delivery failures > 15% in 1 hour
- Database response time > 2 seconds
- Error rate > 1% across all endpoints

## 🔒 Security Incident Response

### Suspected Security Breach
1. **Immediate**: Rotate all API keys and secrets
2. **Assess**: Check audit logs for suspicious activity
3. **Contain**: Disable affected accounts if necessary
4. **Investigate**: Review access logs and database changes
5. **Recover**: Restore from clean backup if needed
6. **Learn**: Update security measures and documentation

### API Key Rotation
```bash
# Environment variables to rotate
ADMIN_PORTAL_KEY
OPENAI_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## 📞 Support Escalation

### Critical Issues (System Down)
1. Check Vercel status page
2. Check Supabase status page
3. Check third-party service status (Stripe, OpenAI)
4. Review recent deployments
5. Consider emergency rollback

### Data Issues
1. Check recent database migrations
2. Review audit logs
3. Check backup availability
4. Consider point-in-time recovery

### Performance Issues
1. Check database performance metrics
2. Review server resource usage
3. Check CDN and caching
4. Consider scaling database/compute

## 📋 Regular Maintenance Tasks

### Daily
- [ ] Check error logs
- [ ] Monitor payment processing
- [ ] Review email queue status

### Weekly  
- [ ] Review performance metrics
- [ ] Check database growth
- [ ] Update security patches
- [ ] Test backup recovery

### Monthly
- [ ] Rotate sensitive API keys
- [ ] Review user access permissions
- [ ] Update dependencies
- [ ] Capacity planning review

---

**Last Updated**: December 31, 2025
**Version**: 1.0 (Production Release)