# Talk-To-My-Lawyer

AI-powered legal letter generation platform with mandatory attorney review.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **AI**: OpenAI GPT-4 Turbo via Vercel AI Gateway
- **Email**: Resend (primary), Brevo, SendGrid, or SMTP (configurable via EMAIL_PROVIDER)
- **Rate Limiting**: Upstash Redis

## Features

- AI-generated legal letters with attorney review workflow
- Subscription-based access with Stripe integration
- Employee referral system with commission tracking
- **Multi-admin portal** - Multiple admins can share letter review duties
- Email queue system for reliable delivery
- GDPR compliance (data export/deletion)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account
- Stripe account
- OpenAI API key

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# OpenAI via Vercel AI Gateway
OPENAI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Admin Portal (for multi-admin access)
ADMIN_PORTAL_KEY=

# Email Service (choose provider)
EMAIL_PROVIDER=resend  # Options: resend, brevo, sendgrid, smtp, console
EMAIL_FROM=noreply@talk-to-my-lawyer.com
EMAIL_FROM_NAME=Talk-To-My-Lawyer

# Resend (recommended)
RESEND_API_KEY=

# Or Brevo
BREVO_API_KEY=

# Or SendGrid
SENDGRID_API_KEY=

# Or SMTP
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Rate Limiting (Upstash Redis)
KV_REST_API_URL=
KV_REST_API_TOKEN=

# Application
NEXT_PUBLIC_SITE_URL=
```

### Development

```bash
pnpm install
pnpm dev
```

### Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

## Database Setup

Run the SQL migrations in order:

1. **Scripts**: Run `/scripts/*.sql` files in order (001-023) in Supabase SQL Editor
2. **Migrations**: Run `/supabase/migrations/*.sql` files in order

## Creating Admin Users

The platform supports **multiple admin users** who share the same admin dashboard.

### Create an Admin User

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password>
```

**Example:**
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts admin@company.com SecurePass123!
```

### Admin Login

1. Go to `/secure-admin-gateway/login`
2. Enter email & password (their own credentials)
3. Enter the Admin Portal Key (from `ADMIN_PORTAL_KEY` env var)

### How Multi-Admin Works

- Each admin has their own Supabase Auth account
- All admins share the same dashboard at `/secure-admin-gateway`
- Admin access is controlled by `role = 'admin'` in the `profiles` table
- All admins can review, approve, and reject letters

## License

Private - All rights reserved
