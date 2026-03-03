/**
 * Settings API — Sprint S9-13
 *
 * GET  /api/settings → all budget_config rows as { [key]: value }
 * PATCH /api/settings → update one or more budget_config entries
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface BudgetConfigRow {
  key: string;
  value: string;
  updated_at: number;
}

export async function GET() {
  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM budget_config').all() as BudgetConfigRow[];
    const config: Record<string, string> = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return NextResponse.json({ data: config });
  } catch (err) {
    console.error('[settings] GET failed:', err);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, string>;
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO budget_config (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    const now = Date.now();
    for (const [key, value] of Object.entries(body)) {
      stmt.run(key, String(value), now);
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error('[settings] PATCH failed:', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}