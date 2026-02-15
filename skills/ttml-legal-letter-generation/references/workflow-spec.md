# TTML Legal Letter Generation Spec

## Table of Contents
- Workflow Overview
- Critical Rules
- API Route Structure
- Letter Types and Required Fields
- Phase 1: n8n Primary Generation
- Phase 2: OpenAI Fallback Generation
- Phase 3: Attorney Review Queue
- Phase 4: Attorney Portal Review Actions
- Phase 5: PDF Generation and Storage
- Phase 6: Subscriber Dashboard Delivery
- Error Handling and Refund Recovery

## Workflow Overview
1. Phase 1: User Intake and eligibility checks.
2. Phase 2: Allowance validation and atomic deduction.
3. Phase 3: AI generation (n8n primary, OpenAI fallback).
4. Phase 4: Attorney review queue and decisioning.
5. Phase 5: PDF generation/storage.
6. Phase 6: Subscriber delivery/download/email.

## Critical Rules
1. Never generate for non-subscribers.
- Require `profiles.role = 'subscriber'`.
- Require active subscription row for user.

2. Always verify allowance before generation.
- Use atomic allowance RPC.
- Prevent race conditions on concurrent requests.

3. Always attempt n8n first.
- Fallback to OpenAI only when n8n unavailable/fails.

4. Enforce valid status transitions.
- `draft -> generating -> pending_review -> under_review -> approved|rejected -> completed`
- Log each transition.

5. Apply timeout protection.
- Guard request lifecycle (for example 60s API timeout, ~55s upstream timeout).

6. Refund allowance on generation failures.
- Use atomic refund RPC.

7. Notify attorneys when letter enters `pending_review`.
- Queue notifications, do not block user response on email send.

8. Do not mark completed until PDF exists.
- `pdf_url` required before `completed`.

9. Validate intake via Zod.
- Return clear validation details for client correction.

10. Rate-limit generation endpoint.
- Enforce user-scoped rate limit (for example 10 per 10 minutes).

## API Route Structure
Endpoint: `POST /api/generate-letter`

Recommended pre-flight order:
1. Rate limit check.
2. Authentication and subscriber authorization.
3. Subscription and allowance guard.
4. Request payload validation.
5. Atomic allowance deduction.
6. Letter creation and status set to `generating`.
7. AI generation path (n8n then fallback).
8. Status update to `pending_review` and attorney notifications.

Example pre-flight skeleton:
```ts
const rateLimitResult = await safeApplyRateLimit(letterGenerationRateLimit, `letter-gen:${userId}`)
if (!rateLimitResult.success) return new Response('Rate limit exceeded', { status: 429 })

const { user, error } = await requireSubscriber(request)
if (error) return errorResponses.unauthorized('Authentication required')

const validation = validateLetterGenerationRequest(await request.json())
if (!validation.success) return errorResponses.badRequest('Invalid input', validation.error.errors)
```

## Letter Types and Required Fields

| Letter Type | Required Fields | Notes |
|---|---|---|
| demand-letter | sender/recipient identity + addresses, amount_owed, deadline_date, incident_description | Payment deadlines vary by state |
| cease-and-desist | sender/recipient identity + addresses, violation_description, demanded_action, deadline_date | IP and unfair competition rules vary |
| contract-breach | sender/recipient identity + addresses, contract_date, breach_description, remedy_sought | Limitation periods vary |
| eviction-notice | landlord/tenant identity + addresses, property_address, reason_for_eviction, notice_period | Notice windows vary by jurisdiction |
| employment-dispute | employee/employer identity + addresses, dispute_description, resolution_sought | At-will and contract contexts differ |
| consumer-complaint | consumer/business identity + addresses, complaint_description, resolution_sought | Consumer protection requirements vary |

Validation schema pattern:
```ts
const letterGenerationSchema = z.object({
  letterType: z.enum([
    'demand-letter',
    'cease-and-desist',
    'contract-breach',
    'eviction-notice',
    'employment-dispute',
    'consumer-complaint'
  ]),
  intakeData: z.object({
    sender_name: z.string().min(2).max(200),
    sender_address: z.string().min(10).max(500),
    recipient_name: z.string().min(2).max(200),
    recipient_address: z.string().min(10).max(500)
  }),
  jurisdiction: z.string().regex(/^[A-Z]{2}$/).optional()
})
```

## Phase 1: n8n Primary Generation
Use n8n whenever configured and reachable.

Decision gate:
```ts
const n8nAvailable = isN8nConfigured()
```

n8n flow contract:
1. Receive webhook payload from API route.
2. Normalize intake + jurisdiction.
3. Research jurisdiction context.
4. Generate letter draft with legal context.
5. Persist letter fields (`ai_draft_content`, `status`, `research_data`).
6. Return normalized success payload.

Example request payload:
```ts
const payload = {
  letter_id,
  user_id,
  letter_type,
  intake,
  metadata: { user_email, created_at: new Date().toISOString() }
}

await fetch(N8N_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(55000)
})
```

Expected response shape:
```ts
{
  success: true,
  letter_id: 'uuid',
  status: 'pending_review',
  ai_draft_content: '...',
  research_data: {
    statutes_cited: ['...'],
    disclosures_required: ['...'],
    jurisdiction_notes: '...'
  }
}
```

## Phase 2: OpenAI Fallback Generation
Use fallback when:
- n8n webhook missing.
- n8n timeout.
- n8n non-success response.
- n8n malformed payload.

Prompting expectations:
- Formal legal-business tone.
- No placeholder markers.
- No speculative statute citations unless safely generalized.
- Jurisdiction-aware framing when jurisdiction provided.

Example model configuration:
```ts
const completion = await openai.chat.completions.create({
  model: 'gpt-4-turbo',
  temperature: 0.3,
  max_tokens: 2000,
  top_p: 0.9,
  frequency_penalty: 0.3,
  presence_penalty: 0.3,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
})
```

Retry pattern:
- Up to 3 attempts with exponential backoff.
- Reject output that is too short or includes placeholders.

After successful generation:
1. Update letter with generated draft.
2. Transition `generating -> pending_review`.
3. Persist transition audit log.

## Phase 3: Attorney Review Queue
Trigger when status becomes `pending_review`.

Notification target:
- Admin profiles with `admin_sub_role` in `attorney_admin` and `super_admin`.

Queue email payload should include:
- attorney name
- user identity
- letter type
- letter id
- review URL
- submission timestamp

## Phase 4: Attorney Portal Review Actions
Portal routes:
- queue page: `/attorney-portal/letters`
- detail page: `/attorney-portal/letters/[id]`

Access rule:
- `role = admin` and sub-role allowed (`attorney_admin` or `super_admin`).

Queue query guidance:
- list statuses in `pending_review` and `under_review`
- order oldest-first for FIFO fairness

Approve action expectations:
1. Optimistic lock on current status.
2. Write reviewer metadata and review notes.
3. Transition `pending_review -> approved`.
4. Generate PDF async.
5. Notify subscriber of approval.

Reject action expectations:
1. Require meaningful rejection reason.
2. Write reviewer metadata and rejection reason.
3. Transition `pending_review -> rejected`.
4. Refund allowance.
5. Notify subscriber with next-step guidance.

## Phase 5: PDF Generation and Storage
Use external PDF service when configured.

PDF request should include:
- content (`final_content` or `ai_draft_content`)
- metadata (letter id/type, subscriber, reviewer)
- formatting (letter size, margins, font, spacing)

Storage flow:
1. Upload generated PDF to storage bucket.
2. Persist `pdf_url` in letter row.
3. Transition to `completed` only after successful URL write.

## Phase 6: Subscriber Dashboard Delivery
Route: `/dashboard/letters`

Delivery capabilities:
- filter/sort letters by status/date.
- view review status and timestamps.
- download signed PDF URL (short-lived).
- email copy actions via secure API route.

Download behavior:
1. Fetch letter metadata.
2. Refuse download if `pdf_url` absent.
3. Generate signed URL.
4. Trigger browser download.
5. Track audit/analytics event.

## Error Handling and Refund Recovery
Generation error flow:
1. Catch failure from n8n/OpenAI.
2. Refund allowance atomically.
3. Persist failure state and error summary.
4. Notify subscriber with support route.
5. Emit structured logs for ops analysis.
