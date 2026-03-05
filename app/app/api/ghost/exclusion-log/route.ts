/**
 * Ghost Privacy — Exclusion Audit Log API
 * Sprint 6G
 *
 * GET /api/ghost/exclusion-log — last 100 exclusion log entries, newest first
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { safeHandler } from '@/lib/api/utils';

interface ExclusionLogRow {
  id: string;
  source_type: string;
  source_path: string;
  layer: number;
  reason: string;
  pattern: string | null;
  logged_at: number;
}

export const GET = safeHandler(async () => {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT id, source_type, source_path, layer, reason, pattern, logged_at
       FROM ghost_exclusion_log
       ORDER BY logged_at DESC
       LIMIT 100`
    )
    .all() as ExclusionLogRow[];

  return NextResponse.json({ entries: rows });
});
