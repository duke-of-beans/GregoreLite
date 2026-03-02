/**
 * Decision Gate — KERNL Logger
 *
 * Writes gate approval and override events to the KERNL decisions table.
 * Called by the approve/override API routes after David confirms the gate.
 * Releases the decision_lock as part of the same synchronous operation
 * so the next Claude API call is unblocked immediately.
 *
 * Schema fit: decisions.category = 'decision-gate'
 *             decisions.title    = 'Decision Gate approved: sacred_principle_risk'
 *             decisions.rationale = provided text or default
 *             decisions.impact   = 'high' (always — gate only fires for high-stakes)
 *
 * @module lib/decision-gate/kernl-logger
 */

import { logDecision } from '@/lib/kernl/decision-store';
import { releaseLock } from './lock';
import type { GateTrigger } from './types';

/**
 * Log a gate approval or override to KERNL and release the decision lock.
 *
 * @param threadId  - Active thread ID (for KERNL foreign key)
 * @param trigger   - Which trigger fired (e.g. 'sacred_principle_risk')
 * @param action    - 'approved' (normal flow) or 'overridden' (mandatory gate)
 * @param rationale - User-provided text; required for overrides (≥20 chars enforced at API)
 */
export function logGateApproval(
  threadId: string,
  trigger: GateTrigger,
  action: 'approved' | 'overridden',
  rationale?: string,
): void {
  const defaultRationale = `Decision Gate ${action} by David`;

  logDecision({
    thread_id: threadId,
    category: 'decision-gate',
    title: `Decision Gate ${action}: ${trigger}`,
    rationale: rationale && rationale.trim().length > 0 ? rationale.trim() : defaultRationale,
    impact: 'high',
  });

  // Release the module-level lock — next POST /api/chat will succeed
  releaseLock();
}
