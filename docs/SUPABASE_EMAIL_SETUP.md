# Supabase Auth Email Setup

Supabase Auth confirmation, password reset, and magic-link emails are sent directly by Supabase (not by this app). Configure SMTP in the Supabase dashboard to ensure these emails are delivered reliably.

## Required Settings

1. Open **Supabase Dashboard → Authentication → Settings → SMTP**.
2. Provide your SMTP provider credentials (host, port, username, password).
3. Set the **Sender name** and **Sender email** to match `EMAIL_FROM` when possible.
4. Save and send a test email from the Supabase UI to validate delivery.

## Recommended Providers

- Resend SMTP
- SendGrid SMTP
- Postmark SMTP

## Environment Variables (App)

These are still required for application emails (welcome messages, queue notifications):

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Troubleshooting

- Confirmation emails not sent → verify SMTP credentials and **enable confirmation** in Supabase Auth.
- Emails delivered but marked as spam → configure SPF/DKIM with your email provider.
- Missing verification emails in staging → ensure the Supabase project SMTP settings are configured for that environment.

See also: [docs/EMAIL_SETUP.md](EMAIL_SETUP.md) and [docs/EMAIL_DELIVERABILITY_GUIDE.md](EMAIL_DELIVERABILITY_GUIDE.md).
