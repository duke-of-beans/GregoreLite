/**
 * Thread Tabs settings API route — Sprint S9-01
 *
 * GET: Load persisted tab layout from KERNL settings table.
 * PUT: Save current tab layout to KERNL settings table.
 *
 * Uses the 'thread_tabs' key in the settings table.
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

const SETTINGS_KEY = 'thread_tabs';

export async function GET() {
  try {
    const db = getDatabase();
    const row = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(SETTINGS_KEY) as { value: string } | undefined;

    if (!row) {
      return NextResponse.json({ data: null });
    }

    const parsed = JSON.parse(row.value);
    return NextResponse.json({ data: parsed });
  } catch (error) {
    console.error('[settings/thread-tabs] GET error:', error);
    return NextResponse.json({ data: null });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const db = getDatabase();

    db.prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(SETTINGS_KEY, JSON.stringify(body), Date.now());

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[settings/thread-tabs] PUT error:', error);
    return NextResponse.json({ error: 'Failed to save tab layout' }, { status: 500 });
  }
}
