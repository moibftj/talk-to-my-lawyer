# Talk-To-My-Lawyer

## Overview
A Next.js web application that provides professional lawyer-drafted letters for various legal needs (breach of contract, demand for payment, cease and desist, etc.). Users can get letters for $50 each with attorney review and PDF download.

## Project Architecture
- **Framework**: Next.js 16.x with App Router (Turbopack in dev)
- **Language**: TypeScript
- **Package Manager**: pnpm 10.x
- **Styling**: Tailwind CSS 4.x with Radix UI components
- **Auth**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **AI**: OpenAI via Replit AI Integrations (letter generation, gpt-4o model)
- **Email**: Resend
- **Rate Limiting**: Upstash Redis

## Key Configuration
- Dev server runs on port 5000 (0.0.0.0)
- `next.config.mjs` configured with `allowedDevOrigins` for Replit proxy
- Frame-ancestors set to `*` to allow Replit iframe embedding
- Standalone output mode for production deployment

## Required Environment Variables
### Critical (needed for basic dev)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

### Production
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (auto-set by Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (auto-set by Replit AI Integrations)
- `OPENAI_API_KEY` - OpenAI API key (fallback, optional if AI Integrations configured)
- `RESEND_API_KEY` - Resend email API key
- `ADMIN_EMAIL` - Admin email
- `ADMIN_PORTAL_KEY` - Admin portal access key
- `CRON_SECRET` - Cron job auth secret

## Project Structure
- `app/` - Next.js App Router pages and API routes
- `app/api/` - Backend API endpoints (auth, stripe, letters, admin, etc.)
- `app/dashboard/` - User dashboard pages
- `app/attorney-portal/` - Attorney review portal
- `app/auth/` - Authentication pages (login, signup, etc.)
- `components/` - Reusable UI components
- `lib/` - Utility libraries and helpers
- `scripts/` - Build/deploy/migration scripts
- `public/` - Static assets

## Recent Changes
- 2026-02-06: Integrated Replit AI Integrations for OpenAI (auto-managed API key, gpt-4o model)
- 2026-02-06: Updated OpenAI client with AI integrations priority + backward compat fallback
- 2026-02-06: Fixed TypeScript type errors in letter generation endpoint
- 2026-02-06: Verified notification flow: generation → admin notify → review → approve/reject → user notify
- 2026-02-06: Configured for Replit environment (port 5000, proxy support, iframe embedding)
