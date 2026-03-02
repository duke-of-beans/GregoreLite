/**
 * Decision Gate — Public API
 *
 * The Decision Gate watches the strategic thread for high-stakes decision
 * patterns and signals when David should pause and confirm before proceeding.
 * (Blueprint §8)
 *
 * PUBLIC API:
 *   analyze(messages)   — evaluate all 8 conditions; returns TriggerResult
 *   getDecisionLock()   — current lock state snapshot
 *   releaseLock()       — David approves; clears lock, logs to KERNL (4B)
 *   dismissLock()       — David dismisses; increments counter; mandatory at 3
 *   isMandatory()       — true once dismissCount >= 3
 *
 * WIRING:
 *   analyze() is called fire-and-forget after every assistant response in
 *   the chat route. If triggered, result is stored in decisionGateStore
 *   (Zustand) and the UI panel is rendered in Sprint 4B.
 */

export type { TriggerResult, DecisionLockState, GateTrigger, GateMessage } from './types';

export {
  getLockState as getDecisionLock,
  acquireLock,
  releaseLock,
  dismissLock,
  isMandatory,
} from './lock';

import type { GateMessage, GateTrigger, TriggerResult } from './types';
import { acquireLock } from './lock';
import {
  detectRepeatedQuestion,
  detectSacredPrincipleRisk,
  detectIrreversibleAction,
  detectLowConfidence,
  detectHighTradeoffCount,
  detectMultiProjectTouch,
  detectLargeEstimate,
} from './trigger-detector';
import { detectContradiction } from './contradiction';

/** Build a triggered TriggerResult, acquire lock, and return it. */
function triggered(trigger: GateTrigger, reason: string): TriggerResult {
  acquireLock(trigger, reason);
  return { triggered: true, trigger, reason };
}

/**
 * Analyze a conversation for decision gate trigger conditions.
 *
 * Evaluation order (cheap checks first, async/semantic last):
 *   1. repeated_question     — keyword overlap, sync
 *   2. sacred_principle_risk — phrase match, sync
 *   3. irreversible_action   — regex, sync
 *   4. low_confidence        — phrase count, sync
 *   5. contradicts_prior     — vector similarity, async
 *   6. high_tradeoff_count   — STUB, always false
 *   7. multi_project_touch   — STUB, always false
 *   8. large_build_estimate  — STUB, always false
 *
 * When a trigger fires, acquireLock() is called immediately so the lock
 * state is available synchronously for the chat route / Sprint 4B enforcement.
 *
 * Called fire-and-forget from the chat route — does NOT delay API responses.
 */
export async function analyze(messages: GateMessage[]): Promise<TriggerResult> {
  // ── Sync checks (ordered cheapest → most expensive) ──────────────────────

  if (detectRepeatedQuestion(messages)) {
    return triggered(
      'repeated_question',
      'The same architectural question has come up 3+ times. Worth pausing to make a clear decision.'
    );
  }

  if (detectSacredPrincipleRisk(messages)) {
    return triggered(
      'sacred_principle_risk',
      'Detected language suggesting a temporary fix or technical debt. This conflicts with Option B Perfection.'
    );
  }

  if (detectIrreversibleAction(messages)) {
    return triggered(
      'irreversible_action',
      'The proposed action appears irreversible (schema change, production deploy, or force push). Confirm before proceeding.'
    );
  }

  if (detectLowConfidence(messages)) {
    return triggered(
      'low_confidence',
      'Claude expressed uncertainty multiple times in this response. Worth confirming direction before continuing.'
    );
  }

  // ── Async checks (semantic / vector) ─────────────────────────────────────

  if (await detectContradiction(messages)) {
    return triggered(
      'contradicts_prior',
      'This may contradict a prior decision logged in KERNL. Review before proceeding.'
    );
  }

  // ── Stubs — Sprint 4B wires these via Haiku inference ────────────────────

  if (await detectHighTradeoffCount(messages)) {
    return triggered(
      'high_tradeoff_count',
      'This decision involves 4 or more major tradeoffs. Worth pausing to evaluate them explicitly.'
    );
  }

  if (await detectMultiProjectTouch(messages)) {
    return triggered(
      'multi_project_touch',
      'This decision touches multiple projects simultaneously. Confirm the cross-project impact.'
    );
  }

  if (await detectLargeEstimate(messages)) {
    return triggered(
      'large_build_estimate',
      'The proposed build is estimated to take more than 3 Agent SDK sessions. Confirm scope before starting.'
    );
  }

  return { triggered: false, trigger: null, reason: '' };
}
