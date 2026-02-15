# Letter Workflow

## Table of Contents
- Status State Machine
- Generation Endpoint Guards
- n8n-First Generation Strategy
- OpenAI Fallback Strategy
- Attorney Review Lifecycle
- PDF Completion Requirements

## Status State Machine
Use strict ordered states:
`draft -> generating -> pending_review -> under_review -> approved|rejected -> completed`

Requirements:
- Never skip intermediate states.
- Log transitions via audit helper (`logLetterStatusChange` pattern).
- Apply optimistic status checks on review actions.

## Generation Endpoint Guards
Endpoint: `POST /api/generate-letter`

Execution order:
1. Rate limit check.
2. Auth and subscriber-role check.
3. Active subscription and allowance check.
4. Zod request validation.
5. Atomic allowance deduction.
6. Insert/update letter and set `generating`.
7. Attempt n8n path.
8. Fallback to OpenAI only on n8n failure.
9. Set `pending_review` and notify attorneys.

## n8n-First Generation Strategy
Attempt n8n first whenever configured.

Expected n8n outcome:
- writes/returns generated draft content.
- includes jurisdiction-aware legal context in metadata.
- transitions letter to `pending_review`.

Timeout guidance:
- upstream timeout around 55s.
- API safety timeout around 60s with recoverable background behavior.

## OpenAI Fallback Strategy
Fallback triggers:
- n8n URL missing.
- n8n timeout.
- non-2xx response.
- malformed response payload.

Fallback quality controls:
- low temperature for consistency.
- retry with exponential backoff.
- reject placeholder-filled output.
- enforce minimum viable content length.

## Attorney Review Lifecycle
When letter reaches `pending_review`:
- notify all attorney-capable admins through email queue.

Approve flow:
1. lock current status expectation.
2. mark reviewer metadata and review notes.
3. status `pending_review -> approved`.
4. trigger PDF generation.

Reject flow:
1. require rejection reason.
2. mark reviewer metadata and reason.
3. status `pending_review -> rejected`.
4. refund allowance atomically.

## PDF Completion Requirements
Do not mark `completed` until PDF storage succeeds and `pdf_url` is populated.

Delivery controls:
- subscriber dashboard lists letters by status.
- download uses short-lived signed URL.
- optional email copy action via secure API route.
