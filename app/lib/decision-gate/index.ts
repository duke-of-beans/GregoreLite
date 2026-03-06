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
import { hasActivePolicy } from './override-policies';
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
 * Sprint 18.0: Check if an override policy suppresses this trigger.
 * Returns a non-triggered result with autoAllowed metadata if a policy exists,
 * or null if the trigger should proceed normally.
 * 'once' policies are auto-deleted inside hasActivePolicy on first match.
 */
function policyBypass(trigger: GateTrigger): TriggerResult | null {
  if (!hasActivePolicy(trigger)) return null;
  console.info(`[decision-gate] '${trigger}' suppressed by override policy`);
  return { triggered: false, trigger: null, reason: '', autoAllowed: { trigger } };
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

  {
    const bypass = policyBypass('repeated_question');
    if (bypass) return bypass;
    if (detectRepeatedQuestion(messages)) {
      return triggered(
        'repeated_question',
        'You\'ve asked about this a few times. Want to dig deeper instead of circling back?',
      );
    }
  }

  {
    const bypass = policyBypass('sacred_principle_risk');
    if (bypass) return bypass;
    if (detectSacredPrincipleRisk(messages)) {
      return triggered(
        'sacred_principle_risk',
        'This looks like a temporary fix. Shortcuts tend to become permanent. Proceed anyway?',
      );
    }
  }

  {
    const bypass = policyBypass('irreversible_action');
    if (bypass) return bypass;
    if (detectIrreversibleAction(messages)) {
      return triggered(
        'irreversible_action',
        'This can\'t be undone — schema change, production deploy, or force push. Confirm?',
      );
    }
  }

  {
    const bypass = policyBypass('low_confidence');
    if (bypass) return bypass;
    if (detectLowConfidence(messages)) {
      return triggered(
        'low_confidence',
        'I\'m not confident about this one. Want me to verify before moving forward?',
      );
    }
  }

  // ── Async checks ──────────────────────────────────────────────────────────

  {
    const bypass = policyBypass('contradicts_prior');
    if (bypass) return bypass;
    if (await detectContradiction(messages)) {
      return triggered(
        'contradicts_prior',
        'This contradicts a previous decision. Worth reviewing before changing course.',
      );
    }
  }

  // ── Haiku inference — single call for three structured triggers ───────────
  // Sprint 4B: replaces the three always-false stubs from Sprint 4A.
  // One inference call returns all three results. Fails open on any error.
  // Sprint 18.0: each trigger checked against override policies first.

  const [bypassHT, bypassMP, bypassLE] = [
    policyBypass('high_tradeoff_count'),
    policyBypass('multi_project_touch'),
    policyBypass('large_build_estimate'),
  ];

  // If all three Haiku triggers are bypassed, skip the inference call entirely
  if (bypassHT && bypassMP && bypassLE) {
    // Return the first bypass result (all three are equivalent non-triggered results)
    return bypassHT;
  }

  const inference = await inferStructuredTriggers(messages);

  if (inference.highTradeoff) {
    if (bypassHT) return bypassHT;
    return triggered(
      'high_tradeoff_count',
      'This decision has 4+ major tradeoffs. Worth evaluating them before committing.',
    );
  }

  if (inference.multiProject) {
    if (bypassMP) return bypassMP;
    return triggered(
      'multi_project_touch',
      'This touches multiple projects at once. Confirm the cross-project impact.',
    );
  }

  if (inference.largeEstimate) {
    if (bypassLE) return bypassLE;
    return triggered(
      'large_build_estimate',
      'This is a big build — estimated to take 3+ sessions. Confirm scope before starting.',
    );
  }

  return { triggered: false, trigger: null, reason: '' };
}
