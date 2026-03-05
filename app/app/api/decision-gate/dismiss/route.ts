/**
 * POST /api/decision-gate/dismiss
 *
 * David dismisses the active gate. Increments the dismiss counter.
 * If counter < 3: releases lock, gate closes.
 * If counter reaches 3: lock stays active (mandatory), gate shows override UI.
 *
 * Returns: { released: boolean; mandatory: boolean; dismissCount: number }
 */

import { NextResponse } from 'next/server';
import { dismissLock, getDecisionLock } from '@/lib/decision-gate';
import { safeHandler } from '@/lib/api/utils';

export const POST = safeHandler(async () => {
  dismissLock();
  const state = getDecisionLock();

  return NextResponse.json({
    released: !state.locked,
    mandatory: state.dismissCount >= 3,
    dismissCount: state.dismissCount,
  });
});
