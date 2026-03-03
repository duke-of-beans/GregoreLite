/**
 * Morning Briefing Generator — Sprint S9-05
 *
 * Aggregates yesterday's data from KERNL tables to build a BriefingData object.
 * Called by the API route on cold start or manual re-open.
 */

import { getDatabase } from '@/lib/kernl/database';
import type { BriefingData, JobSummary } from './types';

function yesterdayRange(): { start: number; end: number } {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayMidnight = todayMidnight - 86_400_000;
  return { start: yesterdayMidnight, end: todayMidnight };
}

function weekStart(): number {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  return monday.getTime();
}

export function generateBriefing(): BriefingData {
  const db = getDatabase();
  const { start, end } = yesterdayRange();
  const yesterday = new Date(start).toISOString().split('T')[0] ?? '';

  // Section 1: Jobs completed/failed yesterday
  const completedRows = db
    .prepare(
      `SELECT title, cost_usd FROM manifests
       WHERE status = 'completed' AND updated_at >= ? AND updated_at < ?
       ORDER BY updated_at DESC`
    )
    .all(start, end) as { title: string | null; cost_usd: number }[];

  const completedJobs: JobSummary[] = completedRows.map((r) => ({
    title: r.title ?? 'Untitled job',
    costUsd: r.cost_usd,
  }));

  const failedRows = db
    .prepare(
      `SELECT title, result_report FROM manifests
       WHERE status IN ('failed', 'interrupted') AND updated_at >= ? AND updated_at < ?
       ORDER BY updated_at DESC`
    )
    .all(start, end) as { title: string | null; result_report: string | null }[];

  const failedJobs: JobSummary[] = failedRows.map((r) => {
    let failureMode: string | undefined;
    if (r.result_report) {
      try {
        const report = JSON.parse(r.result_report) as { errors?: { message: string }[] };
        failureMode = report.errors?.[0]?.message;
      } catch { /* ignore */ }
    }
    return {
      title: r.title ?? 'Untitled job',
      costUsd: 0,
      ...(failureMode ? { failureMode } : {}),
    };
  });

  // Section 2: Decisions logged yesterday
  const decisionRows = db
    .prepare(
      `SELECT title FROM decisions
       WHERE created_at >= ? AND created_at < ?
       ORDER BY created_at DESC LIMIT 3`
    )
    .all(start, end) as { title: string }[];

  const decisionsCountRow = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM decisions
       WHERE created_at >= ? AND created_at < ?`
    )
    .get(start, end) as { cnt: number };

  // Section 3: Ghost surfaces
  const ghostRow = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM ghost_indexed_items
       WHERE indexed_at >= ? AND indexed_at < ?`
    )
    .get(start, end) as { cnt: number } | undefined;

  // Section 4: Budget
  const yesterdaySpendRow = db
    .prepare(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) as total FROM session_costs
       WHERE started_at >= ? AND started_at < ?`
    )
    .get(start, end) as { total: number };

  const weekTotalRow = db
    .prepare(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) as total FROM session_costs
       WHERE started_at >= ?`
    )
    .get(weekStart()) as { total: number };

  // Daily cap from budget_config
  let dailyCapUsd = 10.0; // default
  try {
    const capRow = db
      .prepare(`SELECT value FROM settings WHERE key = 'daily_cost_cap'`)
      .get() as { value: string } | undefined;
    if (capRow) dailyCapUsd = parseFloat(capRow.value) || 10.0;
  } catch { /* use default */ }

  // Section 5: EoS delta
  const eosRows = db
    .prepare(
      `SELECT health_score FROM eos_reports ORDER BY scanned_at DESC LIMIT 2`
    )
    .all() as { health_score: number }[];

  const eosCurrent = eosRows[0]?.health_score ?? null;
  const eosPrevious = eosRows[1]?.health_score ?? null;

  // Section 6: PRs pending
  const prRow = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM manifests
       WHERE ci_passed = 1 AND status = 'completed' AND pr_number IS NOT NULL`
    )
    .get() as { cnt: number };

  return {
    forDate: yesterday,
    generatedAt: Date.now(),
    completedJobs,
    failedJobs,
    decisionsCount: decisionsCountRow.cnt,
    recentDecisionTitles: decisionRows.map((r) => r.title),
    ghostItemsIndexed: ghostRow?.cnt ?? 0,
    yesterdaySpendUsd: yesterdaySpendRow.total,
    dailyCapUsd,
    weekTotalUsd: weekTotalRow.total,
    eosCurrent,
    eosPrevious,
    prsPending: prRow.cnt,
  };
}