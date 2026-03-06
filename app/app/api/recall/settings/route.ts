/**
 * GET+POST /api/recall/settings — read and write recall scheduler settings
 * Sprint 27.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import type { RecallSchedulerSettings } from '@/lib/recall/types';
import { DEFAULT_RECALL_SETTINGS } from '@/lib/recall/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDatabase();
    const row = db
      .prepare(`SELECT value FROM kernl_settings WHERE key = 'recall_settings' LIMIT 1`)
      .get() as { value: string } | undefined;

    const settings: RecallSchedulerSettings = row?.value
      ? { ...DEFAULT_RECALL_SETTINGS, ...(JSON.parse(row.value) as Partial<RecallSchedulerSettings>) }
      : DEFAULT_RECALL_SETTINGS;

    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/recall/settings GET] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as Partial<RecallSchedulerSettings>;
    const settings: RecallSchedulerSettings = { ...DEFAULT_RECALL_SETTINGS, ...body };

    const db = getDatabase();
    db.prepare(`
      INSERT INTO kernl_settings (key, value, updated_at)
      VALUES ('recall_settings', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(JSON.stringify(settings), Date.now());

    // Scheduler reads settings from DB on each detection run — no restart needed.

    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/recall/settings POST] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
