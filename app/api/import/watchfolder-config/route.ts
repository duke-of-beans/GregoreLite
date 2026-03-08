/**
 * GET/POST /api/import/watchfolder-config — Sprint 34.0 / EPIC-81
 *
 * GET  → { path, processingPath, reminderDays }
 * POST → { path?, reminderDays? } — updates KERNL settings
 */

import { NextResponse } from 'next/server';
import {
  getWatchfolderPath,
  setWatchfolderPath,
  getProcessedDir,
  ensureWatchfolderExists,
} from '@/lib/import/watchfolder-config';
import { setSetting } from '@/lib/kernl/settings-store';
import { getReminderDays } from '@/lib/import/sync-reminder';

export function GET() {
  const watchfolderPath = getWatchfolderPath();
  return NextResponse.json({
    path: watchfolderPath,
    processingPath: getProcessedDir(watchfolderPath),
    reminderDays: getReminderDays(),
  });
}

export async function POST(req: Request) {
  const body = await req.json() as { path?: string; reminderDays?: number };

  if (body.path) {
    setWatchfolderPath(body.path);
    try { ensureWatchfolderExists(body.path); } catch { /* best effort */ }
  }

  if (typeof body.reminderDays === 'number' && body.reminderDays > 0) {
    setSetting('import_reminder_days', String(body.reminderDays));
  }

  return NextResponse.json({ ok: true });
}
