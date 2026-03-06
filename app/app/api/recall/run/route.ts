/**
 * POST /api/recall/run — manually trigger a recall detection pass
 * Sprint 27.0 — for testing/debugging via Inspector
 */

import { NextResponse } from 'next/server';
import { runRecallDetection } from '@/lib/recall/detector';
import {
  loadUserHistory,
  scoreRecallEvent,
  isEligibleToSurface,
  storeRecallEvents,
} from '@/lib/recall/scorer';
import { getDatabase } from '@/lib/kernl/database';
import { DEFAULT_RECALL_SETTINGS } from '@/lib/recall/types';
import type { RecallEvent } from '@/lib/recall/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  try {
    const events = await runRecallDetection(DEFAULT_RECALL_SETTINGS);
    const history = loadUserHistory();

    const db = getDatabase();
    type SurfacedRow = { type: string };
    const recentSurfaced = db.prepare<[number], SurfacedRow>(`
      SELECT DISTINCT type FROM recall_events
      WHERE surfaced_at IS NOT NULL AND surfaced_at > ?
      LIMIT 5
    `).all(Date.now() - 24 * 60 * 60 * 1000) as SurfacedRow[];
    const recentTypes = recentSurfaced.map((r) => r.type as RecallEvent['type']);

    const scored = events.map((e) => ({
      ...e,
      relevance_score: scoreRecallEvent(e, history, recentTypes),
    }));
    const eligible = scored.filter((e) => isEligibleToSurface(e.relevance_score));
    storeRecallEvents(eligible.slice(0, 5));

    return NextResponse.json({
      detected: events.length,
      eligible: eligible.length,
      stored:   Math.min(eligible.length, 5),
      events: scored.map((e) => ({
        id:              e.id,
        type:            e.type,
        source_name:     e.source_name,
        message:         e.message.slice(0, 80),
        relevance_score: Math.round(e.relevance_score * 100) / 100,
        eligible:        isEligibleToSurface(e.relevance_score),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
