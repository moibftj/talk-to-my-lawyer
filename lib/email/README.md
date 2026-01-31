# Email System Documentation

This directory contains the complete email notification system for Talk-To-My-Lawyer, powered by Resend.

## Overview

The email system supports two approaches:

1. **React Email Components** - Modern, component-based email templates with full React support
2. **Traditional Templates** - Simple HTML templates with variable substitution

## Directory Structure

```
lib/email/
├── react-email/              # React Email components
│   ├── EmailLayout.tsx       # Base layout wrapper
│   ├── WelcomeEmail.tsx      # Welcome email template
│   ├── PasswordResetEmail.tsx
│   ├── LetterApprovedEmail.tsx
│   ├── LetterRejectedEmail.tsx
│   └── EmailConfirmationEmail.tsx
├── providers/                # Email provider implementations
│   └── resend.ts            # Resend provider
├── service.ts               # Core email service
├── react-email-service.ts   # React Email integration
├── email-utils.ts           # Utility functions
├── templates.ts             # Traditional HTML templates
├── types.ts                 # TypeScript types
└── queue.ts                 # Email queue for reliability

app/
├── actions/
│   └── email-actions.ts     # Server Actions for emails
└── api/email/send/
    └── route.ts             # API Route for emails

scripts/
└── create-resend-templates.mjs  # Script to create templates in Resend
```

## Usage

### Using Server Actions (Recommended for Server Components)

```typescript
import { sendWelcomeEmail, sendPasswordResetEmail } from '@/app/actions/email-actions';

// Send a welcome email
await sendWelcomeEmail(
  'user@example.com',
  'John Doe',
  'https://talk-to-my-lawyer.com/dashboard'
);

// Send a password reset email
await sendPasswordResetEmail(
  'user@example.com',
  'John Doe',
  'https://talk-to-my-lawyer.com/auth/reset-password?token=abc123'
);
```

### Using API Routes (For Client Components or External Integrations)

```typescript
const response = await fetch('/api/email/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'react',
    templateName: 'welcome',
    to: 'user@example.com',
    subject: 'Welcome to Talk-To-My-Lawyer!',
    data: {
      userName: 'John Doe',
      actionUrl: 'https://talk-to-my-lawyer.com/dashboard',
    },
  }),
});

const result = await response.json();
```

### Using the Email Service Directly

```typescript
import { sendReactEmail } from '@/lib/email/react-email-service';

const result = await sendReactEmail(
  'welcome',
  'user@example.com',
  {
    userName: 'John Doe',
    actionUrl: 'https://talk-to-my-lawyer.com/dashboard',
  },
  'Welcome to Talk-To-My-Lawyer!'
);
```

## Available Templates

### React Email Templates

- `welcome` - Welcome new users
- `password-reset` - Password reset requests
- `letter-approved` - Letter approval notifications
- `letter-rejected` - Letter rejection with feedback
- `email-confirmation` - Email address confirmation

### Traditional Templates

All templates from `types.ts` are available:
- `welcome`
- `email-confirmation`
- `password-reset`
- `letter-approved`
- `letter-rejected`
- `letter-generated`
- `letter-under-review`
- `commission-earned`
- `commission-paid`
- `subscription-confirmation`
- And more...

## Creating New Templates

### 1. Create a React Email Component

```typescript
// lib/email/react-email/MyNewEmail.tsx
import { Text, Button, Section } from '@react-email/components';
import { EmailLayout } from './EmailLayout';
import * as React from 'react';

interface MyNewEmailProps {
  userName?: string;
  actionUrl?: string;
  unsubscribeUrl?: string;
}

const MyNewEmail = ({ userName, actionUrl, unsubscribeUrl }: MyNewEmailProps) => (
  <EmailLayout title="My New Email" unsubscribeUrl={unsubscribeUrl}>
    <Text>Hi {userName || 'there'},</Text>
    <Text>This is my new email template.</Text>
    <Section style={{ textAlign: 'center' }}>
      <Button style={button} href={actionUrl}>
        Click Here
      </Button>
    </Section>
  </EmailLayout>
);

export default MyNewEmail;

const button = {
  backgroundColor: '#1a1a2e',
  color: 'white',
  padding: '12px 24px',
  textDecoration: 'none',
  borderRadius: '6px',
  margin: '20px 0',
};
```

### 2. Register the Component

Add it to `lib/email/react-email-service.ts`:

```typescript
import MyNewEmail from './react-email/MyNewEmail';

const emailComponents: Record<string, ReactEmailComponent> = {
  // ... existing components
  'my-new-email': MyNewEmail,
};
```

### 3. Create a Server Action (Optional)

Add to `app/actions/email-actions.ts`:

```typescript
export async function sendMyNewEmail(
  to: string,
  userName: string,
  actionUrl: string
): Promise<SendEmailResult> {
  try {
    const result = await sendReactEmail(
      'my-new-email',
      to,
      { userName, actionUrl },
      'My New Email Subject'
    );

    return {
      success: result.success,
      error: result.error,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('Failed to send my new email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

## Environment Variables

Required environment variables:

```env
RESEND_API_KEY=re_your_api_key_here
NEXT_PUBLIC_SITE_URL=https://talk-to-my-lawyer.com
EMAIL_REPLY_TO=support@talk-to-my-lawyer.com (optional)
ADMIN_EMAIL=admin@talk-to-my-lawyer.com (optional)
```

## Testing

To test email templates locally:

```typescript
import { renderReactEmail } from '@/lib/email/react-email-service';

const html = renderReactEmail('welcome', {
  userName: 'Test User',
  actionUrl: 'https://example.com',
});

console.log(html); // View the rendered HTML
```

## Resend Templates

Templates have been created in your Resend account:

- **Welcome** (ID: 2d7ad391-9dd2-415c-8b61-5f599266fa4b)
- **Password Reset** (ID: b4022e99-4810-46a4-bb6a-f17d954a096d)
- **Letter Approved** (ID: 6d1164a8-bb33-4abc-96b6-1f50cfdf06cc)

To create more templates programmatically, run:

```bash
RESEND_API_KEY=your_key pnpm tsx scripts/create-resend-templates.mjs
```

## Best Practices

1. **Always validate email addresses** before sending
2. **Include unsubscribe links** for marketing emails
3. **Use Server Actions** for server-side email sending
4. **Test templates** before deploying to production
5. **Monitor email delivery** through Resend dashboard
6. **Handle errors gracefully** and log failures
7. **Use the email queue** for critical notifications

## Troubleshooting

### Emails not sending

1. Check that `RESEND_API_KEY` is set correctly
2. Verify the API key has "Sending access" permissions
3. Check Resend dashboard for delivery status
4. Review application logs for error messages

### Templates not rendering correctly

1. Test the template with `renderReactEmail()`
2. Check for missing props or data
3. Verify all React Email components are imported correctly

### Rate limiting errors

The Resend API has rate limits. Use the email queue for bulk sending:

```typescript
import { queueTemplateEmail } from '@/lib/email/service';

await queueTemplateEmail('welcome', 'user@example.com', {
  userName: 'John Doe',
});
```
