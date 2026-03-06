/**
 * /api/agent-sdk/actions — Action Journal API — Sprint 19.0
 *
 * GET  ?sessionId=xxx  — list all journal entries for a session
 * POST { entryId, action: 'undo' } — execute undo for a reversible file write
 *
 * Law 3 (Reversibility): exposes the action journal to the Inspector UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionActions, undoAction } from '@/lib/agent-sdk/action-journal';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const entries = getSessionActions(sessionId);
    return NextResponse.json({ data: entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>)['entryId'] !== 'string' ||
    (body as Record<string, unknown>)['action'] !== 'undo'
  ) {
    return NextResponse.json(
      { error: 'Body must be { entryId: string, action: "undo" }' },
      { status: 400 },
    );
  }

  const { entryId } = body as { entryId: string };

  try {
    const result = undoAction(entryId);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 422 });
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
