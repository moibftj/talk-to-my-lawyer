---
name: nextjs-ui-ux-veteran
description: Expert guidance for building modern, animated Next.js interfaces with React, Tailwind CSS, and Framer Motion, aligned to Talk-to-My-Lawyer UI conventions. Use when creating new UI features, upgrading existing components, implementing design-system patterns, improving responsive behavior, adding accessible animations, or optimizing front-end performance.
---

# Next.js UI/UX Veteran

## Overview
Design and implement production-ready UI in Next.js with strong visual quality, accessibility, and performance. Reuse Talk-to-My-Lawyer patterns before introducing new styling systems.

## Delivery Workflow
1. Audit existing UI and constraints.
- Read target route/component and nearby shared primitives in `components/ui`.
- Confirm server/client boundaries and keep `"use client"` scope minimal.
2. Define interaction and motion behavior.
- Specify states: idle, hover, focus, loading, disabled, error, success.
- Specify reduced-motion fallback before writing animation code.
3. Implement with project conventions first.
- Use design tokens and existing utility classes from `app/globals.css`.
- Use existing semantic mappings from `lib/design-tokens.ts`.
- Prefer extending shared components over one-off styles.
4. Add animation intentionally.
- Prefer `transform` and `opacity` animations.
- Use Framer Motion variants for clarity and consistency.
- Avoid layout-jank animations for frequently rendered components.
5. Validate and harden.
- Verify mobile/tablet/desktop layouts.
- Verify keyboard and screen-reader behavior.
- Verify color contrast and focus visibility.
- Verify performance impact (paint/layout cost and hydration scope).

## Talk-to-My-Lawyer Conventions
- Reuse color/theme variables from `app/globals.css` (`--primary`, `--background`, `--foreground`, and custom legal colors).
- Reuse semantic text/status classes from `lib/design-tokens.ts`.
- Reuse shared button variants in `components/ui/button.tsx` before creating new button styles.
- Follow existing reveal patterns in `components/ui/scroll-reveal.tsx` and `components/home/scroll-reveal-wrapper.tsx`.
- Preserve typography intent from globals (`font-sans` for body, serif headings).

## Animation Guardrails
- Implement `prefers-reduced-motion` behavior for all non-essential motion.
- Keep transitions short and purposeful (typically 150-350ms for UI interactions).
- Avoid animating expensive properties (`width`, `height`, `box-shadow`) in high-frequency interactions.
- Pause or simplify long-running effects when elements are offscreen.
- Do not block interaction during decorative animation.

## Resource Loading Guide
- Read `references/talk_to_my_lawyer_ui_patterns.md` first for repo-specific patterns.
- Read `references/design_system_guide.md` when selecting colors, type, spacing, and component tone.
- Read `references/tailwind_design_patterns.md` when structuring reusable Tailwind class strategy.
- Read `references/framer_motion_best_practices.md` when implementing motion with performance and accessibility constraints.
- Use `templates/animated_button.tsx` and `templates/modal_transition.tsx` as starting points, not final drop-ins.
