# Copilot Instructions for Talk-To-My-Lawyer

AI legal letter drafting with **mandatory attorney review**.

## Canonical policies and routes

This repository uses AGENTS.md as the canonical source for AI/agent policies, workflows, and **detailed API routes**. Keep this file short to avoid drift.

- Canonical policies and workflows: [AGENTS.md](AGENTS.md)
- Detailed routes list: [AGENTS.md](AGENTS.md#api-routes-detailed)
- Types list: [AGENTS.md](AGENTS.md#types-centralized)

## Repo conventions (summary)

- Only subscribers can generate letters; admins/attorneys review drafts before release.
- Employees never see letter content.
- Respect Supabase RLS; never disable it.
- Do not log sensitive information or secrets.
- Use pnpm only.
