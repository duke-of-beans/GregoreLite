/**
 * POST /api/recall/action — record user action on a recall event
 * Sprint 27.0
 *
 * Body: { eventId: string, action: RecallUserAction }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import type { RecallUserAction } from '@/lib/recall/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ActionBody {
  eventId: string;
  action: RecallUserAction;
}

const VALID_ACTIONS: RecallUserAction[] = ['appreciated', 'dismissed', 'snoozed'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as ActionBody;
    const { eventId, action } = body;

    if (!eventId || !action) {
      return NextResponse.json({ error: 'eventId and action are required' }, { status: 400 });
    }
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 },
      );
    }

    const db = getDatabase();
    const now = Date.now();

    if (action === 'snoozed') {
      // Snoozed: clear surfaced_at so the scheduler can re-queue it after 24h.
      // Keep user_action='snoozed' for history and calibration tracking.
      db.prepare(`
        UPDATE recall_events
        SET user_action = 'snoozed', acted_at = ?, surfaced_at = NULL
        WHERE id = ?
      `).run(now, eventId);
    } else {
      db.prepare(`
        UPDATE recall_events SET user_action = ?, acted_at = ? WHERE id = ?
      `).run(action, now, eventId);
    }

    return NextResponse.json({ ok: true, eventId, action });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
