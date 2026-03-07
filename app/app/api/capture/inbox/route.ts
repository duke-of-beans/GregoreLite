/**
 * GET /api/capture/inbox
 *
 * Sprint 29.0 — Quick Capture Pad
 * Returns all notes with status='inbox', sorted by mention_count DESC then created_at DESC.
 * Supports ?project= filter (project_id) and ?unrouted=true for unrouted-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import type { CaptureInboxItem } from '@/lib/capture/types';

export async function GET(req: NextRequest) {
  try {
    const db = getDatabase();
    const { searchParams } = new URL(req.url);
    const projectFilter = searchParams.get('project');
    const unroutedOnly = searchParams.get('unrouted') === 'true';

    let query: string;
    let params: unknown[];

    if (unroutedOnly) {
      query = `
        SELECT cn.*, NULL as project_name
        FROM capture_notes cn
        WHERE cn.status = 'inbox'
          AND cn.project_id IS NULL
          AND cn.merged_with IS NULL
        ORDER BY cn.mention_count DESC, cn.created_at DESC
      `;
      params = [];
    } else if (projectFilter) {
      query = `
        SELECT cn.*, pp.name as project_name
        FROM capture_notes cn
        LEFT JOIN portfolio_projects pp ON cn.project_id = pp.id
        WHERE cn.status = 'inbox'
          AND cn.project_id = ?
          AND cn.merged_with IS NULL
        ORDER BY cn.mention_count DESC, cn.created_at DESC
      `;
      params = [projectFilter];
    } else {
      query = `
        SELECT cn.*, pp.name as project_name
        FROM capture_notes cn
        LEFT JOIN portfolio_projects pp ON cn.project_id = pp.id
        WHERE cn.status = 'inbox'
          AND cn.merged_with IS NULL
        ORDER BY cn.mention_count DESC, cn.created_at DESC
      `;
      params = [];
    }

    const notes = db.prepare(query).all(...params) as CaptureInboxItem[];
    return NextResponse.json({ notes, count: notes.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
