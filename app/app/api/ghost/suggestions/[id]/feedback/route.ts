/**
 * POST /api/ghost/suggestions/[id]/feedback
 *
 * Records a 'noted' or 'expanded' action against a surfaced Ghost suggestion.
 * Also marks dismissed_at on ghost_surfaced when action is 'noted'.
 *
 * Body: { action: 'noted' | 'expanded' }
 */

import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';

interface FeedbackRequest {
  action: 'noted' | 'expanded';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing suggestion id' }, { status: 400 });
    }

    let body: FeedbackRequest;
    try {
      body = await request.json() as FeedbackRequest;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action } = body;
    if (action !== 'noted' && action !== 'expanded') {
      return NextResponse.json(
        { error: 'action must be "noted" or "expanded"' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // Look up the suggestion from ghost_surfaced to get chunk_id + source_path
    const row = db.prepare(
      `SELECT chunk_id, source_path FROM ghost_surfaced WHERE id = ? LIMIT 1`
    ).get(id) as { chunk_id: string; source_path: string | null } | undefined;

    if (!row) {
      // Suggestion already purged — still return 200 (idempotent)
      return NextResponse.json({ success: true, data: { recorded: false, reason: 'not_found' } });
    }

    // Insert feedback row
    db.prepare(
      `INSERT INTO ghost_suggestion_feedback (id, chunk_id, source_path, action, logged_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(nanoid(), row.chunk_id, row.source_path, action, Date.now());

    // For 'noted': mark dismissed_at on ghost_surfaced
    if (action === 'noted') {
      db.prepare(
        `UPDATE ghost_surfaced SET dismissed_at = ? WHERE id = ?`
      ).run(Date.now(), id);
    }

    return NextResponse.json({ success: true, data: { recorded: true, action } });
  } catch (err) {
    console.error('[ghost/suggestions/feedback] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
