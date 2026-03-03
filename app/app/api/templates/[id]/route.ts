/**
 * Templates [id] API — Sprint 9-07
 *
 * DELETE /api/templates/:id — delete a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteTemplate } from '@/lib/agent-sdk/template-store';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    deleteTemplate(id);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
