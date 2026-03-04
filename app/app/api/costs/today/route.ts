/**
 * GET /api/costs/today — Sprint S9-04
 *
 * Returns the sum of estimated_cost_usd from session_costs
 * where started_at >= today midnight (local). Used by StatusBar.
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

export async function GET() {
  try {
    const db = getDatabase();

    // Guard: if session_costs table doesn't exist yet, return zero silently
    const hasTable = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='session_costs'"
    ).get();
    if (!hasTable) {
      return NextResponse.json({ data: { totalUsd: 0, since: Date.now(), queriedAt: Date.now() } });
    }

    // Midnight today in epoch ms
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const row = db
      .prepare(
        `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
         FROM session_costs
         WHERE started_at >= ?`
      )
      .get(midnight) as { total: number };

    return NextResponse.json({
      data: {
        totalUsd: row.total,
        since: midnight,
        queriedAt: Date.now(),
      },
    });
  } catch (error) {
    console.debug('[api/costs/today] DB unavailable:', error);
    return NextResponse.json({
      data: {
        totalUsd: 0,
        since: Date.now(),
        queriedAt: Date.now(),
      },
    });
  }
}