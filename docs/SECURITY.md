# Security Guide

Complete security documentation covering audit fixes, best practices, and security measures for Talk-To-My-Lawyer.

## Overview

This guide covers security vulnerabilities, fixes applied, ongoing security measures, and best practices.

## Recent Security Audit (2025)

### Vulnerability Summary

| Severity | Count | Status |
|----------|-------|--------|
| High | 1 | ✅ Fixed |
| Moderate | 3 | ✅ Fixed |
| Low | 1 | ✅ Fixed |

### High Severity Issue - FIXED

**Package**: `@modelcontextprotocol/sdk`

- **Vulnerable versions**: < 1.24.0
- **Patched versions**: >= 1.24.0
- **Issue**: Model Context Protocol (MCP) TypeScript SDK does not enable DNS rebinding protection by default
- **Advisory**: https://github.com/advisories/GHSA-w48q-cv73-mx4w

**Fix Applied**:
```json
{
  "pnpm": {
    "overrides": {
      "@modelcontextprotocol/sdk": ">=1.24.0"
    }
  }
}
```

### Package Updates Applied

Updated to latest secure versions:

- `@ai-sdk/openai`: ^2.0.71 → ^3.0.1
- `@hookform/resolvers`: ^3.10.0 → ^5.2.2
- `@tiptap/*` packages: ^3.11.0 → ^3.14.0
- `ai`: ^5.0.100 → ^6.0.3
- `next`: 16.0.10 → ^16.1.1
- `openai`: ^6.9.1 → ^6.15.0
- `react`: 19.2.0 → ^19.2.3
- `stripe`: ^20.0.0 → ^20.1.0
- `zod`: 3.25.76 → ^4.2.1

### Security Scripts

```bash
# Run security audit
pnpm run audit:security

# Run comprehensive security fix
pnpm run audit:fix

# Update all packages
pnpm run update:packages
```

## Security Layers

### 1. Authentication & Authorization

#### Multi-Factor Admin Authentication
Admin access requires THREE factors:
1. Email (Supabase Auth)
2. Password (Supabase Auth)
3. Portal Key (Environment variable)

```typescript
// Admin login validation
const authError = await requireAdminAuth()
if (authError) return authError
```

#### Role-Based Access Control (RBAC)

```typescript
// Role validation in API routes
const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", user.id)
  .single()

if (profile?.role !== "subscriber") {
  return errorResponses.forbidden("Only subscribers can...")
}
```

### 2. Rate Limiting

Implemented via Upstash Redis with in-memory fallback:

| Endpoint | Limit | Window |
|----------|-------|--------|
| **Auth** | 5 requests | 15 minutes |
| **Admin** | 10 requests | 15 minutes |
| **API** | 100 requests | 1 minute |
| **Letter Generation** | 5 requests | 1 hour |
| **Subscriptions** | 3 requests | 1 hour |

```typescript
// Apply rate limiting
const rateLimitResponse = await safeApplyRateLimit(
  request,
  letterGenerationRateLimit,
  5,
  "1 h"
)
if (rateLimitResponse) return rateLimitResponse
```

### 3. Input Validation & Sanitization

#### Schema-Based Validation

```typescript
// Validation using letter-schema.ts
const validation = validateLetterGenerationRequest(letterType, intakeData)
if (!validation.valid) {
  return errorResponses.validation("Invalid input", validation.errors)
}
```

#### Input Sanitization

```typescript
import { sanitizeString, sanitizeEmail, sanitizeHtml } from '@/lib/security/input-sanitizer'

const cleanName = sanitizeString(userInput, 100)
const cleanEmail = sanitizeEmail(emailInput)
const cleanContent = sanitizeHtml(htmlInput)
```

### 4. CSRF Protection

Admin actions require CSRF tokens:

```typescript
// Generate CSRF token
export function generateAdminCSRF() {
  return {
    signedToken: token,
    expiresAt: expiry,
    cookieHeader: cookie
  }
}

// Validate CSRF token
export async function validateAdminRequest(request: NextRequest) {
  // Verify token from cookie matches request
}
```

### 5. Database Security

#### Row Level Security (RLS)

All tables have RLS policies:

```sql
-- Example: Profiles RLS policy
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

#### SQL Injection Prevention

All queries use parameterized queries via Supabase SDK:

```typescript
// Safe - parameterized query
const { data } = await supabase
  .from("profiles")
  .select("*")
  .eq("email", userEmail)  // Automatically escaped

// Never use raw SQL with user input
```

### 6. Content Security Policy (CSP)

Configured in `next.config.mjs`:

```javascript
{
  key: 'Content-Security-Policy',
  value: `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' *.stripe.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: *.supabase.co;
    connect-src 'self' *.supabase.co *.stripe.com api.openai.com;
  `.replace(/\s{2,}/g, ' ').trim()
}
```

### 7. Security Headers

All responses include:

```javascript
// In next.config.mjs
{
  headers: [
    {
      key: 'X-Frame-Options',
      value: 'SAMEORIGIN'
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff'
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains'
    }
  ]
}
```

## Security Best Practices

### Environment Variables

#### Secure Storage
- Never commit `.env.local` or actual secrets
- Use GitHub Secrets for CI/CD
- Use Vercel Environment Variables for production
- Rotate secrets quarterly

#### Secret Generation

```bash
# Generate secure portal key
openssl rand -hex 32

# Generate cron secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### API Security

#### Always Authenticate

```typescript
// Every API route must start with auth check
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) return errorResponses.unauthorized()
```

#### Never Log Secrets

```typescript
// BAD - logs secret
console.log('Using key:', process.env.OPENAI_API_KEY)

// GOOD - reference only
console.log('Using OPENAI_API_KEY')
```

### Database Security

#### Always Use RLS

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
```

#### Use Security Definer Functions

```sql
CREATE OR REPLACE FUNCTION check_letter_allowance(u_id UUID)
RETURNS TABLE(...) 
LANGUAGE SQL 
SECURITY DEFINER  -- Runs with function owner permissions
AS $$
  -- Function implementation
$$;
```

### Audit Logging

All critical actions are logged:

```typescript
// Log letter audit trail
await supabase.rpc('log_letter_audit', {
  p_letter_id: letterId,
  p_action: 'approved',
  p_performed_by: adminId,
  p_old_status: 'under_review',
  p_new_status: 'approved',
  p_notes: reviewNotes
})
```

## Incident Response

### Security Breach Procedure

1. **Immediate Actions**:
   - Rotate all API keys and secrets
   - Disable affected accounts if necessary
   - Enable additional logging

2. **Assessment**:
   - Check audit logs for suspicious activity
   - Review access logs and database changes
   - Identify scope of breach

3. **Containment**:
   - Block compromised accounts
   - Update security rules
   - Deploy patches

4. **Recovery**:
   - Restore from clean backup if needed
   - Verify data integrity
   - Re-enable services

5. **Post-Incident**:
   - Document incident
   - Update security measures
   - Notify affected users if required
   - Conduct security review

### API Key Rotation

In case of suspected compromise:

```bash
# Keys to rotate immediately:
ADMIN_PORTAL_KEY
OPENAI_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

## Security Monitoring

### Failed Login Attempts

```sql
-- Monitor failed admin logins
SELECT * FROM admin_audit_log
WHERE action = 'login_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Suspicious Activity

```sql
-- Check for unusual patterns
SELECT user_id, COUNT(*) as attempts
FROM letters
WHERE status = 'generating'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 5;
```

### Rate Limit Breaches

Monitor Upstash Redis dashboard for:
- Unusual spike in requests
- Patterns of rate limit hits
- Geographic anomalies

## Compliance & Privacy

### GDPR Compliance

Endpoints for data privacy:

```typescript
// Accept privacy policy
POST /api/gdpr/accept-privacy-policy

// Delete account and data
POST /api/gdpr/delete-account

// Export user data
GET /api/gdpr/export-data
```

### Data Retention

- User data: Retained while account active
- Audit logs: Retained for 2 years
- Email queue: Purged after 30 days
- Session data: 30 minutes timeout

## Regular Security Tasks

### Daily
- Monitor error logs for anomalies
- Check failed authentication attempts
- Review rate limit logs

### Weekly
- Run security audit: `pnpm audit --audit-level=high`
- Review admin activity logs
- Check for outdated dependencies

### Monthly
- Rotate non-critical API keys
- Review and update security policies
- Test backup restoration
- Penetration testing

### Quarterly
- Rotate all API keys and secrets
- Full security audit
- Update security documentation
- Review and update RLS policies

## Security Checklist

### Pre-Deployment

- [ ] All dependencies up to date
- [ ] No high/critical vulnerabilities
- [ ] Environment variables secured
- [ ] RLS policies verified
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Security headers applied
- [ ] HTTPS enforced

### Production

- [ ] `ENABLE_TEST_MODE=false`
- [ ] Stripe live keys configured
- [ ] Admin portal key rotated
- [ ] Webhook secrets verified
- [ ] Backup system tested
- [ ] Monitoring alerts configured

### Ongoing

- [ ] Regular security audits
- [ ] Dependency updates
- [ ] Log monitoring
- [ ] Access reviews
- [ ] Incident response drills

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Stripe Security](https://stripe.com/docs/security)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/authentication)

---

**Last Updated**: January 2026  
**Security Audit Version**: v2.0  
**Next Audit**: April 2026
