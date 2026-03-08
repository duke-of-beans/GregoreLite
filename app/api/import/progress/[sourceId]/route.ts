import { NextRequest, NextResponse } from 'next/server';
import { getProgress } from '@/lib/import/pipeline';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { sourceId: string } }
): Promise<NextResponse> {
  const progress = getProgress(params.sourceId);
  if (!progress) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(progress);
}
