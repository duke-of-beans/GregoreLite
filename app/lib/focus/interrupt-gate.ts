/**
 * interrupt-gate.ts — Interrupt Cost Gate — Sprint 19.0
 *
 * Law 5 (Protect Deep Work): every interruption passes through this gate.
 * Checks focus state and severity before allowing an interrupt to surface.
 * Queued interrupts are never lost — they drain when focus drops below threshold.
 *
 * Rules per Sacred Laws §5:
 *   idle       → allow all interrupts
 *   browsing   → allow medium+ severity
 *   composing  → allow high+ severity only
 *   deep_work  → allow critical only (everything else queued)
 *
 * BLUEPRINT SPRINT_19_0_BRIEF.md Tasks 5-6
 */

import { getFocusState, onFocusChange, type FocusState } from './focus-tracker';
import {
  spendAttention,
  isBudgetExhausted,
  type AttentionSpendType,
} from './attention-budget';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InterruptSeverity = 'low' | 'medium' | 'high' | 'critical';
export type InterruptType = 'notification' | 'gate' | 'ghost_suggestion' | 'status_update';

export interface InterruptRequest {
  type: InterruptType;
  severity: InterruptSeverity;
  message: string;
  /** Stable identifier — prevents duplicate queuing of the same interrupt */
  id?: string;
}

interface QueuedInterrupt {
  request: InterruptRequest;
  queuedAt: number;
}

// ─── Severity ordering ────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<InterruptSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/** Minimum severity rank allowed per focus state */
const MIN_RANK_FOR_STATE: Record<FocusState, number> = {
  idle: 0,       // all allowed
  browsing: 1,   // medium+
  composing: 2,  // high+
  deep_work: 3,  // critical only
};

// ─── Queue ────────────────────────────────────────────────────────────────────

const interruptQueue: QueuedInterrupt[] = [];
const drainListeners: Set<(drained: InterruptRequest[]) => void> = new Set();

function drainQueue(toState: FocusState): void {
  if (interruptQueue.length === 0) return;

  const minRank = MIN_RANK_FOR_STATE[toState];
  const releasable: QueuedInterrupt[] = [];
  const remaining: QueuedInterrupt[] = [];

  for (const item of interruptQueue) {
    const rank = SEVERITY_RANK[item.request.severity];
    if (rank >= minRank) {
      releasable.push(item);
    } else {
      remaining.push(item);
    }
  }

  if (releasable.length === 0) return;

  // Replace queue with remaining items
  interruptQueue.length = 0;
  interruptQueue.push(...remaining);

  // Notify drain listeners
  const released = releasable.map((q) => q.request);
  for (const cb of drainListeners) {
    try { cb(released); } catch { /* drain errors must not crash the gate */ }
  }
}

// Wire drain to focus state transitions
onFocusChange((newState) => {
  drainQueue(newState);
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Map interrupt type + severity to an AttentionSpendType for budget tracking.
 */
function toSpendType(request: InterruptRequest): AttentionSpendType {
  if (request.severity === 'critical') return 'critical_alert';
  if (request.type === 'ghost_suggestion') return 'ghost_suggestion';
  if (request.type === 'notification') return 'status_notification';
  if (request.type === 'gate') {
    return request.severity === 'high' ? 'gate_mandatory' : 'gate_warning';
  }
  return 'status_notification';
}

/**
 * shouldInterrupt — determine if an interrupt may surface now.
 * Returns true if allowed, false if blocked (interrupt is queued instead).
 *
 * Checks focus state AND attention budget before allowing.
 * Status updates (passive, non-popup) always pass through regardless of either.
 */
export function shouldInterrupt(request: InterruptRequest): boolean {
  // Status updates are always passive — never blocked
  if (request.type === 'status_update') return true;

  // Budget check: exhausted budget blocks all non-critical interrupts
  if (request.severity !== 'critical' && isBudgetExhausted()) {
    queueInterrupt(request);
    return false;
  }

  const state = getFocusState();
  const minRank = MIN_RANK_FOR_STATE[state];
  const rank = SEVERITY_RANK[request.severity];

  if (rank >= minRank) {
    // Allowed — deduct attention budget
    spendAttention(toSpendType(request));
    return true;
  }

  // Below threshold — queue it (never lost)
  queueInterrupt(request);
  return false;
}

/**
 * queueInterrupt — add an interrupt to the queue.
 * De-duplicates by request.id if provided.
 */
export function queueInterrupt(request: InterruptRequest): void {
  if (request.id) {
    const alreadyQueued = interruptQueue.some((q) => q.request.id === request.id);
    if (alreadyQueued) return;
  }
  interruptQueue.push({ request, queuedAt: Date.now() });
}

/**
 * getQueuedInterrupts — snapshot of currently queued interrupts.
 */
export function getQueuedInterrupts(): InterruptRequest[] {
  return interruptQueue.map((q) => q.request);
}

/**
 * onQueueDrain — subscribe to queue drain events.
 * Called when focus state drops and queued interrupts become releasable.
 * Returns unsubscribe function.
 */
export function onQueueDrain(callback: (released: InterruptRequest[]) => void): () => void {
  drainListeners.add(callback);
  return () => { drainListeners.delete(callback); };
}

/**
 * clearInterruptQueue — for testing only.
 */
export function clearInterruptQueue(): void {
  interruptQueue.length = 0;
}
