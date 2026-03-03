/**
 * KERNL Stats API — Sprint S9-14
 *
 * GET /api/kernl/stats → DB file size, total threads, total chunks, last indexer run, last backup
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import * as fs from 'fs';

interface StatsRow { count: number }
interface TimestampRow { ts: number | null }

export async function GET() {
  try {
    const db = getDatabase();

    // DB file size
    let dbSizeBytes = 0;
    try {
      const dbPath = (db as unknown as { name: string }).name;
      if (dbPath && fs.existsSync(dbPath)) {
        dbSizeBytes = fs.statSync(dbPath).size;
      }
    } catch { /* silent */ }

    // Total threads
    const threadRow = db.prepare('SELECT COUNT(*) as count FROM threads').get() as StatsRow;

    // Total chunks indexed
    let totalChunks = 0;
    try {
      const chunkRow = db.prepare('SELECT COUNT(*) as count FROM chunks').get() as StatsRow;
      totalChunks = chunkRow.count;
    } catch { /* chunks table may not exist */ }

    // Last indexer run
    let lastIndexerRun: number | null = null;
    try {
      const indexRow = db.prepare('SELECT MAX(indexed_at) as ts FROM chunks').get() as TimestampRow;
      lastIndexerRun = indexRow.ts;
    } catch { /* silent */ }

    // Last backup timestamp (from budget_config or a backup_log if exists)
    let lastBackup: number | null = null;
    try {
      const backupRow = db.prepare("SELECT value FROM budget_config WHERE key = 'last_backup_at'").get() as { value: string } | undefined;
      if (backupRow) lastBackup = parseInt(backupRow.value, 10);
    } catch { /* silent */ }

    return NextResponse.json({
      data: {
        dbSizeBytes,
        dbSizeMB: +(dbSizeBytes / 1024 / 1024).toFixed(2),
        totalThreads: threadRow.count,
        totalChunks,
        lastIndexerRun,
        lastBackup,
      },
    });
  } catch (err) {
    console.error('[kernl/stats] GET failed:', err);
    return NextResponse.json({ error: 'Failed to load KERNL stats' }, { status: 500 });
  }
}