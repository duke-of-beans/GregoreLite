/**
 * /api/threads/[id]
 *
 * PATCH { title: string } — rename a thread via KERNL updateThreadTitle
 * DELETE               — delete a thread via KERNL deleteThread
 *
 * Sprint 10.9 Task 1
 */

import { NextResponse } from 'next/server';
import { updateThreadTitle, deleteThread, getThread } from '@/lib/kernl/session-manager';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = await request.json() as { title?: string };

    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      );
    }

    updateThreadTitle(id, body.title.trim());
    const updated = getThread(id);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.warn('[api/threads/[id] PATCH]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to rename thread' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    deleteThread(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.warn('[api/threads/[id] DELETE]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to delete thread' },
      { status: 500 }
    );
  }
}
