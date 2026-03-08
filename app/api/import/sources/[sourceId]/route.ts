import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { deleteVector } from '@/lib/vector';

export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { sourceId: string } }
): Promise<NextResponse> {
  const { sourceId } = params;
  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId required' }, { status: 400 });
  }

  try {
    const db = getDatabase();

    // Gather all chunk IDs belonging to this source so we can remove them
    // from the vec_index (sqlite-vec virtual table) before dropping the rows.
    const chunkRows = db
      .prepare(
        `SELECT id FROM content_chunks WHERE imported_source_id = ?`
      )
      .all(sourceId) as { id: string }[];

    const deleteAll = db.transaction(() => {
      // Remove vectors first — vec_index must be kept consistent with content_chunks
      for (const { id } of chunkRows) {
        deleteVector(id);
      }

      // Cascade: chunks → conversations → source
      db.prepare(`DELETE FROM content_chunks WHERE imported_source_id = ?`).run(sourceId);
      db.prepare(`DELETE FROM imported_conversations WHERE imported_source_id = ?`).run(sourceId);
      db.prepare(`DELETE FROM imported_sources WHERE id = ?`).run(sourceId);
    });

    deleteAll();

    return NextResponse.json({ deleted: sourceId, chunksRemoved: chunkRows.length });
  } catch (err) {
    console.error('[import/sources/delete] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
