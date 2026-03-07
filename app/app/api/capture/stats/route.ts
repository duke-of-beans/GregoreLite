/**
 * GET /api/capture/stats
 *
 * Sprint 29.0 — Quick Capture Pad
 * Returns per-project note counts, top-mentioned items, classification breakdown.
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import type { CaptureNote, CaptureStats, CaptureClassification } from '@/lib/capture/types';

export async function GET() {
  try {
    const db = getDatabase();

    // Per-project counts (inbox only, primary notes)
    const projectCounts = db.prepare(`
      SELECT project_id, COUNT(*) as count
      FROM capture_notes
      WHERE status = 'inbox' AND merged_with IS NULL
      GROUP BY project_id
    `).all() as { project_id: string | null; count: number }[];

    const perProject: Record<string, number> = {};
    let unrouted = 0;
    for (const row of projectCounts) {
      if (row.project_id === null) {
        unrouted = row.count;
      } else {
        perProject[row.project_id] = row.count;
      }
    }

    // High-mention notes (3+)
    const highMention = db.prepare(`
      SELECT * FROM capture_notes
      WHERE mention_count >= 3 AND status = 'inbox' AND merged_with IS NULL
      ORDER BY mention_count DESC
    `).all() as CaptureNote[];

    // Classification breakdown
    const classCounts = db.prepare(`
      SELECT classification, COUNT(*) as count
      FROM capture_notes
      WHERE status = 'inbox' AND merged_with IS NULL
      GROUP BY classification
    `).all() as { classification: string; count: number }[];

    const byClassification: Record<CaptureClassification, number> = {
      bug: 0, feature: 0, question: 0, idea: 0,
    };
    for (const row of classCounts) {
      const cls = row.classification as CaptureClassification;
      if (cls in byClassification) byClassification[cls] = row.count;
    }

    const stats: CaptureStats = { perProject, unrouted, highMention, byClassification };
    return NextResponse.json(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
