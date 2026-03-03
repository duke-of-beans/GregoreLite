/**
 * Budget Status API — Sprint S9-15
 *
 * GET /api/agent-sdk/budget-status → daily total, cap, override status
 * Lightweight endpoint for tray-bridge polling.
 */

import { NextResponse } from 'next/server';
import { getDailyCapStatus } from '@/lib/agent-sdk/budget-enforcer';

export async function GET() {
  try {
    const status = getDailyCapStatus();
    return NextResponse.json({
      data: {
        dailyTotalUsd: status.dailyTotalUsd,
        dailyCapUsd: status.dailyCapUsd,
        reached: status.reached,
        overrideActive: status.overrideActive,
      },
    });
  } catch (err) {
    console.error('[budget-status] GET failed:', err);
    return NextResponse.json({ error: 'Failed to load budget status' }, { status: 500 });
  }
}
