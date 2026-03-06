/**
 * focus-tracker.ts — User Focus State Tracker — Sprint 19.0
 *
 * Law 5 (Protect Deep Work): tracks user focus state from input activity patterns.
 * State is TRANSIENT — module-level, not persisted to SQLite. Resets on app restart.
 *
 * States (ascending focus intensity):
 *   idle       — no input activity for >5 minutes
 *   browsing   — occasional clicks/scrolls, no sustained typing
 *   composing  — active typing in the input field
 *   deep_work  — sustained typing >60s OR rapid message exchange (>3 messages / 2 min)
 *
 * Usage:
 *   updateFocusState({ type: 'keydown' })    — call on every keyboard event
 *   updateFocusState({ type: 'click' })      — call on mouse clicks
 *   updateFocusState({ type: 'message_sent' }) — call when user sends a message
 *   getFocusState()                          — read current state
 *   onFocusChange(cb)                        — subscribe to transitions
 *
 * BLUEPRINT SPRINT_19_0_BRIEF.md Task 4
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FocusState = 'idle' | 'browsing' | 'composing' | 'deep_work';

export interface FocusEvent {
  type: 'keydown' | 'click' | 'scroll' | 'message_sent';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const IDLE_TIMEOUT_MS         = 5 * 60 * 1000;  // 5 min with no input → idle
const COMPOSING_TIMEOUT_MS    = 30 * 1000;       // 30s with no typing → drop from composing
const DEEP_WORK_TYPING_MS     = 60 * 1000;       // 60s sustained typing → deep_work
const DEEP_WORK_MSG_WINDOW_MS = 2 * 60 * 1000;   // 2-min window for rapid message detection
const DEEP_WORK_MSG_THRESHOLD = 3;               // >3 messages in window → deep_work

// ─── Module state ────────────────────────────────────────────────────────────

let currentState: FocusState = 'idle';
let lastActivityAt = 0;
let firstTypingAt: number | null = null;  // when current typing streak started
let lastKeystrokeAt = 0;

// Ring buffer: timestamps of last N message-sent events
const recentMessages: number[] = [];

const listeners: Set<(state: FocusState) => void> = new Set();

// Idle check interval — cleared on focus state update if not needed
let idleTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function setState(next: FocusState): void {
  if (next === currentState) return;
  currentState = next;
  for (const cb of listeners) {
    try { cb(next); } catch { /* subscriber errors must not crash the tracker */ }
  }
}

function computeState(): FocusState {
  const now = Date.now();

  // Idle: no activity for >5 min
  if (now - lastActivityAt > IDLE_TIMEOUT_MS) return 'idle';

  // Deep work (rapid messages): >3 sent in last 2 min
  const windowStart = now - DEEP_WORK_MSG_WINDOW_MS;
  const recentCount = recentMessages.filter((t) => t >= windowStart).length;
  if (recentCount > DEEP_WORK_MSG_THRESHOLD) return 'deep_work';

  // Deep work (sustained typing): typing streak >60s
  if (
    firstTypingAt !== null &&
    lastKeystrokeAt - firstTypingAt >= DEEP_WORK_TYPING_MS &&
    now - lastKeystrokeAt < COMPOSING_TIMEOUT_MS
  ) {
    return 'deep_work';
  }

  // Composing: recent keystroke within composing timeout
  if (now - lastKeystrokeAt < COMPOSING_TIMEOUT_MS) return 'composing';

  // Browsing: activity present but no sustained typing
  return 'browsing';
}

function scheduleIdleCheck(): void {
  if (idleTimer !== null) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    setState(computeState());
    idleTimer = null;
  }, IDLE_TIMEOUT_MS + 1000);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * updateFocusState — call on every relevant browser event.
 * Mutates module state and fires subscribers if state changes.
 */
export function updateFocusState(event: FocusEvent): void {
  const now = Date.now();
  lastActivityAt = now;

  switch (event.type) {
    case 'keydown': {
      // Start a new typing streak if no keystroke in >30s
      if (now - lastKeystrokeAt > COMPOSING_TIMEOUT_MS) {
        firstTypingAt = now;
      }
      lastKeystrokeAt = now;
      break;
    }
    case 'message_sent': {
      // Push to recent messages ring buffer (keep last 20)
      recentMessages.push(now);
      if (recentMessages.length > 20) recentMessages.shift();
      lastKeystrokeAt = now; // sending resets composing streak
      break;
    }
    case 'click':
    case 'scroll':
      // Activity without typing — contributes to "browsing" heuristic
      break;
  }

  setState(computeState());
  scheduleIdleCheck();
}

/**
 * getFocusState — read the current focus state.
 * Recomputes from timestamps on each call for accuracy.
 */
export function getFocusState(): FocusState {
  return computeState();
}

/**
 * onFocusChange — subscribe to focus state transitions.
 * Returns an unsubscribe function.
 */
export function onFocusChange(callback: (state: FocusState) => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

/**
 * resetFocusState — for testing only. Clears all state.
 */
export function resetFocusState(): void {
  currentState = 'idle';
  lastActivityAt = 0;
  firstTypingAt = null;
  lastKeystrokeAt = 0;
  recentMessages.length = 0;
  if (idleTimer !== null) { clearTimeout(idleTimer); idleTimer = null; }
  listeners.clear();
}
