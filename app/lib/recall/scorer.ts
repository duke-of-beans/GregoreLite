/**
 * lib/recall/scorer.ts — Recall event relevance scoring + frequency calibration
 * Sprint 27.0
 */

import { getDatabase } from '@/lib/kernl/database';
import type {
  RecallEvent,
  RecallType,
  RecallUserHistory,
  RecallCalibration,
  RecallSchedulerSettings,
} from './types';

const MIN_SURFACE_SCORE = 0.40;
const CALIBRATION_WINDOW = 20;
const AUTO_REDUCE_DISMISSAL_THRESHOLD = 0.60;
const SUGGEST_INCREASE_APPRECIATION_THRESHOLD = 0.70;

// ── User history ──────────────────────────────────────────────────────────────

export function loadUserHistory(): RecallUserHistory {
  const db = getDatabase();

  type ActionRow = { type: RecallType; user_action: string };
  const rows = db.prepare<[number], ActionRow>(`
    SELECT type, user_action
    FROM recall_events
    WHERE user_action IS NOT NULL
    ORDER BY acted_at DESC
    LIMIT ?
  `).all(CALIBRATION_WINDOW) as ActionRow[];

  const history: RecallUserHistory = {
    totalActions: rows.length,
    appreciated: 0,
    dismissed: 0,
    snoozed: 0,
    byType: {},
  };

  for (const row of rows) {
    if (row.user_action === 'appreciated') history.appreciated++;
    else if (row.user_action === 'dismissed') history.dismissed++;
    else if (row.user_action === 'snoozed') history.snoozed++;

    const bucket = history.byType[row.type] ?? { appreciated: 0, dismissed: 0, snoozed: 0 };
    if (row.user_action === 'appreciated') bucket.appreciated++;
    else if (row.user_action === 'dismissed') bucket.dismissed++;
    else if (row.user_action === 'snoozed') bucket.snoozed++;
    history.byType[row.type] = bucket;
  }

  return history;
}

// ── Score a single event ──────────────────────────────────────────────────────

export function scoreRecallEvent(
  event: RecallEvent,
  history: RecallUserHistory,
  recentSurfacedTypes: RecallType[] = [],
): number {
  let score = event.relevance_score;

  // Recency penalty
  const ageHours = (Date.now() - event.created_at) / (1000 * 60 * 60);
  if (ageHours < 1) score *= 0.7;
  else if (ageHours < 4) score *= 0.85;

  // Diversity bonus
  if (!recentSurfacedTypes.includes(event.type) && recentSurfacedTypes.length > 0) {
    score = Math.min(1.0, score * 1.15);
  }

  // Per-type calibration
  const typeHistory = history.byType[event.type];
  if (typeHistory) {
    const typeTotal = typeHistory.appreciated + typeHistory.dismissed + typeHistory.snoozed;
    if (typeTotal >= 3) {
      const dr = typeHistory.dismissed / typeTotal;
      const ar = typeHistory.appreciated / typeTotal;
      if (dr > 0.6) score *= (1 - dr * 0.5);
      if (ar > 0.6) score = Math.min(1.0, score * (1 + ar * 0.3));
    }
  }

  // Global dismissal penalty
  if (history.totalActions >= 5) {
    const globalDr = history.dismissed / history.totalActions;
    if (globalDr > 0.5) score *= (1 - (globalDr - 0.5) * 0.4);
  }

  return Math.max(0, Math.min(1.0, score));
}

export function isEligibleToSurface(score: number): boolean {
  return score >= MIN_SURFACE_SCORE;
}

// ── Frequency calibration ─────────────────────────────────────────────────────

export function getRecallCalibration(history: RecallUserHistory): RecallCalibration {
  if (history.totalActions < 5) {
    return { dismissalRate: 0, appreciationRate: 0, autoReduced: false, suggestIncrease: false };
  }
  const dismissalRate    = history.dismissed    / history.totalActions;
  const appreciationRate = history.appreciated  / history.totalActions;
  return {
    dismissalRate,
    appreciationRate,
    autoReduced:     dismissalRate    > AUTO_REDUCE_DISMISSAL_THRESHOLD,
    suggestIncrease: appreciationRate > SUGGEST_INCREASE_APPRECIATION_THRESHOLD,
  };
}

export function applyCalibration(
  settings: RecallSchedulerSettings,
  calibration: RecallCalibration,
): RecallSchedulerSettings {
  if (!calibration.autoReduced) return settings;
  const steps = [1, 2, 4, 8];
  const idx = steps.indexOf(settings.detectionIntervalHours);
  if (idx === -1 || idx === steps.length - 1) return settings;
  const next = steps[idx + 1];
  if (next === undefined) return settings;
  return { ...settings, detectionIntervalHours: next };
}

// ── DB persistence ────────────────────────────────────────────────────────────

export function storeRecallEvents(events: RecallEvent[]): void {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO recall_events
      (id, type, source_type, source_id, source_name, message, context_data,
       relevance_score, surfaced_at, user_action, acted_at, created_at)
    VALUES
      (@id, @type, @source_type, @source_id, @source_name, @message, @context_data,
       @relevance_score, @surfaced_at, @user_action, @acted_at, @created_at)
  `);
  const insertMany = db.transaction((evts: RecallEvent[]) => {
    for (const e of evts) {
      insert.run({
        id: e.id, type: e.type, source_type: e.source_type,
        source_id: e.source_id ?? null, source_name: e.source_name,
        message: e.message, context_data: e.context_data ?? null,
        relevance_score: e.relevance_score, surfaced_at: e.surfaced_at ?? null,
        user_action: e.user_action ?? null, acted_at: e.acted_at ?? null,
        created_at: e.created_at,
      });
    }
  });
  insertMany(events);
}

export function surfaceNextEvent(maxPerDay: number): RecallEvent | null {
  const db = getDatabase();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  type CountRow = { count: number };
  const { count: todayCount } = db.prepare<[number], CountRow>(`
    SELECT COUNT(*) AS count FROM recall_events
    WHERE surfaced_at >= ? AND surfaced_at IS NOT NULL
  `).get(todayStart.getTime()) as CountRow;

  if (todayCount >= maxPerDay) return null;

  type EventRow = {
    id: string; type: string; source_type: string; source_id: string | null;
    source_name: string; message: string; context_data: string | null;
    relevance_score: number; created_at: number;
  };

  const row = db.prepare<[], EventRow>(`
    SELECT id, type, source_type, source_id, source_name, message,
           context_data, relevance_score, created_at
    FROM recall_events
    WHERE surfaced_at IS NULL AND user_action IS NULL
    ORDER BY relevance_score DESC
    LIMIT 1
  `).get() as EventRow | undefined;

  if (!row) return null;

  const now = Date.now();
  db.prepare(`UPDATE recall_events SET surfaced_at = ? WHERE id = ?`).run(now, row.id);

  return {
    id: row.id,
    type: row.type as RecallEvent['type'],
    source_type: row.source_type as RecallEvent['source_type'],
    source_name: row.source_name,
    message: row.message,
    relevance_score: row.relevance_score,
    surfaced_at: now,
    created_at: row.created_at,
    ...(row.source_id    != null ? { source_id:    row.source_id              } : {}),
    ...(row.context_data != null ? { context_data: row.context_data           } : {}),
  };
}
