/**
 * interrupt-gate.test.ts — Sprint 19.0 Task 10
 *
 * Tests Law 5 interrupt gate: focus-severity matrix, queue, drain.
 * Mocks focus-tracker and attention-budget to isolate gate logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock focus-tracker ───────────────────────────────────────────────────────

let mockFocusState: 'idle' | 'browsing' | 'composing' | 'deep_work' = 'idle';
const focusChangeListeners: Array<(state: string) => void> = [];

vi.mock('../focus-tracker', () => ({
  getFocusState: () => mockFocusState,
  onFocusChange: (cb: (state: string) => void) => {
    focusChangeListeners.push(cb);
    return () => {
      const idx = focusChangeListeners.indexOf(cb);
      if (idx >= 0) focusChangeListeners.splice(idx, 1);
    };
  },
}));

// ─── Mock attention-budget ────────────────────────────────────────────────────

let mockBudgetExhausted = false;

vi.mock('../attention-budget', () => ({
  isBudgetExhausted: () => mockBudgetExhausted,
  spendAttention: () => !mockBudgetExhausted,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

const {
  shouldInterrupt,
  queueInterrupt,
  getQueuedInterrupts,
  onQueueDrain,
  clearInterruptQueue,
} = await import('../interrupt-gate');

// ─── Reset helpers ────────────────────────────────────────────────────────────

function setFocus(state: typeof mockFocusState) {
  const prev = mockFocusState;
  mockFocusState = state;
  if (prev !== state) {
    for (const cb of focusChangeListeners) cb(state);
  }
}

beforeEach(() => {
  clearInterruptQueue();
  mockBudgetExhausted = false;
  setFocus('idle');
});

// ─── shouldInterrupt — focus matrix ──────────────────────────────────────────

describe('shouldInterrupt — idle focus (all pass)', () => {
  it('allows low severity', () => {
    expect(shouldInterrupt({ type: 'ghost_suggestion', severity: 'low', message: 'test' })).toBe(true);
  });
  it('allows medium severity', () => {
    expect(shouldInterrupt({ type: 'notification', severity: 'medium', message: 'test' })).toBe(true);
  });
  it('allows critical severity', () => {
    expect(shouldInterrupt({ type: 'gate', severity: 'critical', message: 'test' })).toBe(true);
  });
});

describe('shouldInterrupt — browsing focus (medium+ pass)', () => {
  beforeEach(() => setFocus('browsing'));

  it('blocks low severity', () => {
    expect(shouldInterrupt({ type: 'ghost_suggestion', severity: 'low', message: 'test' })).toBe(false);
  });
  it('allows medium severity', () => {
    expect(shouldInterrupt({ type: 'notification', severity: 'medium', message: 'test' })).toBe(true);
  });
  it('allows high severity', () => {
    expect(shouldInterrupt({ type: 'gate', severity: 'high', message: 'test' })).toBe(true);
  });
});

describe('shouldInterrupt — composing focus (high+ pass)', () => {
  beforeEach(() => setFocus('composing'));

  it('blocks low severity', () => {
    expect(shouldInterrupt({ type: 'ghost_suggestion', severity: 'low', message: 'test' })).toBe(false);
  });
  it('blocks medium severity', () => {
    expect(shouldInterrupt({ type: 'notification', severity: 'medium', message: 'test' })).toBe(false);
  });
  it('allows high severity', () => {
    expect(shouldInterrupt({ type: 'gate', severity: 'high', message: 'test' })).toBe(true);
  });
  it('allows critical severity', () => {
    expect(shouldInterrupt({ type: 'gate', severity: 'critical', message: 'test' })).toBe(true);
  });
});

describe('shouldInterrupt — deep_work focus (critical only)', () => {
  beforeEach(() => setFocus('deep_work'));

  it('blocks low severity', () => {
    expect(shouldInterrupt({ type: 'ghost_suggestion', severity: 'low', message: 'test' })).toBe(false);
  });
  it('blocks medium severity', () => {
    expect(shouldInterrupt({ type: 'notification', severity: 'medium', message: 'test' })).toBe(false);
  });
  it('blocks high severity', () => {
    expect(shouldInterrupt({ type: 'gate', severity: 'high', message: 'test' })).toBe(false);
  });
  it('allows critical severity', () => {
    expect(shouldInterrupt({ type: 'gate', severity: 'critical', message: 'test' })).toBe(true);
  });
});

describe('shouldInterrupt — status_update always passes', () => {
  it('passes during deep_work', () => {
    setFocus('deep_work');
    expect(shouldInterrupt({ type: 'status_update', severity: 'low', message: 'done' })).toBe(true);
  });
});

describe('shouldInterrupt — budget exhausted', () => {
  it('blocks non-critical when budget exhausted', () => {
    mockBudgetExhausted = true;
    expect(shouldInterrupt({ type: 'notification', severity: 'medium', message: 'test' })).toBe(false);
  });
  it('allows critical regardless of budget exhaustion', () => {
    mockBudgetExhausted = true;
    expect(shouldInterrupt({ type: 'gate', severity: 'critical', message: 'test' })).toBe(true);
  });
});

// ─── Queue ────────────────────────────────────────────────────────────────────

describe('queue management', () => {
  it('blocked interrupts appear in queue', () => {
    setFocus('deep_work');
    shouldInterrupt({ type: 'notification', severity: 'medium', message: 'queued', id: 'n1' });
    const queued = getQueuedInterrupts();
    expect(queued.some((r) => r.id === 'n1')).toBe(true);
  });

  it('allowed interrupts do not appear in queue', () => {
    shouldInterrupt({ type: 'notification', severity: 'medium', message: 'allowed', id: 'n2' });
    expect(getQueuedInterrupts().some((r) => r.id === 'n2')).toBe(false);
  });

  it('clearInterruptQueue empties the queue', () => {
    setFocus('deep_work');
    queueInterrupt({ type: 'notification', severity: 'medium', message: 'test', id: 'n3' });
    clearInterruptQueue();
    expect(getQueuedInterrupts()).toHaveLength(0);
  });
});

// ─── Queue drain ──────────────────────────────────────────────────────────────

describe('onQueueDrain', () => {
  it('drain callback fires when focus drops and queue has items', () => {
    setFocus('deep_work');
    queueInterrupt({ type: 'notification', severity: 'medium', message: 'held', id: 'n4' });

    const cb = vi.fn();
    onQueueDrain(cb);

    // Focus drops from deep_work → browsing → triggers drain check
    setFocus('browsing');
    expect(cb).toHaveBeenCalled();
    const released = cb.mock.calls[0]?.[0] as unknown[];
    expect(Array.isArray(released)).toBe(true);
  });

  it('returns unsubscribe that stops drain callbacks', () => {
    setFocus('deep_work');
    queueInterrupt({ type: 'notification', severity: 'medium', message: 'held', id: 'n5' });

    const cb = vi.fn();
    const unsub = onQueueDrain(cb);
    unsub();
    setFocus('idle');
    expect(cb).not.toHaveBeenCalled();
  });
});
