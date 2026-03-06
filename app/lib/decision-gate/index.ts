/**
 * Decision Gate — Public API
 *
 * The Decision Gate watches the strategic thread for high-stakes decision
 * patterns and signals when David should pause and confirm before proceeding.
 * (Blueprint §8)
 *
 * PUBLIC API:
 *   analyze(messages)      — evaluate all 8 conditions; returns TriggerResult
 *   getDecisionLock()      — current lock state snapshot
 *   releaseLock()          — David approves; clears lock
 *   dismissLock()          — David dismisses; increments counter; mandatory at 3
 *   isMandatory()          — true once dismissCount >= 3
 *
 * WIRING:
 *   analyze() is called fire-and-forget after every assistant response in
 *   the chat route. If triggered, result is stored in useDecisionGateStore
 *   (Zustand) and the GatePanel component renders above the input field.
 *
 * SPRINT 4B CHANGE:
 *   The three previously-stubbed triggers (high_tradeoff_count, multi_project_touch,
 *   large_build_estimate) are now evaluated via a single Haiku inference call
 *   (inferStructuredTriggers). One API call, three results — cost ~$0.0005/message.
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
} from './trigger-detector';
import { detectContradiction } from './contradiction';
import { inferStructuredTriggers } from './inference';

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
 *   6-8. high_tradeoff_count / multi_project_touch / large_build_estimate
 *        — single Haiku inference call, async (~$0.0005/message)
 *
 * When a trigger fires, acquireLock() is called immediately so the lock
 * state is available synchronously for the chat route 423 enforcement.
 *
 * Called fire-and-forget from the chat route — does NOT delay API responses.
 */
export async function analyze(messages: GateMessage[]): Promise<TriggerResult> {
  // ── Sync checks (ordered cheapest → most expensive) ──────────────────────

  if (detectRepeatedQuestion(messages)) {
    return triggered(
      'repeated_question',
      'You\'ve asked about this a few times. Want to dig deeper instead of circling back?',
    );
  }

  if (detectSacredPrincipleRisk(messages)) {
    return triggered(
      'sacred_principle_risk',
      'This looks like a temporary fix. Shortcuts tend to become permanent. Proceed anyway?',
    );
  }

  if (detectIrreversibleAction(messages)) {
    return triggered(
      'irreversible_action',
      'This can\'t be undone — schema change, production deploy, or force push. Confirm?',
    );
  }

  if (detectLowConfidence(messages)) {
    return triggered(
      'low_confidence',
      'I\'m not confident about this one. Want me to verify before moving forward?',
    );
  }

  // ── Async checks ──────────────────────────────────────────────────────────

  if (await detectContradiction(messages)) {
    return triggered(
      'contradicts_prior',
      'This contradicts a previous decision. Worth reviewing before changing course.',
    );
  }

  // ── Haiku inference — single call for three structured triggers ───────────
  // Sprint 4B: replaces the three always-false stubs from Sprint 4A.
  // One inference call returns all three results. Fails open on any error.

  const inference = await inferStructuredTriggers(messages);

  if (inference.highTradeoff) {
    return triggered(
      'high_tradeoff_count',
      'This decision has 4+ major tradeoffs. Worth evaluating them before committing.',
    );
  }

  if (inference.multiProject) {
    return triggered(
      'multi_project_touch',
      'This touches multiple projects at once. Confirm the cross-project impact.',
    );
  }

  if (inference.largeEstimate) {
    return triggered(
      'large_build_estimate',
      'This is a big build — estimated to take 3+ sessions. Confirm scope before starting.',
    );
  }

  return { triggered: false, trigger: null, reason: '' };
}
