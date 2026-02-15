# Framer Motion Best Practices

Use this file when adding motion to new or existing UI components.

## Decide When to Use Motion
- Use motion to clarify state changes, hierarchy, or system feedback.
- Skip decorative motion that does not improve comprehension.
- Keep static fallback behavior acceptable before adding animation.

## Prefer Variant-Based Architecture
- Define `variants` for each state (`hidden`, `visible`, `exit`, `hover`, `tap`).
- Keep transitions colocated with variants for readability.
- Use parent/child orchestration (`staggerChildren`) for grouped reveals.

## Performance Rules
- Animate `transform` and `opacity` first.
- Avoid repeated animation of layout-affecting properties.
- Avoid per-frame state updates from React for purely visual effects.
- Use `LazyMotion` for larger animation surfaces to reduce bundle cost.

## Accessibility Rules
- Respect reduced motion using `useReducedMotion()`.
- Preserve visible focus states for keyboard users.
- Do not hide critical information behind animation timing.
- Keep modal/dialog transitions compatible with focus management.

## Common Patterns

### Enter/Exit Content
```tsx
<AnimatePresence mode="wait">
  {open ? (
    <motion.div
      key="panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    />
  ) : null}
</AnimatePresence>
```

### Reduced Motion Branch
```tsx
const prefersReducedMotion = useReducedMotion()
const animate = prefersReducedMotion
  ? { opacity: 1 }
  : { opacity: 1, y: 0 }
```

### Hover/Tap Feedback
```tsx
<motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} />
```

## Review Checklist
- Does animation communicate useful intent?
- Does reduced-motion mode preserve usability?
- Does motion remain smooth on low-end mobile devices?
- Is hydration scope constrained to interactive islands?
