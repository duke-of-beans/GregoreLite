/**
 * GET /api/cross-context/suppressed
 *
 * Returns suggestions where user_action = 'dismissed', joined with
 * content_chunks for preview content and source metadata.
 * Used by ContextLibrary drawer.
 *
 * DELETE /api/cross-context/suppressed?id=<id>
 * Un-suppress a suggestion by clearing its action so it re-enters the pool.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface SuppressedRow {
  id: string;
  chunk_id: string;
  similarity_score: number;
  surface_context: string;
  acted_at: number;
  surfaced_at: number;
  content: string;
  source_type: string;
  source_id: string;
}

export function GET(): NextResponse {
  try {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT
           s.id,
           s.chunk_id,
           s.similarity_score,
           s.surface_context,
           s.acted_at,
           s.surfaced_at,
           c.content,
           c.source_type,
           c.source_id
         FROM suggestions s
         JOIN content_chunks c ON s.chunk_id = c.id
         WHERE s.user_action = 'dismissed'
         ORDER BY s.acted_at DESC
         LIMIT 100`
      )
      .all() as SuppressedRow[];

    return NextResponse.json({ suppressed: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const db = getDatabase();
    db.prepare(
      `UPDATE suggestions SET user_action = NULL, acted_at = NULL WHERE id = ?`
    ).run(id);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
