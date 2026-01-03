# Development Guide - Talk-To-My-Lawyer

Comprehensive development guide for the Talk-To-My-Lawyer platform, covering architecture, patterns, and best practices.

## Project Overview

AI-powered legal letter generation platform with mandatory attorney review. Subscribers generate AI drafts → admins review/approve → subscribers receive finalized letters as PDFs.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19 and TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **AI**: OpenAI GPT-4 Turbo via Vercel AI SDK
- **Email**: Resend (primary), with Brevo, SendGrid, and SMTP fallback
- **Rate Limiting**: Upstash Redis
- **Package Manager**: pnpm (exclusive - never use npm/yarn)

## Non-Negotiable Rules

1. **Only subscribers can generate letters** - Employees and admins must never access letter generation APIs
2. **Admin review is mandatory** - No "raw AI" letters reach subscribers; every letter requires approval
3. **Employees never see letter content** - They only see coupon stats and commissions
4. **Respect RLS** - Never disable Row Level Security; all DB access respects role scoping
5. **Do not leak secrets** - Never log env var values; refer to names like `OPENAI_API_KEY` only
6. **Use pnpm exclusively** - Never add npm/yarn lockfiles (`packageManager=pnpm@10.27.0`)

## Architecture Patterns

### API Route Structure

All routes under `app/api/` follow this pattern:

```typescript
import { createClient } from "@/lib/supabase/server"
import { safeApplyRateLimit, letterGenerationRateLimit } from '@/lib/rate-limit-redis'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'

export async function POST(request: NextRequest) {
  // 1. Rate limit
  const rateLimitResponse = await safeApplyRateLimit(request, letterGenerationRateLimit, 5, "1 h")
  if (rateLimitResponse) return rateLimitResponse

  // 2. Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return errorResponses.unauthorized()

  // 3. Role check via profiles table
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "subscriber") return errorResponses.forbidden("Only subscribers can...")

  // 4. Business logic...
  return successResponse(data)
}
```

### Supabase Client Usage

- **Server/API routes**: `import { createClient } from "@/lib/supabase/server"` (async)
- **Client components**: `import { createClient } from "@/lib/supabase/client"` (sync)

### Error Handling

Use helpers from `lib/api/api-error-handler.ts`:
- `errorResponses.unauthorized()`, `.forbidden()`, `.validation()`, `.notFound()`
- `successResponse(data, status?)` for consistent JSON responses
- `handleApiError(error, context)` in catch blocks

### Validation

Use schema-based validation from `lib/validation/letter-schema.ts`:
```typescript
const validation = validateLetterGenerationRequest(letterType, intakeData)
if (!validation.valid) return errorResponses.validation("Invalid input", validation.errors)
```

### Rate Limiting

Predefined limiters in `lib/rate-limit-redis.ts`:
- `authRateLimit` - 5/15min
- `apiRateLimit` - 100/1min
- `letterGenerationRateLimit` - 5/1hr
- `subscriptionRateLimit` - 3/1hr

Falls back to in-memory when Upstash unavailable.

## Key Domain Concepts

### User Roles (`profiles.role`)

- `subscriber` - Generate letters, view own letters, manage subscription
- `employee` - Coupon code (20% off), commission tracking (5%), never sees letters
- `admin` - Two sub-roles via `profiles.admin_sub_role`:
  - `system_admin` - Full access: Analytics, all users, all letters, coupon tracking, commission management
  - `attorney_admin` - Limited access: Letter review center, profile settings only

### Letter Status Flow

```
draft → generating → pending_review → under_review → approved/rejected/completed/failed
```

### Key Database RPCs (Supabase)

- `check_letter_allowance(user_id)` - Check remaining credits
- `deduct_letter_allowance(user_id)` - Atomic credit deduction
- `log_letter_audit(letter_id, action, ...)` - Audit trail

## Directory Structure

| Path | Purpose |
|------|---------|
| `app/api/` | Route handlers (letters, auth, subscriptions, admin) |
| `app/dashboard/` | Subscriber UI |
| `app/secure-admin-gateway/` | Admin portal (requires portal key + role) |
| `lib/auth/` | Auth guards, admin sessions, user helpers |
| `lib/api/` | Shared error handlers and response helpers |
| `lib/email/service.ts` | Provider-agnostic email with templates |
| `lib/validation/` | Input validation schemas |
| `lib/services/` | Business logic (allowance, subscriptions) |
| `scripts/*.sql` | DB migrations (run in numeric order) |
| `components/ui/` | shadcn/ui primitives |
| `components/admin/` | Admin-specific components |

## Core Workflows

### Letter Generation Flow

1. User selects letter type and fills intake form
2. API validates auth, role, and allowance
3. Deduct allowance BEFORE AI generation (prevents race conditions)
4. AI generates draft content with retry logic
5. Letter status updates: `draft` → `generating` → `pending_review`
6. Increment user's total letters counter
7. Log audit trail

### Admin Review Flow

1. Admin accesses review center at `/secure-admin-gateway/review`
2. Views letters with status `pending_review`
3. Starts review (status → `under_review`)
4. Options:
   - **Approve**: Provides final content, status → `approved`
   - **Reject**: Provides rejection reason, status → `rejected`
   - **Improve**: Requests AI improvement
5. Audit trail logged for all actions
6. Email notification sent to subscriber

### Subscription Flow

1. User selects plan and optional coupon code
2. Stripe checkout session created
3. User completes payment on Stripe
4. Webhook received at `/api/stripe/webhook`
5. Subscription record created with credits
6. If coupon used: Commission record created for employee
7. Email confirmation sent

## Component Conventions

- Functional React components with hooks
- `'use client'` directive only when interactive
- shadcn/ui primitives in `components/ui/`
- Tailwind for styling; use existing design tokens from `lib/design-tokens.ts`

## Essential Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Development server
pnpm lint             # Required before delivery
CI=1 pnpm build       # Production build (stricter checks)
pnpm validate-env     # Check environment variables
```

## Testing Approach

This project uses manual testing:

1. **Authentication Flow** - Test user registration, login, password reset
2. **Admin Access** - Test multi-admin login and actions
3. **Letter Generation** - Test each letter type with various inputs
4. **Payment Processing** - Test subscriptions with Stripe test cards
5. **Email Services** - Test delivery with configured provider

## Security Considerations

- All API routes require authentication
- Rate limiting via Upstash Redis
- CSRF protection enabled
- Content Security Policy headers configured
- Input validation uses Zod schemas
- Database uses Row Level Security (RLS)

## Development Best Practices

1. **Use ecosystem tools** - npm init, yeoman for scaffolding
2. **Run linters** - `pnpm lint` before committing
3. **Build locally** - `CI=1 pnpm build` to catch errors early
4. **Test rate limits** - Verify Upstash configuration
5. **Check health** - Use `/api/health` endpoint
6. **Review logs** - Monitor console output for warnings

## Common Patterns

### Creating New API Routes

1. Create route file in `app/api/`
2. Apply rate limiting with `safeApplyRateLimit`
3. Authenticate user with Supabase
4. Validate role and permissions
5. Use error handler helpers
6. Return structured JSON response

### Adding New Database Functions

1. Create migration file in `supabase/migrations/`
2. Define function with `SECURITY DEFINER`
3. Add RLS policies as needed
4. Test with sample data
5. Update TypeScript types

### Implementing New Features

1. Update database schema if needed
2. Create API routes with proper auth
3. Build UI components using shadcn/ui
4. Add validation schemas
5. Write audit trail entries
6. Test manually across user roles

## Debugging Tips

- **API Errors**: Check Vercel logs or console output
- **Auth Issues**: Verify Supabase credentials and RLS policies
- **Rate Limiting**: Check Upstash dashboard for quota
- **Email Delivery**: Use console provider for dev testing
- **AI Generation**: Check OpenAI API key and quota

## Performance Considerations

- Use `BatchSpanProcessor` for tracing in production
- Cache frequently accessed data with Redis
- Optimize database queries with indexes
- Use CDN for static assets
- Monitor Core Web Vitals

## Documentation Standards

- Keep README.md as main entry point
- Document all environment variables in `.env.example`
- Add inline comments for complex logic only
- Update architecture docs when adding major features
- Maintain migration order documentation

---

For more detailed information, see:
- **Setup**: [SETUP.md](./SETUP.md)
- **Admin Management**: [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Operations**: [OPERATIONS.md](./OPERATIONS.md)
