/**
 * POST /api/agent-sdk/jobs/:id/unblock
 *
 * "Continue Anyway" action for a SHIM_LOOP-blocked session.
 * Updates job_state.status from 'blocked' → 'working' so David can acknowledge
 * the SHIM loop escalation and allow the session to continue.
 *
 * The agentic loop in query.ts is still running; this write is a UI signal only.
 * The next checkpoint write from query.ts will overwrite with the true live status.
 *
 * Sprint 7G — BLUEPRINT §4.3.4 (SHIM loop failure mode)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const db = getDatabase();

    const row = db
      .prepare(`SELECT status FROM job_state WHERE manifest_id = ?`)
      .get(id) as { status: string } | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (row.status !== 'blocked') {
      return NextResponse.json(
        { message: `Session is not blocked (current status: ${row.status})` },
        { status: 200 },
      );
    }

    db.prepare(
      `UPDATE job_state SET status = 'working', updated_at = ? WHERE manifest_id = ?`,
    ).run(Date.now(), id);

    return NextResponse.json({
      message: 'Session unblocked. The agent will continue on its next tool call.',
      manifestId: id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
