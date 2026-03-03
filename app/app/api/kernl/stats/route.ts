/**
 * KERNL Stats API — Sprint S9-14 / S9-18
 *
 * GET /api/kernl/stats → full DB health stats for Inspector KERNL tab
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import * as fs from 'fs';

interface StatsRow { count: number }

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

    // Total tables (sqlite_master, excluding internal/virtual shadow tables)
    let totalTables = 0;
    try {
      const row = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get() as StatsRow;
      totalTables = row.count;
    } catch { /* silent */ }

    // Total threads
    const threadRow = db.prepare('SELECT COUNT(*) as count FROM threads').get() as StatsRow;

    // Total messages
    let totalMessages = 0;
    try {
      const msgRow = db.prepare('SELECT COUNT(*) as count FROM messages').get() as StatsRow;
      totalMessages = msgRow.count;
    } catch { /* silent */ }

    // Total decisions
    let totalDecisions = 0;
    try {
      const decRow = db.prepare('SELECT COUNT(*) as count FROM decisions').get() as StatsRow;
      totalDecisions = decRow.count;
    } catch { /* silent */ }

    // Total chunks indexed (content_chunks)
    let totalChunks = 0;
    try {
      const chunkRow = db.prepare('SELECT COUNT(*) as count FROM content_chunks').get() as StatsRow;
      totalChunks = chunkRow.count;
    } catch { /* content_chunks table may not exist */ }

    // Last indexer run (settings key or fallback to content_chunks MAX)
    let lastIndexerRun: number | null = null;
    try {
      const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'last_indexer_run'").get() as { value: string } | undefined;
      if (settingsRow) {
        lastIndexerRun = parseInt(settingsRow.value, 10);
      } else {
        const fallback = db.prepare('SELECT MAX(indexed_at) as ts FROM content_chunks').get() as { ts: number | null } | undefined;
        if (fallback?.ts) lastIndexerRun = fallback.ts;
      }
    } catch { /* silent */ }

    // Last backup timestamp (settings key, fallback to budget_config)
    let lastBackup: number | null = null;
    try {
      const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'last_backup_at'").get() as { value: string } | undefined;
      if (settingsRow) {
        lastBackup = parseInt(settingsRow.value, 10);
      } else {
        const fallback = db.prepare("SELECT value FROM budget_config WHERE key = 'last_backup_at'").get() as { value: string } | undefined;
        if (fallback) lastBackup = parseInt(fallback.value, 10);
      }
    } catch { /* silent */ }

    return NextResponse.json({
      data: {
        dbSizeBytes,
        dbSizeMB: +(dbSizeBytes / 1024 / 1024).toFixed(2),
        totalTables,
        totalThreads: threadRow.count,
        totalMessages,
        totalDecisions,
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