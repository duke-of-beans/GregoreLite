/**
 * focus-tracker.test.ts — Sprint 19.0 Task 10
 *
 * Tests Law 5 (Protect Deep Work) focus state machine.
 * Uses fake timers to control timing-based transitions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getFocusState,
  updateFocusState,
  onFocusChange,
  resetFocusState,
} from '../focus-tracker';

beforeEach(() => {
  vi.useFakeTimers();
  resetFocusState();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('initial state', () => {
  it('starts as idle', () => {
    expect(getFocusState()).toBe('idle');
  });
});

describe('idle → browsing', () => {
  it('click event transitions to browsing', () => {
    updateFocusState({ type: 'click' });
    expect(getFocusState()).toBe('browsing');
  });

  it('scroll event transitions to browsing', () => {
    updateFocusState({ type: 'scroll' });
    expect(getFocusState()).toBe('browsing');
  });
});

describe('idle/browsing → composing', () => {
  it('keydown transitions from idle to composing', () => {
    updateFocusState({ type: 'keydown' });
    expect(getFocusState()).toBe('composing');
  });

  it('keydown transitions from browsing to composing', () => {
    updateFocusState({ type: 'click' });
    updateFocusState({ type: 'keydown' });
    expect(getFocusState()).toBe('composing');
  });
});

describe('composing → deep_work (sustained typing)', () => {
  it('sustained typing for > 60s transitions to deep_work', () => {
    // Start typing — firstTypingAt = T0
    updateFocusState({ type: 'keydown' });
    expect(getFocusState()).toBe('composing');

    // Keep streak alive with keydowns every 20s (< COMPOSING_TIMEOUT_MS of 30s).
    // Advancing all 61s at once would reset firstTypingAt on the next keydown
    // because the gap would exceed COMPOSING_TIMEOUT_MS.
    vi.advanceTimersByTime(20_000);
    updateFocusState({ type: 'keydown' }); // T=20s, gap=20s — streak preserved
    vi.advanceTimersByTime(20_000);
    updateFocusState({ type: 'keydown' }); // T=40s, gap=20s — streak preserved
    vi.advanceTimersByTime(21_000);
    updateFocusState({ type: 'keydown' }); // T=61s, gap=21s — triggers re-evaluation

    // firstTypingAt=T0, lastKeystrokeAt=T0+61000, now=T0+61000
    // lastKeystrokeAt - firstTypingAt = 61000 >= 60000 ✓
    // now - lastKeystrokeAt = 0 < 30000 ✓
    expect(getFocusState()).toBe('deep_work');
  });

  it('3+ messages in 2min window transitions to deep_work', () => {
    // DEEP_WORK_MSG_THRESHOLD = 3, condition is recentCount > 3 (strictly greater).
    // Need 4 messages, not 3.
    updateFocusState({ type: 'message_sent' });
    vi.advanceTimersByTime(10_000);
    updateFocusState({ type: 'message_sent' });
    vi.advanceTimersByTime(10_000);
    updateFocusState({ type: 'message_sent' });
    vi.advanceTimersByTime(10_000);
    updateFocusState({ type: 'message_sent' });

    expect(getFocusState()).toBe('deep_work');
  });
});

describe('composing → idle (timeout)', () => {
  it('no keydown for > 30s drops from composing to idle', () => {
    updateFocusState({ type: 'keydown' });
    expect(getFocusState()).toBe('composing');

    // Advance past COMPOSING_TIMEOUT (30s)
    vi.advanceTimersByTime(31_000);
    // Trigger evaluation via a non-keydown event
    updateFocusState({ type: 'scroll' });

    expect(getFocusState()).not.toBe('composing');
  });
});

describe('any state → idle (inactivity)', () => {
  it('no events for > 5min returns to idle', () => {
    updateFocusState({ type: 'click' });
    expect(getFocusState()).toBe('browsing');

    vi.advanceTimersByTime(5 * 60_000 + 1_000); // 5min + 1s

    // Call getFocusState() directly — sending any event would reset lastActivityAt
    // to current time, defeating the idle check in computeState().
    expect(getFocusState()).toBe('idle');
  });
});

describe('onFocusChange', () => {
  it('fires callback when state changes', () => {
    const cb = vi.fn();
    onFocusChange(cb);
    updateFocusState({ type: 'click' });
    expect(cb).toHaveBeenCalledWith('browsing');
  });

  it('returns unsubscribe function that stops callbacks', () => {
    const cb = vi.fn();
    const unsub = onFocusChange(cb);
    unsub();
    updateFocusState({ type: 'click' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not fire when state does not change', () => {
    updateFocusState({ type: 'click' }); // → browsing
    const cb = vi.fn();
    onFocusChange(cb);
    updateFocusState({ type: 'scroll' }); // stays browsing
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('resetFocusState', () => {
  it('resets to idle regardless of prior state', () => {
    updateFocusState({ type: 'keydown' });
    expect(getFocusState()).toBe('composing');
    resetFocusState();
    expect(getFocusState()).toBe('idle');
  });
});
