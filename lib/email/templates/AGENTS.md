# Email Templates Agent Instructions

Email templates for all user notifications in Talk-To-My-Lawyer.

## Available Templates

All templates are defined in [../templates.ts](../templates.ts).

### Template List (18 total)

| Template ID | Purpose | Recipients | Required Data |
|------------|---------|-----------|---------------|
| `welcome` | Welcome new users | All users | `userName`, `actionUrl` |
| `password-reset` | Password reset link | All users | `actionUrl` |
| `password-reset-confirmation` | Password changed | All users | `userName`, `loginUrl` |
| `letter-approved` | Letter approved | Subscribers | `userName`, `letterTitle`, `letterLink` |
| `letter-rejected` | Letter needs revision | Subscribers | `userName`, `letterTitle`, `alertMessage`, `letterLink` |
| `letter-generated` | AI generation complete | Subscribers | `userName`, `letterTitle`, `actionUrl` |
| `letter-under-review` | Review in progress | Subscribers | `userName`, `letterTitle`, `alertMessage`, `pendingReviews` |
| `commission-earned` | New commission | Employees | `userName`, `commissionAmount`, `actionUrl` |
| `commission-paid` | Commission processed | Employees | `userName`, `commissionAmount`, `actionUrl` |
| `subscription-confirmation` | Payment successful | Subscribers | `userName`, `subscriptionPlan`, `actionUrl` |
| `subscription-renewal` | Renewal reminder | Subscribers | `userName`, `subscriptionPlan`, `actionUrl` |
| `subscription-cancelled` | Subscription ended | Subscribers | `userName`, `subscriptionPlan`, `actionUrl` |
| `payment-failed` | Payment error | Subscribers | `userName`, `subscriptionPlan`, `amountDue`, `actionUrl` |
| `account-suspended` | Account disabled | All users | `userName`, `suspensionReason`, `actionUrl` |
| `free-trial-ending` | Trial expiration | Subscribers | `userName`, `trialDaysRemaining`, `actionUrl` |
| `onboarding-complete` | Onboarding progress | All users | `userName`, `completedSteps`, `totalSteps`, `actionUrl` |
| `security-alert` | Security event | All users | `alertMessage`, `actionUrl` |
| `system-maintenance` | Maintenance notice | All users | `alertMessage` |
| `admin-alert` | Admin notifications | Admins/Attorneys | `alertMessage`, `actionUrl`, `pendingReviews` |

## Template Usage

### Sending a Template Email

```typescript
import { queueTemplateEmail } from '@/lib/email'

// Example: Welcome email
await queueTemplateEmail(
  'welcome',
  'user@example.com',
  {
    userName: 'John',
    actionUrl: 'https://talk-to-my-lawyer.com/dashboard'
  }
)

// Example: Letter approved
await queueTemplateEmail(
  'letter-approved',
  'user@example.com',
  {
    userName: 'Jane',
    letterTitle: 'Demand Letter to Landlord',
    letterLink: 'https://talk-to-my-lawyer.com/dashboard/letters/123'
  }
)

// Example: Commission earned
await queueTemplateEmail(
  'commission-earned',
  'employee@example.com',
  {
    userName: 'Bob',
    commissionAmount: 10.50,
    actionUrl: 'https://talk-to-my-lawyer.com/dashboard/commissions'
  }
)
```

## Adding a New Template

### Step 1: Define Template Type

Edit [../types.ts](../types.ts) and add to `EmailTemplate` type:

```typescript
export type EmailTemplate =
  | 'welcome'
  | 'password-reset'
  // ... existing templates
  | 'your-new-template' // Add here
```

### Step 2: Add Template Data Interface

In [../types.ts](../types.ts), update `TemplateData` interface if needed:

```typescript
export interface TemplateData {
  // Existing fields
  userName?: string
  actionUrl?: string
  // Add new fields if needed
  yourNewField?: string
}
```

### Step 3: Implement Template

In [../templates.ts](../templates.ts), add to the `templates` object:

```typescript
const templates: Record<EmailTemplate, (data: TemplateData) => TemplateOutput> = {
  // ... existing templates

  'your-new-template': (data) => ({
    subject: `Subject Line - ${escapeHtml(data.userName)}`,
    text: `
      Plain text version

      Hi ${data.userName || 'there'},

      Your message here.

      ${data.actionUrl ? `Link: ${data.actionUrl}` : ''}

      Best regards,
      The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Email Heading</h2>
      <p>Hi ${escapeHtml(data.userName || 'there')},</p>

      <p>Your HTML message here.</p>

      <div class="highlight">
        <strong>Important information in a box</strong>
      </div>

      ${data.actionUrl ? `
        <p style="text-align: center;">
          <a href="${escapeHtml(data.actionUrl)}" class="button">Click Here</a>
        </p>
      ` : ''}

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `),
  }),
}
```

### Step 4: Use Security Functions

**Always use these helpers to prevent XSS:**

```typescript
// Escape HTML entities
escapeHtml(data.userName)  // "John" → "John", "<script>" → "&lt;script&gt;"

// Escape and convert newlines to <br>
nl2br(data.message)  // "Line 1\nLine 2" → "Line 1<br>Line 2"

// Wrap email body with layout
wrapHtml(content)  // Adds header, footer, styling
```

### Step 5: Test the Template

```bash
# Create test file: test-new-template.js
node test-new-template.js
```

```javascript
// test-new-template.js
require('dotenv').config({ path: '.env.local' })
const { queueTemplateEmail } = require('./lib/email')

async function test() {
  const result = await queueTemplateEmail(
    'your-new-template',
    'test@example.com',
    {
      userName: 'Test User',
      actionUrl: 'https://example.com'
    }
  )
  console.log('Result:', result)
}

test()
```

## Template Styling

### Available CSS Classes

Defined in [../templates.ts:42-51](../templates.ts#L42-L51):

```css
.container   /* Max-width container with padding */
.header      /* Dark header with logo area */
.content     /* White content area */
.footer      /* Light gray footer */
.button      /* Primary CTA button */
.highlight   /* Blue highlighted box */
```

### Custom Styles

Use inline styles for custom formatting:

```html
<p style="text-align: center; color: #666;">Centered gray text</p>
<div style="background: #fef2f2; padding: 15px; border-left: 4px solid #dc2626;">
  Red alert box
</div>
```

## Common Template Issues

### Issue 1: Template Not Found

**Error:** `Unknown email template: xyz`

**Solution:**

1. Check template name is added to `EmailTemplate` type in [../types.ts](../types.ts)
2. Check template is implemented in [../templates.ts](../templates.ts)
3. Check spelling matches exactly (case-sensitive)

### Issue 2: Missing Data Fields

**Error:** Email shows "undefined" or blank fields

**Solution:**

1. Check all required data is passed when sending
2. Use default values: `data.userName || 'there'`
3. Add conditional rendering:

   ```typescript
   ${data.actionUrl ? `<a href="${escapeHtml(data.actionUrl)}">Click</a>` : ''}
   ```

### Issue 3: Broken HTML/Styling

**Symptoms:**

- Email looks plain/unstyled
- HTML tags visible as text
- Broken layout

**Solutions:**

1. **Always use `wrapHtml()`** for HTML content
2. **Use inline styles** (some clients ignore `<style>` tags)
3. **Test in multiple clients:**
   - Gmail (web, mobile)
   - Outlook
   - Apple Mail
   - Mobile clients

### Issue 4: XSS Vulnerabilities

**Symptoms:**

- Security scan warnings
- HTML injection possible

**Solutions:**

1. **Always use `escapeHtml()`** for user data:

   ```typescript
   // ❌ WRONG - XSS vulnerability
   html: `<p>Hello ${data.userName}</p>`

   // ✅ CORRECT
   html: `<p>Hello ${escapeHtml(data.userName)}</p>`
   ```

2. **Use `nl2br()` for multi-line text:**

   ```typescript
   // Escapes HTML AND converts newlines
   ${nl2br(data.message)}
   ```

## Template Data Reference

### Common Fields

```typescript
interface TemplateData {
  // User info
  userName?: string          // User's first name or full name
  userEmail?: string         // User's email

  // Actions
  actionUrl?: string         // Primary CTA link
  loginUrl?: string          // Login page link

  // Letters
  letterTitle?: string       // Letter title
  letterLink?: string        // Link to letter

  // Billing
  subscriptionPlan?: string  // Plan name
  commissionAmount?: number  // Dollar amount
  amountDue?: string         // Amount owed

  // Status
  alertMessage?: string      // Alert/notification message
  pendingReviews?: number    // Count of pending items

  // Trial/Onboarding
  trialDaysRemaining?: number
  completedSteps?: number
  totalSteps?: number

  // Suspension
  suspensionReason?: string
}
```

## Testing Templates

### Visual Testing

1. Send test email to yourself
2. Check in multiple email clients
3. Test on mobile devices
4. Verify all links work
5. Check spam score (use mail-tester.com)

### Automated Testing

```bash
# Test template rendering
node scripts/test-email-templates.js
```

### Preview Templates

```bash
# Generate HTML preview
node scripts/preview-template.js welcome
```

## Best Practices

### DO:

✅ Use `escapeHtml()` for all user data
✅ Use `wrapHtml()` for consistent layout
✅ Provide plain text version
✅ Use descriptive subjects
✅ Include clear CTAs
✅ Test in multiple clients
✅ Use default values for optional fields
✅ Keep HTML simple (tables for layout if needed)

### DON'T:

❌ Insert user data without escaping
❌ Use only HTML (always include text version)
❌ Use complex CSS (gets stripped)
❌ Use JavaScript (won't work in emails)
❌ Use background images (often blocked)
❌ Forget to test on mobile
❌ Use vague subjects ("Update", "Notification")

## Need Help?

1. Check [../AGENTS.md](../AGENTS.md) for email service debugging
2. Review existing templates for examples
3. Test with `node test-email-send.js`
4. Check Resend dashboard for delivery issues
5. Use mail-tester.com to check spam score

## Quick Reference

```typescript
// Render a template
import { renderTemplate } from '@/lib/email/templates'
const { subject, text, html } = renderTemplate('welcome', { userName: 'John' })

// Send a template
import { queueTemplateEmail } from '@/lib/email'
await queueTemplateEmail('welcome', 'user@example.com', { userName: 'John', actionUrl: '...' })
```
