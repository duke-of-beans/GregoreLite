/**
 * GET /api/agent-sdk/jobs/[id]/output
 *
 * Returns the last 500 lines of session output.
 *
 * For active sessions: reads from the in-memory ring buffer via the
 * SessionLogger registry added in Sprint 7F.
 *
 * For completed sessions with a log file: reads from the temp file on disk.
 *
 * Returns { data: { lines: string[]; source: 'ring_buffer' | 'log_file' | 'none' } }
 *
 * Sprint 7F — Job Queue UI
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getLogger } from '@/lib/agent-sdk/session-logger';
import { readJobState } from '@/lib/agent-sdk/query';

const MAX_LINES = 500;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 1. Try the in-memory ring buffer first (active session)
    const logger = getLogger(id);
    if (logger) {
      const lines = logger.getLines(MAX_LINES);
      return NextResponse.json({ data: { lines, source: 'ring_buffer' } });
    }

    // 2. Try the temp log file (session >5 min or already finished)
    const state = readJobState(id);
    if (state?.log_path) {
      try {
        const raw = fs.readFileSync(state.log_path, 'utf8');
        const allLines = raw.split('\n').filter((l) => l.length > 0);
        const lines = allLines.slice(-MAX_LINES);
        return NextResponse.json({ data: { lines, source: 'log_file' } });
      } catch {
        // File may have been cleaned up — fall through to 'none'
      }
    }

    return NextResponse.json({ data: { lines: [], source: 'none' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
