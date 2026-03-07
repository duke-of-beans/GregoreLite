/**
 * POST /api/capture/[id]/promote — Sprint 29.0
 * Promotes a note to backlogged and writes it to the project backlog file.
 */
import { NextRequest, NextResponse } from 'next/server';
import { promoteToBacklog } from '@/lib/capture/promote';

interface RouteParams { params: Promise<{ id: string }>; }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const result = await promoteToBacklog(id);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 422 });
    return NextResponse.json({ success: true, filePath: result.filePath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}