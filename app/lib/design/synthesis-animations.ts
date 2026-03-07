/**
 * lib/design/synthesis-animations.ts — Sprint 28.0 Ceremonial Onboarding
 *
 * Animation primitives for the synthesis ceremony.
 * All animations respect prefers-reduced-motion — instant display fallback.
 *
 * Typewriter speeds (non-negotiable from spec):
 *   - Per-source synthesis: 30ms/char
 *   - Master synthesis:     50ms/char (slower = more gravitas)
 */

import { Variants } from 'framer-motion';

// ── Reduced-motion detection ──────────────────────────────────────────────────

/**
 * Returns true if the user has requested reduced motion.
 * Safe to call server-side (defaults to false during SSR).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── Typewriter effect ─────────────────────────────────────────────────────────

export const TYPEWRITER_SPEED = {
  /** Per-source synthesis: 30ms per character */
  source: 30,
  /** Master synthesis: 50ms per character — slower feels more deliberate */
  master: 50,
} as const;

export type TypewriterMode = keyof typeof TYPEWRITER_SPEED;

/**
 * Hook-compatible typewriter stepper.
 * Returns the visible portion of `text` up to `charIndex` characters.
 *
 * Usage:
 *   const [charIndex, setCharIndex] = useState(0);
 *   useEffect(() => {
 *     if (charIndex >= text.length) return;
 *     const t = setTimeout(() => setCharIndex(i => i + 1), getTypewriterDelay('source'));
 *     return () => clearTimeout(t);
 *   }, [charIndex, text]);
 *   return <span>{getTypewriterSlice(text, charIndex)}</span>;
 */
export function getTypewriterDelay(mode: TypewriterMode): number {
  return prefersReducedMotion() ? 0 : TYPEWRITER_SPEED[mode];
}

export function getTypewriterSlice(text: string, charIndex: number): string {
  return text.slice(0, charIndex);
}

export function isTypewriterComplete(text: string, charIndex: number): boolean {
  return charIndex >= text.length;
}

// ── Counter animation ─────────────────────────────────────────────────────────

/**
 * Smooth counter animation — ticks a number from `from` to `to`.
 * Returns the animated value at a given timestamp.
 * Use with requestAnimationFrame or a spring.
 */
export function getCounterValue(
  from: number,
  to: number,
  elapsed: number,
  durationMs: number,
): number {
  if (prefersReducedMotion() || elapsed >= durationMs) return to;
  const progress = Math.min(elapsed / durationMs, 1);
  // Ease-out cubic for natural deceleration
  const eased = 1 - Math.pow(1 - progress, 3);
  return Math.round(from + (to - from) * eased);
}

/** Default duration for the indexing counter ticker */
export const COUNTER_DURATION_MS = 800;

// ── Staggered fade-in ─────────────────────────────────────────────────────────

/** Stagger delay between capability/pattern cards */
export const STAGGER_DELAY_MS = 200;

/**
 * Framer Motion variants for a staggered container.
 * Parent staggers children by STAGGER_DELAY_MS each.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: prefersReducedMotion() ? 0 : STAGGER_DELAY_MS / 1000,
    },
  },
};

/**
 * Framer Motion variants for a single staggered child.
 * Fades in from the left.
 */
export const staggerChild: Variants = {
  hidden:  { opacity: 0, x: prefersReducedMotion() ? 0 : -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: prefersReducedMotion() ? 0 : 0.35,
      ease: 'easeOut',
    },
  },
};

// ── Reveal animation (master synthesis opening) ───────────────────────────────

/**
 * "I see you now." — the opening line of the master synthesis ceremony.
 * Slow 2-second fade with a slight scale-up.
 */
export const masterReveal: Variants = {
  hidden:  { opacity: 0, scale: prefersReducedMotion() ? 1 : 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: prefersReducedMotion() ? 0 : 2,
      ease: 'easeOut',
    },
  },
};

/**
 * Section fade — used for each section of the master synthesis (Overview, Patterns, etc.)
 * Appears after a configurable delay.
 */
export function sectionReveal(delayS: number): Variants {
  return {
    hidden:  { opacity: 0, y: prefersReducedMotion() ? 0 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion() ? 0 : 0.5,
        delay: prefersReducedMotion() ? 0 : delayS,
        ease: 'easeOut',
      },
    },
  };
}

// ── Capability card ───────────────────────────────────────────────────────────

/**
 * Framer Motion variants for an individual capability card appearing
 * after a source synthesis. Used in SourceAdditionFlow step 5.
 */
export const capabilityCard: Variants = {
  hidden:  { opacity: 0, x: prefersReducedMotion() ? 0 : -16, scale: 0.98 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: prefersReducedMotion() ? 0 : 0.3,
      ease: 'easeOut',
    },
  },
};

// ── Source card spring (the mini-ceremony entry) ──────────────────────────────

/**
 * The CapturePad-style spring for the source selection card appearing.
 * Scale 0.95→1, opacity 0→1, 100ms.
 */
export const sourceCardSpring: Variants = {
  hidden:  { opacity: 0, scale: prefersReducedMotion() ? 1 : 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 28,
      duration: prefersReducedMotion() ? 0 : 0.1,
    },
  },
  exit: {
    opacity: 0,
    scale: prefersReducedMotion() ? 1 : 0.95,
    transition: { duration: prefersReducedMotion() ? 0 : 0.1 },
  },
};

// ── Progress snippet fade ─────────────────────────────────────────────────────

/**
 * The "Found your GregLite project..." preview snippets during indexing.
 * Each snippet fades in and then fades out as the next one arrives.
 */
export const snippetFade: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: prefersReducedMotion() ? 0 : 0.4 } },
  exit:    { opacity: 0, transition: { duration: prefersReducedMotion() ? 0 : 0.3 } },
};
