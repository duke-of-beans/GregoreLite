/**
 * POST /api/agent-sdk/jobs/[id]/kill
 *
 * Kills a running session immediately. Aborts the SDK stream, releases the
 * scheduler slot, and transitions status → interrupted.
 *
 * Sprint 7F — Job Queue UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { killSession } from '@/lib/agent-sdk';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const result = killSession(id);

    if (!result.killed) {
      return NextResponse.json(
        { error: 'Session not found or already finished' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
