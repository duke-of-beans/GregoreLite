/**
 * GET /api/recall/history — last 50 recall events with user actions
 * Sprint 27.0 — for Inspector diagnostics
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import type { RecallEvent } from '@/lib/recall/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDatabase();

    type EventRow = {
      id: string; type: string; source_type: string; source_id: string | null;
      source_name: string; message: string; context_data: string | null;
      relevance_score: number; surfaced_at: number | null;
      user_action: string | null; acted_at: number | null; created_at: number;
    };

    const rows = db.prepare<[], EventRow>(`
      SELECT id, type, source_type, source_id, source_name, message,
             context_data, relevance_score, surfaced_at, user_action, acted_at, created_at
      FROM recall_events
      ORDER BY created_at DESC
      LIMIT 50
    `).all() as EventRow[];

    const events: RecallEvent[] = rows.map((row) => ({
      id: row.id,
      type: row.type as RecallEvent['type'],
      source_type: row.source_type as RecallEvent['source_type'],
      source_name: row.source_name,
      message: row.message,
      relevance_score: row.relevance_score,
      created_at: row.created_at,
      ...(row.source_id    != null ? { source_id:    row.source_id              } : {}),
      ...(row.context_data != null ? { context_data: row.context_data           } : {}),
      ...(row.surfaced_at  != null ? { surfaced_at:  row.surfaced_at            } : {}),
      ...(row.user_action  != null ? { user_action:  row.user_action as RecallEvent['user_action'] } : {}),
      ...(row.acted_at     != null ? { acted_at:     row.acted_at              } : {}),
    }));

    type StatsRow = { total: number; surfaced: number; appreciated: number; dismissed: number; snoozed: number };
    const stats = db.prepare<[], StatsRow>(`
      SELECT
        COUNT(*)                                                           AS total,
        COUNT(surfaced_at)                                                 AS surfaced,
        SUM(CASE WHEN user_action = 'appreciated' THEN 1 ELSE 0 END)      AS appreciated,
        SUM(CASE WHEN user_action = 'dismissed'   THEN 1 ELSE 0 END)      AS dismissed,
        SUM(CASE WHEN user_action = 'snoozed'     THEN 1 ELSE 0 END)      AS snoozed
      FROM recall_events
    `).get() as StatsRow;

    return NextResponse.json({ events, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
