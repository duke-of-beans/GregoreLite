GREGLITE SPRINT 21.0 — Spring Animations + Final Polish
Make it feel alive: Framer Motion springs, micro-interactions, motion quality | March 2026

YOUR ROLE: Replace CSS transitions with Framer Motion spring physics across all interactive surfaces. Add micro-interactions (button press, card lift, hover effects) from Gregore's DESIGN_SYSTEM.md §4. This is the "make it feel alive" sprint. David is CEO. Zero debt.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\PROJECTS\Gregore\docs\DESIGN_SYSTEM.md — READ §4 (Animation System) FULLY. This is your primary spec. Contains: standard transitions (fast/normal/slow/spring/bounce), common variants (fadeIn, slideInLeft/Right, modalVariants), critical animations (ghostPulse, shimmer, drawerSlide), micro-interactions (buttonPress, cardLift, receiptExpand).
4. D:\Projects\GregLite\GREGORE_AUDIT.md — §5 (Animation Gaps)
5. D:\Projects\GregLite\app\app\globals.css — existing CSS animations
6. D:\Projects\GregLite\app\package.json — verify framer-motion is in dependencies
7. READ all components you'll modify: InspectorDrawer.tsx, EventDetailPanel.tsx, GatePanel.tsx, ReceiptFooter.tsx, Message.tsx, ChatInterface.tsx, SettingsPanel (or however settings opens), MemoryCard.tsx
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- framer-motion adds >50KB to the bundle for a single animation — use CSS for simple opacity/transform, Framer only for springs and physics
- Any animation causes visible layout jank or paint thrashing — profile first, animate second
- AnimatePresence requires wrapping components in motion.div — if a component is deeply nested, CSS transitions may be more practical
- Sonnet has failed on the same problem twice → spawn Opus subagent

---

TASK 1: Create animation config module

New file: app/lib/design/animations.ts

Port Gregore's animation constants from DESIGN_SYSTEM.md §4:

```typescript
import { type Variants, type Transition } from 'framer-motion';

export const transitions = {
  fast: { duration: 0.15 } as Transition,
  normal: { duration: 0.3 } as Transition,
  slow: { duration: 0.5 } as Transition,
  spring: { type: 'spring', stiffness: 300, damping: 30 } as Transition,
  bounce: { type: 'spring', stiffness: 400, damping: 10 } as Transition,
} as const;

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0, scale: 0.9, y: 20,
    transition: { duration: 0.15 },
  },
};

export const drawerSlide: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit: { x: '100%', transition: { duration: 0.3 } },
};

export const drawerSlideLeft: Variants = {
  hidden: { x: '-100%' },
  visible: { x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit: { x: '-100%', transition: { duration: 0.3 } },
};

// Micro-interactions
export const buttonPress = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.97 },
};

export const cardLift = {
  whileHover: {
    y: -2,
    boxShadow: '0 8px 24px rgba(0, 212, 232, 0.1)',
    transition: { duration: 0.2 },
  },
};
```

New file: app/lib/design/index.ts — barrel export

TASK 2: Inspector Drawer spring animation

File: app/components/inspector/InspectorDrawer.tsx

Replace the current CSS `transition: transform 300ms` with Framer Motion:
1. Wrap the drawer in `<AnimatePresence>` + `<motion.div>`
2. Use `drawerSlide` variants (spring stiffness 300, damping 30)
3. The drawer should spring in and ease out

Import: `import { motion, AnimatePresence } from 'framer-motion'`
Import: `import { drawerSlide } from '@/lib/design/animations'`

TASK 3: EventDetailPanel spring animation

File: app/components/transit/EventDetailPanel.tsx

Currently uses fixed positioning with no entrance animation (Sprint 13.0 may have added a CSS slide-in — check).

Replace with Framer Motion:
1. Backdrop: `<motion.div>` with `fadeIn` variants
2. Panel: `<motion.div>` with `drawerSlide` variants
3. Wrap both in `<AnimatePresence>` keyed on `event?.id`

TASK 4: GatePanel animation

File: wherever GatePanel.tsx lives (decision gate warning UI)

The gate warning should slide in with spring physics, not pop in:
1. Use `modalVariants` (scale 0.9 → 1, spring)
2. Wrap in AnimatePresence

TASK 5: MemoryCard popover animation

File: app/components/chat/MemoryCard.tsx

The memory card from Sprint 18.0 should spring in:
1. Use `modalVariants` with reduced scale range (0.95 → 1)
2. AnimatePresence keyed on match

TASK 6: Receipt Footer expand animation

File: app/components/chat/ReceiptFooter.tsx

Replace the CSS `receipt-expand` animation with Framer Motion `AnimatePresence` + `motion.div`:
1. Collapsed → expanded uses `layout` prop for smooth height animation
2. Or use explicit height animation via variants

TASK 7: Button micro-interactions

Apply `buttonPress` (whileHover scale 1.03, whileTap scale 0.97) to:
- Send button (SendButton.tsx)
- Command palette trigger
- Inspector drawer tab buttons
- Settings panel buttons
- Any other primary action buttons

Use `<motion.button>` with spread props: `{...buttonPress}`

Do NOT apply to every button — only primary actions and prominent interactive elements. Subtle buttons (close ×, collapse chevrons) should not bounce.

TASK 8: Card lift on Ghost cards

File: app/components/ghost/GhostCard.tsx

Apply `cardLift` to Ghost suggestion cards:
- Hover lifts card 2px with subtle cyan box-shadow
- Use `<motion.div>` with `{...cardLift}`

Also apply to InsightReviewPanel insight cards if they're clickable.

TASK 9: Reduced motion support

File: app/lib/design/animations.ts (add) + globals.css (verify)

Add a `useReducedMotion` check:
```typescript
import { useReducedMotion } from 'framer-motion';

export function useAnimationConfig() {
  const prefersReduced = useReducedMotion();
  return {
    transition: prefersReduced ? { duration: 0 } : transitions.spring,
    // ... other reduced-motion overrides
  };
}
```

Verify globals.css already has `@media (prefers-reduced-motion: reduce)` rules (Sprint 13.0 or Gregore DESIGN_SYSTEM.md §6). If not, add them.

TASK 10: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. Visually verify:
   - Inspector drawer springs in/out (not linear slide)
   - EventDetailPanel springs in
   - Gate warning springs in
   - Memory card pops in with spring
   - Receipt footer expands smoothly
   - Send button has subtle scale on hover/tap
   - Ghost cards lift on hover
   - prefers-reduced-motion disables all animations
4. Performance: no visible jank during animations (check with 6x CPU slowdown in DevTools)
5. Update STATUS.md
6. Write SPRINT_21_0_COMPLETE.md
7. Commit: "style: Sprint 21.0 — Framer Motion spring animations (drawers, panels, modals, micro-interactions)"
8. Push

---

QUALITY GATES:
 1. Animation config module exports all Gregore §4 variants
 2. Inspector drawer uses spring physics (not linear CSS)
 3. EventDetailPanel, GatePanel, MemoryCard all spring in
 4. Receipt footer expand is smooth (not CSS max-height hack)
 5. Button press micro-interaction on primary buttons
 6. Ghost cards lift on hover
 7. prefers-reduced-motion disables all motion
 8. No layout jank during any animation
 9. tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. Use Framer Motion for springs/physics, keep CSS for simple opacity/color transitions
3. Do NOT animate everything — only interactive surfaces and state transitions
4. prefers-reduced-motion must be respected (accessibility requirement)
5. Use cmd shell (not PowerShell)
6. Import from centralized lib/design/animations.ts — no inline animation configs in components
7. Read Gregore DESIGN_SYSTEM.md §4 BEFORE starting — follow the spec exactly
