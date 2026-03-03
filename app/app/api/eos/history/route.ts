/**
 * EoS History API — Sprint S9-09
 *
 * GET /api/eos/history?projectId=<id>&limit=<n>
 *
 * Returns last N eos_reports rows for the given project,
 * ordered by created_at DESC. Default limit: 50.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface EoSReportRow {
  id: string;
  project_id: string;
  health_score: number;
  issues_json: string;
  files_scanned: number;
  duration_ms: number;
  suppressed: string;
  scan_mode: string;
  created_at: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    if (!projectId) {
      return NextResponse.json({ data: [] });
    }

    const db = getDatabase();

    const rows = db.prepare(`
      SELECT id, project_id, health_score, issues_json, files_scanned,
             duration_ms, suppressed, scan_mode, created_at
      FROM eos_reports
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(projectId, limit) as EoSReportRow[];

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[eos-history] Query failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch EoS history' },
      { status: 500 }
    );
  }
}
