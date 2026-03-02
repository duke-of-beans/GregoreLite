/**
 * GET /api/ghost/chunks/[chunkId]
 *
 * Returns the stored text content for a single content_chunks row.
 * Used by GhostCard "Tell me more" to fetch the full chunk before injection.
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface ChunkRow {
  id: string;
  content: string;
  source_type: string;
  source_path: string | null;
  source_account: string | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chunkId: string }> }
) {
  try {
    const { chunkId } = await params;

    if (!chunkId) {
      return NextResponse.json({ error: 'Missing chunkId' }, { status: 400 });
    }

    const db = getDatabase();
    const row = db.prepare(
      `SELECT id, content, source_type, source_path, source_account
       FROM content_chunks WHERE id = ? LIMIT 1`
    ).get(chunkId) as ChunkRow | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        content: row.content,
        sourceType: row.source_type,
        sourcePath: row.source_path,
        sourceAccount: row.source_account,
      },
    });
  } catch (err) {
    console.error('[ghost/chunks] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
