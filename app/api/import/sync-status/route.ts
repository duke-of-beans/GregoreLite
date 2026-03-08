/**
 * GET /api/import/sync-status — Sprint 34.0 / EPIC-81
 *
 * Returns current memory sync status for the StatusBar MEM chip.
 * Polled every 5 minutes by StatusBar.tsx.
 *
 * Response: { daysSinceSync: number | null, shouldShowReminder: boolean, reminderUrl: string }
 */

import { NextResponse } from 'next/server';
import { getDaysSinceSync, shouldShowReminder, getSyncReminderUrl } from '@/lib/import/sync-reminder';

export function GET() {
  try {
    return NextResponse.json({
      daysSinceSync: getDaysSinceSync(),
      shouldShowReminder: shouldShowReminder(),
      reminderUrl: getSyncReminderUrl(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
