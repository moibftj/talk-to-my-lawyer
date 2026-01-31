# Part 3 & 4 — Coupon Codes + Billing/Plan Entitlements

## Part 3: Coupon Code Auto-Assignment

### Overview
Coupon codes are assigned to employees and can be shared with new subscribers for discounts.

### Database Schema
- **Table**: `employee_coupons`
- **Fields**: `code`, `employee_id`, `discount_percent`, `is_active`, `usage_count`, `max_uses`
- **Table**: `coupon_usage` - Tracks each use of a coupon

### Test Scenarios

#### Scenario 3.1: New Subscriber Signup with Coupon
1. Create a brand-new subscriber signup
2. **Check DB**: Verify coupon code exists on user (if auto-assigned)
3. **Check UI**: Coupon code appears in header (if applicable)
4. Logout → Login again
5. **Verify**: Coupon code still shows

#### Scenario 3.2: Coupon Isolation
1. Open User A's account in Browser 1
2. Open User B's account in Browser 2
3. **Verify**: User B does NOT see User A's coupon

#### Scenario 3.3: Concurrent Signup Stress Test
1. Create 10 signups quickly (within 30 seconds)
2. **Verify**: All coupon codes are unique (or follow uniqueness rules)
3. **Check**: No duplicate coupon assignments

### Ask/Verify Questions

**Q: What triggers coupon assignment?**
A: Coupon codes are created by employees via `/api/admin/coupons/create` or `/api/employee/referral-link`. They are NOT auto-assigned to subscribers on signup. Subscribers apply coupon codes during checkout.

**Q: What prevents duplicates during concurrent signups?**
A: The `employee_coupons.code` field has a unique constraint. The `coupon_usage` table tracks each use with `user_id` to prevent double-use.

---

## Part 4: Billing + Plan Entitlements

### Pricing Structure

| Plan | Price | Letters | Letter Price |
|------|-------|---------|--------------|
| Single Letter | $200 | 1 | $200/letter |
| Monthly Membership | $200/mo | Unlimited | $50/letter effective |
| Annual Plan | $2,000/year | 48 | ~$42/letter |

### Test Scenarios

#### Scenario 4A: Monthly Membership ($200/mo → $50/letter)

**Test 4A.1: Purchase Membership**
1. Login as `test-free@example.com`
2. Navigate to `/membership`
3. Select Monthly Membership
4. Complete Stripe checkout (use test card `4242 4242 4242 4242`)
5. **Verify DB**: `subscriptions.status = 'active'`, `plan_type = 'monthly_membership'`
6. **Verify UI**: Dashboard shows active membership

**Test 4A.2: Generate Letter with Membership**
1. Login as `test-monthly@example.com`
2. Create new letter
3. **Verify**: No additional payment required
4. **Verify**: Letter price shown as $50 (membership rate)

**Test 4A.3: Renewal Simulation**
1. Trigger Stripe webhook: `invoice.payment_succeeded`
2. **Verify**: Subscription remains active
3. **Verify**: `current_period_end` updated

#### Scenario 4B: Payment Failed / Past Due

**Test 4B.1: Simulate Failed Payment**
1. Use `test-pastdue@example.com` or trigger webhook: `invoice.payment_failed`
2. **Verify DB**: `subscriptions.status = 'past_due'` or `'payment_failed'`
3. **Verify UI**: User sees payment failure message
4. **Verify**: User cannot generate new letters
5. **Verify**: CTA to update payment method is visible

**Test 4B.2: Recovery Flow**
1. User updates payment method
2. Trigger successful payment webhook
3. **Verify**: Status returns to `'active'`
4. **Verify**: Letter generation re-enabled

#### Scenario 4C: Single Letter (No Membership → $200/letter)

**Test 4C.1: Unpaid User Letter Attempt**
1. Login as `test-free@example.com`
2. Attempt to create letter
3. **Verify**: Payment required before generation
4. **Verify**: Price shown is $200

**Test 4C.2: Single Letter Purchase**
1. Complete single letter payment
2. **Verify**: Letter becomes available
3. **Verify**: No subscription created (one-time purchase)

#### Scenario 4D: Annual Plan ($2,000 → 48 letters)

**Test 4D.1: Purchase Annual Plan**
1. Login as `test-free@example.com`
2. Purchase annual plan
3. **Verify DB**: `subscriptions.remaining_letters = 48`
4. **Verify UI**: Quota shows 48 letters

**Test 4D.2: Letter Generation Decrements Quota**
1. Login as `test-annual@example.com`
2. Generate 2 letters
3. **Verify DB**: `remaining_letters = 46`
4. **Verify UI**: Quota updated to 46

**Test 4D.3: Quota Exhaustion**
1. Simulate `remaining_letters = 0`
2. Attempt to generate letter
3. **Verify**: Generation blocked
4. **Verify**: Clear message about exhausted quota
5. **Verify**: Option to purchase more letters

### Webhook Handling

#### Location: `/api/stripe/webhook/route.ts`

**Handled Events:**
| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/activate subscription |
| `invoice.payment_succeeded` | Renew subscription, update period |
| `invoice.payment_failed` | Set status to `payment_failed` |
| `customer.subscription.updated` | Sync subscription changes |
| `customer.subscription.deleted` | Set status to `canceled` |

#### Idempotency Strategy

**Q: What happens if same webhook is delivered twice?**
A: The `webhook_events` table stores `stripe_event_id` with a unique constraint. Before processing, we check if the event was already processed:

```typescript
// Check for duplicate webhook
const { data: existing } = await supabase
  .from('webhook_events')
  .select('id')
  .eq('stripe_event_id', event.id)
  .single();

if (existing) {
  return NextResponse.json({ received: true, duplicate: true });
}
```

#### Annual Letter Quota Enforcement

**Q: Where is annual '48 letters' enforced?**
A: Server-side check in `/api/generate-letter/route.ts`:

```typescript
// Check remaining letters for annual plan
if (subscription.plan_type === 'annual') {
  if (subscription.remaining_letters <= 0) {
    return NextResponse.json(
      { error: 'Letter quota exhausted' },
      { status: 403 }
    );
  }
}
```

### Test Data for Stripe

**Test Cards:**
| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Decline |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 3220` | 3D Secure required |

**Test Webhook Events:**
Use Stripe CLI to trigger test webhooks:
```bash
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```
