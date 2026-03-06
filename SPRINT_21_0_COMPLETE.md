# Sprint 21.0 Complete — Spring Animations + Final Polish

**Date:** 2026-03-06
**Status:** ✅ COMPLETE
**Commit:** (see git log)

## Objective

Replace all CSS `transition` / `animation` hacks on interactive surfaces with
Framer Motion spring physics. Centralise every variant and transition in
`lib/design/animations.ts` so no inline configs exist in components.

## Tasks Completed

### Task 1 — Animation config module ✅
Created `app/lib/design/animations.ts` — single source of truth for all
Framer Motion variants and transitions. Exports: `transitions`, `fadeIn`,
`slideInRight`, `slideInLeft`, `modalVariants`, `popoverVariants`,
`drawerSlide`, `drawerSlideLeft`, `panelSlideUp`, `expandCollapse`,
`buttonPress`, `cardLift`, `useAnimationConfig`.

Created `app/lib/design/index.ts` — barrel export for the full module.

### Task 2 — InspectorDrawer.tsx ✅
Replaced `if (!open) return null` guard + plain divs with `AnimatePresence` +
two `motion.div` elements: backdrop uses `fadeIn` (0.2s), drawer uses
`drawerSlide` (spring stiffness 300 / damping 30, exits in 0.3s).

### Task 3 — EventDetailPanel.tsx ✅
Replaced `.slide-in-right` CSS class with two separate `AnimatePresence`
blocks: backdrop (`fadeIn`) + panel (`drawerSlide` keyed on `event.id` so it
re-enters when the selected event changes). Removed duplicate import lines
introduced during context-boundary editing.

### Task 4 — GatePanel.tsx ✅
Already had `AnimatePresence` + `motion.div` applied. Added missing
`panelSlideUp` variant to `animations.ts` (y: 40→0 spring — correct for a
bottom-attached panel that slides up above the input bar). Exported from
`index.ts`.

### Task 5 — MemoryCard.tsx ✅
Already migrated: `motion.div` + `popoverVariants` (scale 0.95→1 spring).
Inline CSS `@keyframes fadeInCard` and `<style>` block removed in prior work.

### Task 6 — ReceiptFooter.tsx ✅
Already migrated: `AnimatePresence initial={false}` + `motion.div` with
`height: 0 → 'auto'` + `overflow: hidden`. CSS `max-height` transition
superseded.

### Task 7 — SendButton.tsx ✅
Already migrated: `motion.button` + `{...buttonPress}` on `normal` and
`approved` states only. `checking`, `warning`, `veto`, and `streaming`
states keep a plain `<button>` — no bounce on dangerous/loading actions.

### Task 8 — GhostCard.tsx ✅
Already migrated: `motion.div` + `{...cardLift}` on card wrapper. Fixed tsc
error (`CSSProperties` vs `MotionStyle` under `exactOptionalPropertyTypes`)
by removing explicit `React.CSSProperties` annotations from `cardBase` and
`criticalBorder` const style objects and using `as const` instead.

### Task 9 — Reduced motion support ✅
`useAnimationConfig()` hook exported from `animations.ts` — reads
`useReducedMotion()` from Framer Motion and returns instant transitions when
the user prefers reduced motion. `globals.css` already contained the full
`@media (prefers-reduced-motion: reduce)` block collapsing all CSS durations
to 0.01ms.

### Task 10 — Verify + commit ✅
- `tsc --noEmit`: 0 errors
- `pnpm test:run`: 1344/1344 passed, 71 suites
- `cargo check`: 0 errors, 2 pre-existing dead_code warnings (unrelated)

## Files Changed

| File | Change |
|------|--------|
| `app/lib/design/animations.ts` | NEW — central animation config module |
| `app/lib/design/index.ts` | NEW — barrel export |
| `app/components/inspector/InspectorDrawer.tsx` | AnimatePresence + spring drawer |
| `app/components/transit/EventDetailPanel.tsx` | AnimatePresence + spring drawer, duplicate imports removed |
| `app/components/decision-gate/GatePanel.tsx` | Uses new `panelSlideUp` variant |
| `app/components/ghost/GhostCard.tsx` | Fixed MotionStyle TS error; already had cardLift |

## Design Decisions

- `panelSlideUp` uses `y: 40→0` (not `scale`) because GatePanel slides up
  above the input bar — it's positional, not a floating modal.
- `buttonPress` values follow the Sprint 21.0 Brief (1.03/0.97) not
  DESIGN_SYSTEM.md (1.05/0.95) — the brief was written specifically for
  GregLite's subtler feel.
- `cardLift` uses `y: -2` and `0 8px 24px rgba(0,212,232,0.1)` (Brief spec)
  not the DESIGN_SYSTEM's `y: -4` / `0.15` opacity — same rationale.
- Warning/veto/streaming states on SendButton deliberately excluded from
  `buttonPress` — no bounce on dangerous actions.
