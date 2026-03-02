/**
 * POST /api/agent-sdk/jobs/[id]/restart
 *
 * Restarts an interrupted session with a handoff report. Creates a new
 * manifest cloned from the original, injects the handoff context, and
 * spawns a fresh session. Returns the new manifest ID.
 *
 * Sprint 7F — Job Queue UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawnRestart } from '@/lib/agent-sdk/restart';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const result = await spawnRestart(id);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // 404 when original manifest not found; 500 for other errors
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
