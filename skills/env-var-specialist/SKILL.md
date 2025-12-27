---
name: env-var-specialist
description: Ensure environment variables for Talk-To-My-Lawyer are present, scoped correctly (server vs client), and synced across local env files and Vercel. Use when adding, auditing, or debugging env variables, or preparing deployments.
metadata:
  short-description: Ensure env variables are set properly
---

# Environment Variable Specialist (Talk-To-My-Lawyer)

## Quick workflow

1) Run `node scripts/validate-env.js` and use its output as the source of truth for required vs optional keys.
2) Confirm local env state in `.env.local` and placeholders in `.env.example` (no secrets).
3) If Vercel is involved, verify the target environment has the required keys:
   - `vercel env ls --token ...`
   - `vercel env pull .env.local --environment development|production --yes --token ...`
4) Re-run `node scripts/validate-env.js` after changes.

## Conventions

- Never commit secrets. `.env.local` is ignored by `.gitignore` and should stay local.
- Only expose keys to the client when they start with `NEXT_PUBLIC_`.
- Keep values single-line; avoid embedded newlines or trailing spaces.
- Prefer `DATABASE_URL` for scripts; use pooler URLs if direct IPv6 is blocked.

## When to update files

- If a new env key is introduced in code, add it to:
  - `scripts/validate-env.js` (required/optional list)
  - `.env.example` with a placeholder (no secrets)
- Do not add secrets to `.env.example`.

## References

- Read `scripts/validate-env.js` for the current required and optional keys.
