/**
 * /api/agent-sdk/budget
 *
 * GET  — returns current budget config values + today's daily total
 * PATCH — writes updated values to budget_config table
 *
 * Sprint 7F — BudgetSettingsPanel + JobQueue daily burn badge
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBudgetConfigNumber,
  setBudgetConfig,
  getDailyTotalUsd,
} from '@/lib/agent-sdk/budget-enforcer';

export async function GET() {
  try {
    return NextResponse.json({
      data: {
        session_soft_cap_usd: getBudgetConfigNumber('session_soft_cap_usd', 2.0),
        daily_hard_cap_usd:   getBudgetConfigNumber('daily_hard_cap_usd', 15.0),
        rate_limit_tokens_per_minute: getBudgetConfigNumber('rate_limit_tokens_per_minute', 80000),
        daily_total_usd: getDailyTotalUsd(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;

    const ALLOWED_KEYS = new Set([
      'session_soft_cap_usd',
      'daily_hard_cap_usd',
      'rate_limit_tokens_per_minute',
    ]);

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.has(key)) continue;
      const n = Number(value);
      if (isNaN(n) || n <= 0) {
        return NextResponse.json(
          { error: `Invalid value for ${key}: must be a positive number` },
          { status: 400 },
        );
      }
      setBudgetConfig(key, String(n));
    }

    return NextResponse.json({ data: { saved: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
