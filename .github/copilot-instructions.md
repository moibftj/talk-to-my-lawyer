# Copilot Instructions for Talk-To-My-Lawyer

AI legal letter drafting with **mandatory attorney review**.

## Canonical policies and routes

This repository uses AGENTS.md as the canonical source for AI/agent policies, workflows, and **detailed API routes**. Keep this file short to avoid drift.

- Canonical policies and workflows: See [AGENTS.md](/AGENTS.md)
- Detailed routes list: See "API Routes (detailed)" section in AGENTS.md
- Types list: See "Types (centralized)" section in AGENTS.md

## Repo conventions (summary)

- Only subscribers can generate letters; admins/attorneys review drafts before release.
- Employees never see letter content.
- Respect Supabase RLS; never disable it.
- Do not log sensitive information or secrets.
- Use pnpm only.
