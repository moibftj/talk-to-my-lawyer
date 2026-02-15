# Design System Guide

Use this file to keep visual output aligned with Talk-to-My-Lawyer.

## Visual Direction
- Prioritize trust, clarity, and professionalism.
- Use blue-forward accents with high readability.
- Keep generous whitespace and restrained decoration.

## Palette (Practical Mapping)
- Primary Blue: `#199df4` (CTA/accent, seen in button variants).
- Dark Blue: `#0a2540` to `#0d3a5c` (brand/legal gradients).
- Light Blue Surfaces: `#E0F7FA` style accents for subtle sections.
- Text Dark: near-slate for body/high contrast contexts.
- Text Muted: `text-muted-foreground` for secondary copy.

Source of truth remains `app/globals.css` and theme variables.

## Typography
- Body: sans (`font-sans`).
- Headings: serif (`font-serif`) for legal/editorial tone.
- Use tighter tracking and stronger weight for hero headings.

## Spacing and Layout
- Reuse section spacing utilities where available (`section-padding`).
- Prefer predictable content width shells (`max-w-*`, centered containers).
- Use consistent vertical rhythm between headings, body, and controls.

## Component Tone
- Buttons: confident, high contrast, clear hover/focus.
- Cards: light border + subtle shadow, avoid heavy skeuomorphic styling.
- Forms: prioritize clarity and validation affordances over decoration.

## Motion Tone
- Subtle and purposeful; avoid noisy choreography.
- Use stagger only for grouped entrances, not every element.
- Keep loading states informative and non-blocking.
