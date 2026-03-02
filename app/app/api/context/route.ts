/**
 * GET /api/context
 *
 * Aggregates KERNL state for the ContextPanel UI.
 * Runs server-side so better-sqlite3 is accessible.
 * Returns ContextPanelState — polled every 30s by context-provider.ts.
 */

import { NextResponse } from 'next/server';
import {
  getActiveProject,
  listDecisions,
  listThreads,
  getLatestAegisSignal,
} from '@/lib/kernl';
import { getDatabase } from '@/lib/kernl/database';
import type { ContextPanelState, EoSHealthSummary, EoSIssueSummary } from '@/lib/context/types';
import type { HealthIssue } from '@/lib/eos/types';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    // Active project — most recently updated active project
    const activeProject = getActiveProject();

    // Session number = total thread count in KERNL
    const threads = listThreads(1000);
    const sessionNumber = threads.length;

    // Session duration = ms elapsed since most recent thread's created_at
    const latestThread = threads[0] ?? null;
    const sessionDurationMs = latestThread
      ? Date.now() - latestThread.created_at
      : 0;

    // Recent decisions — last 5 across all threads
    const recentDecisions = listDecisions({ limit: 5 });

    // KERNL index status — always 'indexed' until background indexing lands (Phase 3)
    const kernlStatus: ContextPanelState['kernlStatus'] = 'indexed';

    // AEGIS profile — latest signal row, or IDLE if none
    const latestSignal = getLatestAegisSignal();
    const aegisProfile = latestSignal?.profile ?? 'IDLE';

    // AEGIS online state — stubbed false until Sprint 2C wires getAEGISStatus()
    const aegisOnline = false;

    // EoS summary — latest scan report for the active project
    let eosSummary: EoSHealthSummary | null = null;
    if (activeProject) {
      const db = getDatabase();
      const reportRow = db
        .prepare(
          `SELECT health_score, issues_json, scan_mode, created_at
           FROM eos_reports WHERE project_id = ?
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get(activeProject.id) as {
          health_score: number;
          issues_json: string;
          scan_mode: string;
          created_at: string;
        } | null;

      if (reportRow) {
        let issues: HealthIssue[] = [];
        try {
          issues = JSON.parse(reportRow.issues_json) as HealthIssue[];
        } catch {
          // malformed JSON — show empty issues
        }
        const score = reportRow.health_score;
        const grade: EoSHealthSummary['grade'] =
          score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'attention' : 'critical';

        eosSummary = {
          healthScore: score,
          grade,
          issues: issues.map(
            (i): EoSIssueSummary => ({
              ruleId: i.ruleId,
              severity: i.severity,
              message: i.message,
              file: i.file,
              ...(i.line !== undefined && { line: i.line }),
            }),
          ),
          lastScannedAt: reportRow.created_at,
        };
      }
    }

    const state: ContextPanelState = {
      activeProject: activeProject
        ? {
            id: activeProject.id,
            name: activeProject.name,
            path: activeProject.path ?? null,
          }
        : null,
      sessionNumber,
      sessionDurationMs,
      recentDecisions: recentDecisions.map((d) => ({
        id: d.id,
        title: d.title,
        created_at: d.created_at,
      })),
      kernlStatus,
      aegisProfile,
      aegisOnline,
      pendingSuggestions: 0,
      eosSummary,
    };

    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error('[api/context] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load context' },
      { status: 500 }
    );
  }
}
