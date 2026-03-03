/**
 * GET /api/morning-briefing — Sprint S9-05
 *
 * Generates a morning briefing from KERNL data.
 * Also checks/sets briefing_shown_date in settings to prevent repeat display.
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { generateBriefing } from '@/lib/morning-briefing/generator';

export async function GET() {
  try {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];

    // Check if already shown today
    const row = db
      .prepare(`SELECT value FROM settings WHERE key = 'briefing_shown_date'`)
      .get() as { value: string } | undefined;

    const alreadyShown = row?.value === today;

    const briefing = generateBriefing();

    return NextResponse.json({
      data: {
        briefing,
        alreadyShown,
      },
    });
  } catch (error) {
    console.error('[api/morning-briefing] Failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}

/** POST marks briefing as shown for today */
export async function POST() {
  try {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];

    db.prepare(
      `INSERT INTO settings (key, value) VALUES ('briefing_shown_date', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(today);

    return NextResponse.json({ data: { markedDate: today } });
  } catch (error) {
    console.error('[api/morning-briefing] POST failed:', error);
    return NextResponse.json(
      { error: 'Failed to mark briefing shown' },
      { status: 500 }
    );
  }
}