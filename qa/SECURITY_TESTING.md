# Part 7, 8 & 9 — Dashboards, Profile Settings & Security

## Part 7: Dashboards + Routing (Role UX Sanity)

### Dashboard Features by Role

#### Subscriber Dashboard
| Feature | Route | Expected |
|---------|-------|----------|
| Letters list | `/dashboard/letters` | ✅ Visible |
| Create letter | `/dashboard/letters/new` | ✅ Visible |
| Billing status | `/dashboard/billing` | ✅ Visible |
| Subscription | `/dashboard/subscription` | ✅ Visible |
| Coupon header | Header component | ✅ If coupon applied |
| Profile settings | `/dashboard/settings` | ✅ Visible |

#### Employee Dashboard
| Feature | Route | Expected |
|---------|-------|----------|
| Referrals | `/dashboard/referrals` | ✅ Visible |
| Coupons | `/dashboard/coupons` | ✅ Visible |
| Commissions | `/dashboard/commissions` | ✅ Visible |
| Payouts | `/dashboard/payouts` | ✅ Visible |
| Employee settings | `/dashboard/employee-settings` | ✅ Visible |

#### Attorney Admin Dashboard
| Feature | Route | Expected |
|---------|-------|----------|
| Review Center | `/secure-admin-gateway/review` | ✅ Visible |
| Letters management | `/secure-admin-gateway/dashboard/letters` | ✅ Visible |
| All letters | `/secure-admin-gateway/dashboard/all-letters` | ✅ Visible |

#### Super Admin Dashboard
| Feature | Route | Expected |
|---------|-------|----------|
| All Attorney Admin features | Various | ✅ Visible |
| Analytics | `/secure-admin-gateway/dashboard/analytics` | ✅ Visible |
| User management | `/secure-admin-gateway/dashboard/users` | ✅ Visible |
| Coupon management | `/secure-admin-gateway/dashboard/coupons` | ✅ Visible |
| Commission management | `/secure-admin-gateway/dashboard/commissions` | ✅ Visible |
| Email queue | `/secure-admin-gateway/dashboard/email-queue` | ✅ Visible |

### Test Scenarios

#### Test 7.1: Navigation Sanity Check
For each role:
1. Login with test user
2. Click every nav item
3. **Verify**: No 404 pages
4. **Verify**: No blank screens
5. **Verify**: No console errors (check browser DevTools)

#### Test 7.2: Role Isolation
1. Login as subscriber
2. Try to access `/secure-admin-gateway/dashboard`
3. **Verify**: Access denied (redirect or 403)

---

## Part 8: Profile Settings (Persistence + Validation)

### Test Scenarios

#### Test 8.1: Profile Update Persistence
For each role:
1. Navigate to settings page
2. Update profile fields:
   - Full name
   - Phone number
   - Company name (if applicable)
3. Save changes
4. Refresh page
5. **Verify**: Changes persisted

#### Test 8.2: Password Change
1. Navigate to settings
2. Change password (if available)
3. Logout
4. Login with new password
5. **Verify**: Login works with new password

#### Test 8.3: Invalid Input Validation
Test these invalid inputs:
| Input | Test Value | Expected |
|-------|------------|----------|
| Empty required field | `""` | Error message |
| Very long name | 500+ characters | Error or truncation |
| Special characters | `<script>alert('xss')</script>` | Sanitized, no XSS |
| SQL injection | `'; DROP TABLE users; --` | Sanitized, no injection |
| Unicode | `日本語テスト 🔥` | Accepted or clear error |

**Verify**: All errors are human-readable

### Ask/Verify Questions

**Q: Is profile update sanitized + validated server-side?**
A: Yes, validation occurs in:
- API routes with input validation
- Database constraints
- RLS policies for authorization

---

## Part 9: Security & Data Isolation (Must-Pass)

### Critical Security Tests

#### Test 9.1: Cross-User Letter Access
1. Create 2 subscribers with letters:
   - User A: `test-usera@example.com`
   - User B: `test-userb@example.com`
2. Login as User A, create a letter, note the letter ID
3. Logout
4. Login as User B
5. Try to access User A's letter:
   - Direct URL: `/dashboard/letters/[User A's letter ID]`
   - API: `GET /api/letters/[User A's letter ID]/pdf`
6. **Verify**: Access blocked (403/unauthorized)

#### Test 9.2: Cross-User Invoice Access
1. If invoices/receipts exist
2. Copy invoice URL from User A
3. Login as User B
4. Try to access User A's invoice
5. **Verify**: Access blocked

#### Test 9.3: Cross-User Profile Access
1. Get User A's profile ID
2. Login as User B
3. Try to access User A's profile:
   - API: `GET /api/profiles/[User A's ID]`
4. **Verify**: Access blocked

#### Test 9.4: API Authorization Bypass Attempts
Test these API endpoints without proper auth:

| Endpoint | Method | Test |
|----------|--------|------|
| `/api/generate-letter` | POST | Without auth token |
| `/api/letters/[id]/pdf` | GET | With wrong user's token |
| `/api/admin/analytics` | GET | With subscriber token |
| `/api/admin/coupons` | POST | With attorney_admin token |

**Expected**: All return 401 or 403

### Data Isolation Verification

#### Database Level (RLS Policies)
```sql
-- Letters: Users can only see their own
CREATE POLICY "Users can view own letters"
ON letters FOR SELECT
USING (user_id = auth.uid());

-- Subscriptions: Users can only see their own
CREATE POLICY "Users can view own subscriptions"
ON subscriptions FOR SELECT
USING (user_id = auth.uid());
```

#### API Level
All endpoints that fetch user content must include:
```typescript
// Ownership check
if (letter.user_id !== session.user.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

### Endpoints Fetching User Content

| Endpoint | Auth Check | Ownership Check |
|----------|------------|-----------------|
| `GET /api/letters/[id]` | `requireAuth()` | `letter.user_id === user.id` |
| `GET /api/letters/[id]/pdf` | `requireAuth()` | `letter.user_id === user.id` |
| `POST /api/letters/[id]/submit` | `requireAuth()` | `letter.user_id === user.id` |
| `DELETE /api/letters/[id]/delete` | `requireAuth()` | `letter.user_id === user.id` |
| `GET /api/subscriptions/*` | `requireAuth()` | `subscription.user_id === user.id` |
| `GET /api/gdpr/export-data` | `requireAuth()` | Own data only |

### Security Checklist

- [ ] All protected routes require authentication
- [ ] Role-based access control enforced server-side
- [ ] Cross-user data access impossible
- [ ] API endpoints validate ownership
- [ ] Input sanitization prevents XSS
- [ ] SQL injection prevented (parameterized queries)
- [ ] CSRF protection enabled
- [ ] Rate limiting in place
- [ ] Sensitive data encrypted at rest
- [ ] HTTPS enforced in production
