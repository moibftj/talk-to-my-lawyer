# Copilot Instructions for Talk-To-My-Lawyer

This file provides guidance to GitHub Copilot when working with code in this repository.

## Product Summary

**Talk-To-My-Lawyer** is a web application where:

- **Subscribers**:
  - Fill out a detailed intake form about a legal issue
  - The system creates a **first-draft legal-style letter** using OpenAI (server-side)
  - A **human admin (single attorney)** reviews, edits, and approves the letter
  - Subscribers see the final, attorney-reviewed letter in their **My Letters** area and can download/email it as a PDF

- **Employees**:
  - Are referral/affiliate partners
  - Get a **coupon code** that gives subscribers **20% off**
  - Earn **5% commission** on each subscription purchased using their coupon
  - **Never see letters** or letter content

- **Admin (single)**:
  - Only one admin exists in the entire system
  - Works from a **single Review Center**
  - Manually reviews every letter draft, edits it as needed, and approves/rejects it
  - Once approved, the letter appears as a final document in the subscriber's **My Letters** area

## Non-Negotiable Rules

1. **Only subscribers can generate letters** - Letter intake form and generation APIs are **subscriber-only**. Employees and admin must never be able to generate letters through the regular UI/API.

2. **Single-admin architecture** - There is exactly **one** admin user. One **global Review Center** for all letters. No multi-admin delegation.

3. **Admin review is mandatory** - No letter is ever considered "final" until the admin has manually reviewed and approved it. Subscribers never get "raw AI" letters.

4. **Employees never see letter content** - Their entire world is: their coupon, coupon usage stats, and commissions. They never see subscriber letters or PII beyond aggregated stats.

5. **Do not leak secrets** - Never print or log env var values, keys, tokens, or portal secrets. You may refer to **names** like `OPENAI_API_KEY`, but not values.

6. **Do not change core stack without explicit user instruction** - Next.js (App Router, TS) + Supabase + Stripe + OpenAI + Redis/Upstash. No random framework swaps.

7. **Respect RLS and roles** - Never suggest disabling RLS. All DB access must respect role & user scoping.

8. **Prefer minimal, surgical changes** - When fixing/aligning, make the smallest clear change that restores correct behaviour.

9. **Update docs or leave TODOs when you change behaviour** - If you alter flows, APIs, or DB structure, either update documentation or leave a clear TODO.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19 and TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **Payments**: Stripe integration
- **AI**: OpenAI GPT-4 Turbo via Vercel AI Gateway
- **Email**: Resend (primary), Brevo, SendGrid, SMTP (configurable)
- **Rate Limiting**: Upstash Redis
- **Package Manager**: pnpm (use `pnpm` for all package operations)

## Project Structure

- `/app/` - Next.js App Router pages and API routes
  - `api/` - API routes organized by feature
  - `auth/` - Authentication pages (login, signup, password reset)
  - `dashboard/` - Subscriber dashboard and management
  - `secure-admin-gateway/` - Admin portal with restricted access
- `/components/` - Reusable React components (shadcn/ui based)
- `/lib/` - Server utilities and domain logic
  - `auth/` - Authentication utilities
  - `ai/` - AI service integrations
  - `email/` - Email providers and queue
  - `security/` - CSRF, validation, sanitization
- `/types/` - Shared TypeScript types
- `/supabase/` - Database migrations
- `/scripts/` - Utility scripts

## Coding Guidelines

- Prefer functional React components with hooks
- Use Server Actions and API routes under `app/api/`
- Always declare `'use client'` for client components
- Use TypeScript with strict mode enabled
- Follow existing patterns for error handling in API routes
- Maintain consistent `NextResponse.json` response payloads
- Use Zod schemas for input validation
- Never wrap imports in try/catch blocks
- Keep Tailwind/shadcn patterns for styling

## Build and Test Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Lint code (required before delivery)
pnpm lint

# Build for production (CI=1 enables stricter checks)
CI=1 pnpm build

# Validate environment variables
pnpm validate-env

# Health check
pnpm health-check
```

## Roles and Access

### Subscriber
- Created through normal signup (Supabase Auth)
- `profiles.role = 'subscriber'`
- **Capabilities**: Access subscriber dashboard, generate letters (subject to free trial & allowance), view **own** letters in My Letters, manage their subscription, manage own profile
- **Cannot**: Access employee/commission data, access admin portal, see other users' letters

### Employee
- Created through normal signup, but with `role = 'employee'`
- **Capabilities**: Log in to **employee dashboard**, see their own coupon code (20% discount), see aggregated coupon usage metrics, see their own commissions (5% per subscription)
- **Cannot**: Access any letter content, access subscriber dashboards, access admin portal, generate letters, call letter APIs

### Admin (Single Admin)
- There is exactly **one** admin user in the entire system
- Created manually (one entry in `auth.users` + `profiles` with `role = 'admin'`)
- **Capabilities**: Access **single global Review Center**, see **all letters** and their statuses, manually edit letter drafts, approve/reject letters, view all subscriber profiles & subscription status, view all employees, coupons, coupon usage, commissions
- **Cannot**: Be created through any normal signup path, be changed via user UI (role promotion must be manual/DB-only)

## Letter Workflow States

`draft` → `generating` → `pending_review` → `under_review` → `approved`/`rejected`/`completed`/`failed`

## Pricing (Reference)

Pricing tiers (subject to change - check Stripe configuration for current values):
- Single letter: $299 (one-time)
- Monthly: $299/month (4 letters per month)
- Yearly: $599/year (8 letters per year)
- First letter is free (free trial)
