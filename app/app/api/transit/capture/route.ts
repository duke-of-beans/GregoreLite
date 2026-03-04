/**
 * POST /api/transit/capture
 *
 * Thin server-side bridge for client-side Transit Map event capture.
 * Client components cannot import better-sqlite3 directly (server-only),
 * so they POST here and this route calls captureEvent().
 *
 * Always returns 200 — telemetry is non-critical and must never cause
 * client-side errors even if the DB is unavailable.
 */

import { NextResponse } from 'next/server';
import { captureEvent } from '@/lib/transit/capture';
import type { CaptureEventInput } from '@/lib/transit/types';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as CaptureEventInput;

    if (!body.conversation_id || !body.event_type || !body.category) {
      // Still return 200 — silently drop malformed telemetry
      console.warn('[transit/capture] malformed event payload:', body);
      return NextResponse.json({ ok: false, reason: 'malformed' });
    }

    captureEvent(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Never surface as 5xx — callers don't check this response anyway
    console.warn('[transit/capture] route error:', err);
    return NextResponse.json({ ok: false });
  }
}
