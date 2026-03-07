/**
 * Tests for lib/web-session/selectors.ts — Sprint 32.0
 *
 * These tests verify structural contracts, not DOM behaviour.
 * Intent: catch accidental deletions or renamed exports before they
 * reach production; the file is the single fragility point for claude.ai
 * DOM changes.
 *
 * Coverage:
 *   - All required selector keys are present and non-empty strings
 *   - SELECTORS_VERSION follows semver pattern
 *   - SELECTORS_LAST_VERIFIED is a valid ISO date string
 *   - No selector value is the empty string (catches accidental blanks)
 */

import { describe, it, expect } from 'vitest';
import {
  CLAUDE_SELECTORS,
  SELECTORS_VERSION,
  SELECTORS_LAST_VERIFIED,
} from '../selectors';

const REQUIRED_KEYS = [
  'loggedInIndicator',
  'messageInput',
  'sendButton',
  'assistantMessage',
  'streamingIndicator',
  'rateLimitBanner',
  'errorBanner',
] as const;

describe('CLAUDE_SELECTORS', () => {
  it('exports an object', () => {
    expect(typeof CLAUDE_SELECTORS).toBe('object');
    expect(CLAUDE_SELECTORS).not.toBeNull();
  });

  it.each(REQUIRED_KEYS)('has a non-empty string for key "%s"', (key) => {
    expect(typeof CLAUDE_SELECTORS[key]).toBe('string');
    expect(CLAUDE_SELECTORS[key].trim().length).toBeGreaterThan(0);
  });

  it('contains no empty-string values (catches accidental blanks)', () => {
    for (const [key, value] of Object.entries(CLAUDE_SELECTORS)) {
      expect(value, `Selector "${key}" must not be empty`).not.toBe('');
    }
  });
});

describe('SELECTORS_VERSION', () => {
  it('is a semver string', () => {
    expect(SELECTORS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('SELECTORS_LAST_VERIFIED', () => {
  it('is a valid ISO date (YYYY-MM-DD)', () => {
    expect(SELECTORS_LAST_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const d = new Date(SELECTORS_LAST_VERIFIED);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('is not in the future (stale selector guard)', () => {
    const verified = new Date(SELECTORS_LAST_VERIFIED).getTime();
    expect(verified).toBeLessThanOrEqual(Date.now());
  });
});
