/**
 * Cost Breakdown API — Sprint S9-10
 *
 * GET /api/costs/breakdown?range=today|week|all
 *
 * Aggregates session_costs grouped by project_id.
 * Returns per-project totals: session count, input/output tokens, cost USD.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface CostRow {
  project_id: string | null;
  session_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
}

function rangeToCondition(range: string): string {
  switch (range) {
    case 'today': {
      // started_at is unix ms — compare to start of today
      return 'AND sc.started_at >= (strftime(\'%s\', \'now\', \'start of day\') * 1000)';
    }
    case 'week': {
      return 'AND sc.started_at >= (strftime(\'%s\', \'now\', \'-7 days\') * 1000)';
    }
    case 'all':
    default:
      return '';
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const range = request.nextUrl.searchParams.get('range') ?? 'today';
    const db = getDatabase();
    const condition = rangeToCondition(range);

    const rows = db.prepare(`
      SELECT
        sc.project_id,
        COUNT(*) as session_count,
        SUM(sc.input_tokens) as input_tokens,
        SUM(sc.output_tokens) as output_tokens,
        SUM(sc.total_tokens) as total_tokens,
        SUM(sc.estimated_cost_usd) as total_cost_usd
      FROM session_costs sc
      WHERE 1=1 ${condition}
      GROUP BY sc.project_id
      ORDER BY total_cost_usd DESC
    `).all() as CostRow[];

    // Grand totals
    const totals = rows.reduce(
      (acc, r) => ({
        session_count: acc.session_count + r.session_count,
        input_tokens: acc.input_tokens + r.input_tokens,
        output_tokens: acc.output_tokens + r.output_tokens,
        total_tokens: acc.total_tokens + r.total_tokens,
        total_cost_usd: acc.total_cost_usd + r.total_cost_usd,
      }),
      { session_count: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0, total_cost_usd: 0 },
    );

    return NextResponse.json({ data: { rows, totals, range } });
  } catch (err) {
    console.error('[cost-breakdown] Query failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch cost breakdown' },
      { status: 500 }
    );
  }
}
