/**
 * Thread Search API — Sprint S9-08
 *
 * GET /api/threads/[id]/search?q=<query>&limit=<n>
 *
 * Queries messages_fts (FTS5) scoped to a specific thread.
 * Returns matching message IDs + content snippets for highlight.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface SearchResult {
  id: string;
  role: string;
  content: string;
  created_at: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: threadId } = await params;
    const q = request.nextUrl.searchParams.get('q');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    if (!q || !q.trim()) {
      return NextResponse.json({ data: [] });
    }

    const db = getDatabase();

    // FTS5 MATCH scoped to thread via JOIN
    const rows = db.prepare(`
      SELECT m.id, m.role, m.content, m.created_at
      FROM messages m
      JOIN messages_fts f ON m.rowid = f.rowid
      WHERE messages_fts MATCH ?
        AND m.thread_id = ?
      ORDER BY rank
      LIMIT ?
    `).all(q.trim(), threadId, limit) as SearchResult[];

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[thread-search] FTS query failed:', err);
    return NextResponse.json(
      { error: 'Search failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    );
  }
}
