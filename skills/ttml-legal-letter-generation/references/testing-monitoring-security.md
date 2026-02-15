# Testing, Monitoring, and Security

## Table of Contents
- Test Checklist
- Runtime Monitoring
- Security Controls
- Audit and Compliance

## Test Checklist

### Unit Tests
- Intake validation rejects malformed or missing required fields.
- Allowance guard prevents generation with zero quota.
- Rate limiter enforces user-scoped threshold.
- Status transitions reject invalid next states.
- PDF generator validates content and metadata mapping.
- Email queue retries and logs failures.

### Integration Tests
- End-to-end flow: intake -> generation -> review -> PDF -> download.
- n8n path succeeds under expected latency.
- OpenAI fallback activates when n8n fails or times out.
- Attorney approval sets reviewer fields and approval timestamps.
- Attorney rejection triggers allowance refund.
- Signed URL generation works and expires as expected.

### Load/Resilience Tests
- Concurrent generation requests do not corrupt allowance counters.
- Rate limit prevents abusive request floods.
- Database pool remains healthy under peak load.
- Generation providers respect quota and timeout constraints.
- Storage handles PDF upload/download throughput.

## Runtime Monitoring
Track and alert on:
- generation success rate (target >95%).
- n8n availability (target >99%).
- OpenAI fallback rate (target <5%).
- attorney review latency (target <24h median/expected SLA).
- PDF generation success (target >99%).

Example alert triggers:
- generation failures >5% within 1 hour.
- n8n unavailable for >5 minutes.
- repeated OpenAI API failures in short interval.
- no attorney queue processing for 48 hours.
- abnormal PDF failure or storage error spikes.

## Security Controls

### Input and Validation
- Strip unsafe HTML/script input from text fields.
- Enforce strict field length boundaries.
- Validate jurisdiction and letter type enums.
- Reject ambiguous payloads with actionable errors.

### Access Control
- Subscriber-only generation route.
- RLS restricts subscribers to their own letters.
- Attorney admins can access review queue and decision routes.
- Signed URL expiry for file access.

### Data Protection
- Use TLS for all service calls.
- Keep secrets in env vars and server-only contexts.
- Minimize storage of sensitive derived data.
- Apply retention policy for rejected/failed artifacts as required.

## Audit and Compliance
- Log every status transition with actor + timestamp.
- Log allowance deductions/refunds with reason codes.
- Record reviewer decisions and comments.
- Log download/email actions for traceability.
- Keep structured failure logs for incident review.
