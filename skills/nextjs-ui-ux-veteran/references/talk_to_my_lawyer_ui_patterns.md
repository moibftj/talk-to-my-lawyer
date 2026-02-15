# Talk-to-My-Lawyer UI Patterns

Use this file first for project-specific implementation choices.

## Core Sources
- Theme variables and custom utilities: `app/globals.css`
- Semantic color mappings: `lib/design-tokens.ts`
- Shared primitives: `components/ui/*`

## Existing Patterns to Reuse

### Buttons
- `components/ui/button.tsx` uses CVA variants and includes project-specific variants:
  - `default` (blue accent)
  - `pricing`
  - `primary_animated`
  - `running_border`
- Prefer extending this file for new button behaviors.

### Scroll Reveal
- `components/ui/scroll-reveal.tsx` reveals elements with `IntersectionObserver` and class toggles.
- `components/home/scroll-reveal-wrapper.tsx` centrally observes `.scroll-reveal` and `.reveal-on-scroll`.
- Reuse class-based reveal pattern for low-overhead animations.

### High-Polish CTA Pattern
- `components/ui/generate-letter-button.tsx` + module CSS demonstrates:
  - offscreen animation pausing via `IntersectionObserver`
  - page visibility pausing via `document.hidden`
  - reduced motion and touch considerations in CSS
- Reuse this approach when introducing continuous/glimmer effects.

### Layout Shells
- Top-level sections often use max-width containers with responsive paddings.
- Navigation patterns mix sticky backdrop blur and strong CTA placement.

## Color and Utility Notes
- Custom utility classes exist for legal gradients and premium cards/buttons.
- Keep contrast strong for legal text readability.
- Prefer semantic Tailwind tokens where possible, then fallback to known project colors.

## Implementation Checklist
- Reuse `components/ui` primitive before introducing new component API.
- Keep `"use client"` isolated to interactive components.
- Include keyboard and reduced-motion behavior for animated UI.
- Validate mobile layout and touch target sizes.
