/**
 * GET /api/kernl/manifests
 *
 * Returns all rows from the KERNL manifests table ordered by created_at desc.
 * Consumed by the War Room dependency graph (Sprint 2E).
 *
 * Fields returned: id, title, status, task_type, dependencies,
 *                  result_report, tokens_used, cost_usd, created_at
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDatabase();

    const rows = db
      .prepare(
        `SELECT
           id,
           title,
           status,
           task_type,
           dependencies,
           result_report,
           tokens_used,
           cost_usd,
           created_at
         FROM manifests
         ORDER BY created_at DESC`,
      )
      .all();

    return NextResponse.json(rows);
  } catch (err) {
    console.error('[api/kernl/manifests] query failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
