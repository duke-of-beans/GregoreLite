/**
 * POST /api/decision-gate/dismiss
 *
 * David dismisses the active gate. Increments the dismiss counter.
 * If counter < 3: releases lock, gate closes.
 * If counter reaches 3: lock stays active (mandatory), gate shows override UI.
 *
 * Returns: { released: boolean; mandatory: boolean; dismissCount: number }
 */

import { dismissLock, getDecisionLock } from '@/lib/decision-gate';

export async function POST(): Promise<Response> {
  dismissLock();
  const state = getDecisionLock();

  return new Response(
    JSON.stringify({
      released: !state.locked,
      mandatory: state.dismissCount >= 3,
      dismissCount: state.dismissCount,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
