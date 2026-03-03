/**
 * DELETE /api/threads/[id]/truncate-after/[messageId]
 * S9-20 — Remove all messages after the given messageId from KERNL.
 * Used by Edit Last Message to truncate a thread before re-sending.
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface Params {
  params: Promise<{ id: string; messageId: string }>;
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id: threadId, messageId } = await params;

    const db = getDatabase();

    // Get the message's created_at to know where to cut
    const target = db.prepare(
      'SELECT created_at FROM messages WHERE id = ? AND thread_id = ?'
    ).get(messageId, threadId) as { created_at: number } | undefined;

    if (!target) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Delete all messages in this thread created after the target message
    const result = db.prepare(
      'DELETE FROM messages WHERE thread_id = ? AND created_at > ?'
    ).run(threadId, target.created_at);

    return NextResponse.json({
      data: {
        threadId,
        messageId,
        deletedCount: result.changes,
      },
    });
  } catch (err) {
    console.error('[threads/truncate-after] DELETE failed:', err);
    return NextResponse.json({ error: 'Failed to truncate thread' }, { status: 500 });
  }
}