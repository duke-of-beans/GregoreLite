/**
 * Animation System — Sprint 21.0
 *
 * Centralised Framer Motion variants and transitions for GregLite.
 * All animation configs live here — no inline variant objects in components.
 *
 * Source: Gregore DESIGN_SYSTEM.md §4 (Animation System)
 * Rule: Use Framer Motion for springs/physics; keep CSS for simple opacity/colour.
 * Rule: Respect prefers-reduced-motion via useAnimationConfig().
 */

import { type Variants, type Transition, useReducedMotion } from 'framer-motion';

// ── Standard Transitions ───────────────────────────────────────────────────────

export const transitions = {
  fast:   { duration: 0.15 } as Transition,
  normal: { duration: 0.3  } as Transition,
  slow:   { duration: 0.5  } as Transition,
  spring: { type: 'spring', stiffness: 300, damping: 30 } as Transition,
  bounce: { type: 'spring', stiffness: 400, damping: 10 } as Transition,
} as const;

// ── Common Variants ────────────────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
};

export const slideInRight: Variants = {
  hidden:  { opacity: 0, x: 20  },
  visible: { opacity: 1, x: 0   },
  exit:    { opacity: 0, x: 20  },
};

export const slideInLeft: Variants = {
  hidden:  { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0   },
  exit:    { opacity: 0, x: -20 },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: { duration: 0.15 },
  },
};

/** Modal spring with tighter scale range — for popovers (MemoryCard, etc.) */
export const popoverVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: { duration: 0.12 },
  },
};

// ── Drawer Variants ────────────────────────────────────────────────────────────

/** Right-side drawer (Inspector, EventDetailPanel) */
export const drawerSlide: Variants = {
  hidden:  { x: '100%' },
  visible: {
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    x: '100%',
    transition: { duration: 0.3 },
  },
};

/** Left-side drawer (Chat History sidebar) */
export const drawerSlideLeft: Variants = {
  hidden:  { x: '-100%' },
  visible: {
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    x: '-100%',
    transition: { duration: 0.3 },
  },
};

/** Bottom-attached panel slide (GatePanel — slides up above input bar) */
export const panelSlideUp: Variants = {
  hidden:  { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    y: 40,
    transition: { duration: 0.2 },
  },
};

// ── Receipt / Accordion Variants ───────────────────────────────────────────────

/**
 * Height-collapse variant for AnimatePresence.
 * Apply overflow: hidden + style={{ height: 'auto' }} on the motion.div.
 * Framer Motion interpolates height: 0 → 'auto' correctly.
 */
export const expandCollapse: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeInOut' },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
};

// ── Micro-interactions ─────────────────────────────────────────────────────────

/** Primary button press — subtle scale. Apply to motion.button as {...buttonPress} */
export const buttonPress = {
  whileHover: { scale: 1.03 },
  whileTap:   { scale: 0.97 },
} as const;

/** Ghost suggestion card hover lift with cyan glow */
export const cardLift = {
  whileHover: {
    y: -2,
    boxShadow: '0 8px 24px rgba(0, 212, 232, 0.1)',
    transition: { duration: 0.2 },
  },
} as const;

// ── Reduced Motion Hook ────────────────────────────────────────────────────────

/**
 * Returns animation config that respects prefers-reduced-motion.
 * Components that need to switch between spring and instant transitions
 * should use this hook.
 *
 * Usage:
 *   const { transition, variants } = useAnimationConfig();
 *   <motion.div variants={variants} transition={transition} />
 */
export function useAnimationConfig() {
  const prefersReduced = useReducedMotion();

  return {
    /** Use instead of transitions.spring when respecting reduced motion */
    transition: prefersReduced
      ? ({ duration: 0 } as Transition)
      : transitions.spring,

    /** Use for simple fade — instant when reduced motion is preferred */
    fadeTransition: prefersReduced
      ? ({ duration: 0 } as Transition)
      : transitions.fast,

    /** Pass to AnimatePresence to skip exit animations */
    presenceProps: prefersReduced
      ? { mode: 'wait' as const, initial: false }
      : { mode: 'wait' as const },

    /** Whether to skip animations entirely */
    disabled: prefersReduced ?? false,
  };
}
