/**
 * POST /api/capture/[id]/dismiss — Sprint 29.0
 * Sets note status to dismissed. Stays in DB for dedup, won't surface in inbox.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import type { CaptureNote } from '@/lib/capture/types';

interface RouteParams { params: Promise<{ id: string }>; }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const db = getDatabase();
    const note = db.prepare('SELECT id FROM capture_notes WHERE id = ?').get(id) as CaptureNote | undefined;
    if (!note) return NextResponse.json({ error: `Note ${id} not found` }, { status: 404 });
    db.prepare("UPDATE capture_notes SET status = 'dismissed', last_mentioned_at = ? WHERE id = ?")
      .run(Date.now(), id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}