import { describe, it, expect, vi, afterEach } from 'vitest';

// ── Environment mocks ─────────────────────────────────────────────────────────

// Default: reduced motion OFF (standard display)
let mockMatchMedia = vi.fn(() => ({ matches: false }));

Object.defineProperty(globalThis, 'window', {
  writable: true,
  configurable: true,
  value: { matchMedia: mockMatchMedia },
});

import {
  prefersReducedMotion,
  TYPEWRITER_SPEED,
  getTypewriterDelay,
  getTypewriterSlice,
  isTypewriterComplete,
  getCounterValue,
  staggerContainer,
  staggerChild,
  masterReveal,
  sectionReveal,
  capabilityCard,
  sourceCardSpring,
  snippetFade,
} from '../synthesis-animations';

// ── prefersReducedMotion ──────────────────────────────────────────────────────

describe('prefersReducedMotion', () => {
  afterEach(() => {
    mockMatchMedia = vi.fn(() => ({ matches: false }));
    (globalThis as unknown as { window: unknown }).window = { matchMedia: mockMatchMedia };
  });

  it('returns false when no reduced motion preference is set', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('returns true when prefers-reduced-motion: reduce is active', () => {
    (globalThis as unknown as { window: { matchMedia: unknown } }).window = {
      matchMedia: vi.fn(() => ({ matches: true })),
    };
    expect(prefersReducedMotion()).toBe(true);
  });

  it('returns false in SSR environment (no window)', () => {
    const original = (globalThis as unknown as Record<string, unknown>).window;
    delete (globalThis as unknown as Record<string, unknown>).window;
    expect(prefersReducedMotion()).toBe(false);
    (globalThis as unknown as Record<string, unknown>).window = original;
  });
});

// ── TYPEWRITER_SPEED ─────────────────────────────────────────────────────────

describe('TYPEWRITER_SPEED', () => {
  it('source speed is exactly 30ms/char (spec-mandated)', () => {
    expect(TYPEWRITER_SPEED.source).toBe(30);
  });

  it('master speed is exactly 50ms/char (spec-mandated)', () => {
    expect(TYPEWRITER_SPEED.master).toBe(50);
  });
});

// ── getTypewriterDelay ────────────────────────────────────────────────────────

describe('getTypewriterDelay', () => {
  afterEach(() => {
    (globalThis as unknown as { window: { matchMedia: unknown } }).window = {
      matchMedia: vi.fn(() => ({ matches: false })),
    };
  });

  it('returns 30 for source mode (standard)', () => {
    expect(getTypewriterDelay('source')).toBe(30);
  });

  it('returns 50 for master mode (standard)', () => {
    expect(getTypewriterDelay('master')).toBe(50);
  });

  it('returns 0 or near-0 for source mode when reduced motion is active', () => {
    (globalThis as unknown as { window: { matchMedia: unknown } }).window = {
      matchMedia: vi.fn(() => ({ matches: true })),
    };
    expect(getTypewriterDelay('source')).toBeLessThanOrEqual(1);
  });

  it('returns 0 or near-0 for master mode when reduced motion is active', () => {
    (globalThis as unknown as { window: { matchMedia: unknown } }).window = {
      matchMedia: vi.fn(() => ({ matches: true })),
    };
    expect(getTypewriterDelay('master')).toBeLessThanOrEqual(1);
  });
});

// ── getTypewriterSlice ────────────────────────────────────────────────────────

describe('getTypewriterSlice', () => {
  const text = 'Hello world';

  it('returns empty string at charIndex 0', () => {
    expect(getTypewriterSlice(text, 0)).toBe('');
  });

  it('returns first character at charIndex 1', () => {
    expect(getTypewriterSlice(text, 1)).toBe('H');
  });

  it('returns full text at charIndex equal to text length', () => {
    expect(getTypewriterSlice(text, text.length)).toBe(text);
  });

  it('returns full text when charIndex exceeds text length', () => {
    expect(getTypewriterSlice(text, 9999)).toBe(text);
  });

  it('handles empty string input', () => {
    expect(getTypewriterSlice('', 5)).toBe('');
  });
});

// ── isTypewriterComplete ──────────────────────────────────────────────────────

describe('isTypewriterComplete', () => {
  it('returns false when charIndex < text length', () => {
    expect(isTypewriterComplete('Hello', 3)).toBe(false);
  });

  it('returns true when charIndex equals text length', () => {
    expect(isTypewriterComplete('Hello', 5)).toBe(true);
  });

  it('returns true when charIndex exceeds text length', () => {
    expect(isTypewriterComplete('Hi', 100)).toBe(true);
  });

  it('returns true for empty string at charIndex 0', () => {
    expect(isTypewriterComplete('', 0)).toBe(true);
  });
});

// ── getCounterValue ───────────────────────────────────────────────────────────

describe('getCounterValue', () => {
  it('returns `from` value at elapsed 0', () => {
    expect(getCounterValue(0, 100, 0, 1000)).toBe(0);
  });

  it('returns `to` value when elapsed >= duration', () => {
    expect(getCounterValue(0, 100, 1000, 1000)).toBe(100);
    expect(getCounterValue(0, 100, 2000, 1000)).toBe(100);
  });

  it('returns a value between from and to during animation', () => {
    const value = getCounterValue(0, 100, 500, 1000);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(100);
  });

  it('applies ease-out (progress slows near end) — midpoint value should be > 50%', () => {
    // Ease-out cubic: value at 50% elapsed should be > 50% of range
    const value = getCounterValue(0, 100, 500, 1000);
    expect(value).toBeGreaterThan(50);
  });

  it('works with non-zero from value', () => {
    const value = getCounterValue(50, 150, 1000, 1000);
    expect(value).toBe(150);
  });

  it('returns integer values (no floating point leak)', () => {
    const value = getCounterValue(0, 100, 333, 1000);
    expect(Number.isInteger(value)).toBe(true);
  });
});

// ── Framer Motion variant shapes ─────────────────────────────────────────────

describe('Animation variants — structural integrity', () => {
  it('staggerContainer has hidden and visible variants', () => {
    expect(staggerContainer).toHaveProperty('hidden');
    expect(staggerContainer).toHaveProperty('visible');
  });

  it('staggerContainer visible has staggerChildren set', () => {
    const visible = staggerContainer.visible as { transition?: { staggerChildren?: number } };
    expect(visible.transition?.staggerChildren).toBeDefined();
  });

  it('staggerChild has hidden and visible variants', () => {
    expect(staggerChild).toHaveProperty('hidden');
    expect(staggerChild).toHaveProperty('visible');
  });

  it('staggerChild hidden has opacity 0', () => {
    const hidden = staggerChild.hidden as { opacity: number };
    expect(hidden.opacity).toBe(0);
  });

  it('masterReveal has hidden and visible variants', () => {
    expect(masterReveal).toHaveProperty('hidden');
    expect(masterReveal).toHaveProperty('visible');
  });

  it('masterReveal transition duration is 2s (spec: slow reveal)', () => {
    const visible = masterReveal.visible as { transition?: { duration?: number } };
    expect(visible.transition?.duration).toBeGreaterThanOrEqual(2);
  });

  it('sectionReveal is a function returning variants', () => {
    expect(typeof sectionReveal).toBe('function');
    const variants = sectionReveal(0.5);
    expect(variants).toHaveProperty('hidden');
    expect(variants).toHaveProperty('visible');
  });

  it('sectionReveal delay is passed through to transition', () => {
    const variants = sectionReveal(1.2);
    const visible = variants.visible as { transition?: { delay?: number } };
    expect(visible.transition?.delay).toBe(1.2);
  });

  it('capabilityCard has hidden and visible variants', () => {
    expect(capabilityCard).toHaveProperty('hidden');
    expect(capabilityCard).toHaveProperty('visible');
  });

  it('sourceCardSpring has hidden and visible variants with spring transition', () => {
    expect(sourceCardSpring).toHaveProperty('hidden');
    expect(sourceCardSpring).toHaveProperty('visible');
    const visible = sourceCardSpring.visible as { transition?: { type?: string } };
    expect(visible.transition?.type).toBe('spring');
  });

  it('snippetFade has hidden, visible and exit variants', () => {
    expect(snippetFade).toHaveProperty('hidden');
    expect(snippetFade).toHaveProperty('visible');
    expect(snippetFade).toHaveProperty('exit');
  });
});
