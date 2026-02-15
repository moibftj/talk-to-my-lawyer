# Tailwind Design Patterns

Use this file when structuring styles for reusable Next.js components.

## Prefer Shared Primitives
- Start with `components/ui` primitives before creating custom wrappers.
- Extend existing variants (CVA) when behavior is already close.
- Keep one-off class lists local to leaf components.

## Token-First Styling
- Prefer semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`) over raw colors.
- Use custom legal utilities from `app/globals.css` when they match intent (`legal-card`, `btn-premium`, gradients).
- Use raw hex colors only when token coverage is insufficient and document why.

## Class Composition
- Keep class names grouped by concern:
  - layout (`flex`, `grid`, spacing)
  - typography
  - color/background
  - interaction/focus
  - motion/transition
- Use `cn()` for conditional composition.
- Keep responsive rules explicit at each breakpoint.

## Responsive Strategy
- Build mobile-first (`base -> sm -> md -> lg -> xl`).
- Use container width patterns seen in the repo (for example `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`).
- Validate typography scale and spacing at each breakpoint.

## Interaction and A11y
- Always include visible `focus-visible` styles.
- Keep touch targets at least `44x44` where practical.
- Use semantic elements first (`button`, `nav`, `section`, `dialog` pattern).

## Avoid
- Deeply nested conditional class strings that are hard to review.
- Excessive custom CSS when Tailwind utilities are sufficient.
- Introducing new design tokens without checking existing globals.
