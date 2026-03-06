/**
 * lib/recall/detector.ts — Ambient Memory: heuristic detection pipeline
 * Sprint 27.0
 *
 * runRecallDetection() orchestrates 5 strategy functions, each of which
 * returns 0-N RecallEvents based on timestamp/frequency analysis.
 * No LLM calls — all heuristic, server-side Node.js only.
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '@/lib/kernl/database';
import { RECALL } from '@/lib/voice/copy-templates';
import type { RecallEvent, RecallType, RecallSchedulerSettings } from './types';
import { DEFAULT_RECALL_SETTINGS } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const THIRTY_DAYS_MS   = 30 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const ONE_WEEK_MS      =  7 * 24 * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function nowMs(): number {
  return Date.now();
}

function monthName(epochMs: number): string {
  return new Date(epochMs).toLocaleString('en-US', { month: 'long' });
}

function daysAgo(epochMs: number): number {
  return Math.floor((nowMs() - epochMs) / (24 * 60 * 60 * 1000));
}

function makeEvent(
  type: RecallType,
  source_type: RecallEvent['source_type'],
  source_name: string,
  message: string,
  relevance_score: number,
  extras: Partial<Pick<RecallEvent, 'source_id' | 'context_data'>> = {},
): RecallEvent {
  return {
    id: randomUUID(),
    type,
    source_type,
    source_name,
    message,
    relevance_score,
    created_at: nowMs(),
    ...extras,
  };
}

// ── Strategy A: File Revisit ──────────────────────────────────────────────────

function detectFileRevisits(settings: RecallSchedulerSettings): RecallEvent[] {
  if (!settings.enabledTypes.includes('file_revisit')) return [];

  const db = getDatabase();
  const cutoff = nowMs() - THIRTY_DAYS_MS;

  type ChunkRow = {
    source_id: string;
    chunk_count: number;
    avg_score: number | null;
    last_indexed: number;
    first_indexed: number;
  };

  const rows = db.prepare<[number], ChunkRow>(`
    SELECT
      source_id,
      COUNT(*)                    AS chunk_count,
      AVG(CAST(metadata AS REAL)) AS avg_score,
      MAX(indexed_at)             AS last_indexed,
      MIN(indexed_at)             AS first_indexed
    FROM content_chunks
    WHERE source_type = 'file'
      AND indexed_at < ?
    GROUP BY source_id
    HAVING COUNT(*) >= 3
    ORDER BY MAX(indexed_at) DESC
    LIMIT 20
  `).all(cutoff) as ChunkRow[];

  const events: RecallEvent[] = [];

  for (const row of rows) {
    const filename = row.source_id.split(/[\\/]/).pop() ?? row.source_id;
    const month = monthName(row.last_indexed);
    const days = daysAgo(row.last_indexed);

    let message: string;
    let score = 0.6;

    if (row.chunk_count >= 10) {
      message = RECALL.file_revisit_intensive(filename, month);
      score = 0.75;
    } else {
      message = RECALL.file_revisit_forgotten(filename, days);
      score = days > 60 ? 0.65 : 0.55;
    }

    events.push(makeEvent(
      'file_revisit',
      'file',
      filename,
      message,
      score,
      {
        source_id: row.source_id,
        context_data: JSON.stringify({ chunkCount: row.chunk_count, lastIndexed: row.last_indexed, month }),
      },
    ));
  }

  return events.slice(0, 3);
}

// ── Strategy B: Conversation Callback ────────────────────────────────────────

function detectConversationCallbacks(settings: RecallSchedulerSettings): RecallEvent[] {
  if (!settings.enabledTypes.includes('conversation_callback')) return [];

  const db = getDatabase();
  const cutoff = nowMs() - FOURTEEN_DAYS_MS;

  type ThreadRow = {
    id: string;
    title: string;
    msg_count: number;
    created_at: number;
    decision_count: number;
  };

  const rows = db.prepare<[number], ThreadRow>(`
    SELECT
      t.id,
      t.title,
      COUNT(m.id)                                                    AS msg_count,
      t.created_at,
      (SELECT COUNT(*) FROM decisions d WHERE d.thread_id = t.id)   AS decision_count
    FROM threads t
    JOIN messages m ON m.thread_id = t.id
    WHERE t.created_at < ?
    GROUP BY t.id
    HAVING COUNT(m.id) > 10
    ORDER BY decision_count DESC, msg_count DESC
    LIMIT 10
  `).all(cutoff) as ThreadRow[];

  const events: RecallEvent[] = [];

  for (const row of rows) {
    const timeAgo = `${daysAgo(row.created_at)} days ago`;
    const score = row.decision_count > 0 ? 0.70 : 0.50;

    events.push(makeEvent(
      'conversation_callback',
      'conversation',
      row.title,
      RECALL.conversation_decision(row.title, timeAgo),
      score,
      {
        source_id: row.id,
        context_data: JSON.stringify({
          messageCount: row.msg_count,
          decisionCount: row.decision_count,
          createdAt: row.created_at,
        }),
      },
    ));
  }

  return events.slice(0, 2);
}

// ── Strategy C: Project Milestone ─────────────────────────────────────────────

function detectProjectMilestones(settings: RecallSchedulerSettings): RecallEvent[] {
  if (!settings.enabledTypes.includes('project_milestone')) return [];

  const db = getDatabase();

  type ProjectRow = {
    id: string;
    name: string;
    registered_at: number;
    last_scanned_at: number | null;
    scan_data: string | null;
  };

  const rows = db.prepare<[], ProjectRow>(`
    SELECT id, name, registered_at, last_scanned_at, scan_data
    FROM portfolio_projects
    WHERE status = 'active'
    ORDER BY last_scanned_at DESC
    LIMIT 10
  `).all() as ProjectRow[];

  const events: RecallEvent[] = [];

  for (const row of rows) {
    if (!row.last_scanned_at) continue;

    const daysSinceRegistered = daysAgo(row.registered_at);
    const daysSinceLastScan   = daysAgo(row.last_scanned_at);

    if (daysSinceLastScan > 7 && daysSinceLastScan < 30) {
      events.push(makeEvent(
        'project_milestone',
        'project',
        row.name,
        RECALL.project_reactivated(row.name, daysSinceLastScan),
        0.65,
        {
          source_id: row.id,
          context_data: JSON.stringify({ daysSinceLastScan, daysSinceRegistered }),
        },
      ));
    }

    if (row.scan_data) {
      try {
        const sd = JSON.parse(row.scan_data) as Record<string, unknown>;
        const version = sd.version as string | undefined;
        if (version && version !== '0.0.0' && version !== '0.1.0') {
          const sprintProxy = Math.max(1, Math.floor(daysSinceRegistered / 7));
          events.push(makeEvent(
            'project_milestone',
            'project',
            row.name,
            RECALL.project_version(row.name, version, sprintProxy),
            0.60,
            {
              source_id: row.id,
              context_data: JSON.stringify({ version, sprintProxy, daysSinceRegistered }),
            },
          ));
        }
      } catch { /* scan_data not valid JSON */ }
    }
  }

  return events.slice(0, 2);
}

// ── Strategy D: Pattern Insight ───────────────────────────────────────────────

function detectPatternInsights(settings: RecallSchedulerSettings): RecallEvent[] {
  if (!settings.enabledTypes.includes('pattern_insight')) return [];

  const db = getDatabase();
  const oneWeekAgo = nowMs() - ONE_WEEK_MS;
  const events: RecallEvent[] = [];

  type ProjectFreqRow = { project_id: string | null; count: number };
  const freqRows = db.prepare<[number], ProjectFreqRow>(`
    SELECT project_id, COUNT(*) AS count
    FROM threads
    WHERE created_at > ?
    GROUP BY project_id
    ORDER BY count DESC
    LIMIT 5
  `).all(oneWeekAgo) as ProjectFreqRow[];

  for (const row of freqRows) {
    if (!row.project_id || row.count < 4) continue;
    const proj = db.prepare<[string], { name: string }>(
      `SELECT name FROM portfolio_projects WHERE id = ? LIMIT 1`,
    ).get(row.project_id) as { name: string } | undefined;
    if (!proj) continue;

    events.push(makeEvent(
      'pattern_insight',
      'project',
      proj.name,
      RECALL.pattern_focus(proj.name),
      0.60,
      {
        source_id: row.project_id,
        context_data: JSON.stringify({ conversationsThisWeek: row.count }),
      },
    ));
  }

  type TitleRow = { title: string; count: number };
  const titleRows = db.prepare<[number], TitleRow>(`
    SELECT title, COUNT(*) AS count
    FROM threads
    WHERE created_at > ?
    GROUP BY title
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 3
  `).all(oneWeekAgo) as TitleRow[];

  for (const row of titleRows) {
    if (row.count < 3) continue;
    events.push(makeEvent(
      'pattern_insight',
      'conversation',
      row.title,
      RECALL.pattern_topic(row.title, row.count),
      0.55,
      { context_data: JSON.stringify({ occurrences: row.count }) },
    ));
  }

  return events.slice(0, 2);
}

// ── Strategy E: Personal Moment ───────────────────────────────────────────────

function detectPersonalMoments(settings: RecallSchedulerSettings): RecallEvent[] {
  if (!settings.enabledTypes.includes('personal_moment')) return [];

  const db = getDatabase();
  const events: RecallEvent[] = [];

  type ProjectRow = { id: string; name: string; registered_at: number };
  const projects = db.prepare<[], ProjectRow>(
    `SELECT id, name, registered_at FROM portfolio_projects WHERE status = 'active'`,
  ).all() as ProjectRow[];

  for (const proj of projects) {
    const daysSince = daysAgo(proj.registered_at);
    const isWeeklyAnniversary = daysSince > 0 && daysSince % 7 === 0 && daysSince <= 28;
    const isMonthly = daysSince > 0 && daysSince % 30 === 0;

    if (isWeeklyAnniversary || isMonthly) {
      const duration = isMonthly
        ? `${Math.floor(daysSince / 30)} month${daysSince >= 60 ? 's' : ''}`
        : `${Math.floor(daysSince / 7)} week${daysSince >= 14 ? 's' : ''}`;
      const sprintProxy = Math.max(1, Math.floor(daysSince / 7));

      events.push(makeEvent(
        'personal_moment',
        'project',
        proj.name,
        RECALL.moment_anniversary(proj.name, duration, sprintProxy),
        0.70,
        {
          source_id: proj.id,
          context_data: JSON.stringify({ daysSince, duration, sprintProxy }),
        },
      ));
    }
  }

  type ActiveCount = { count: number };
  const { count: activeCount } = db.prepare<[], ActiveCount>(
    `SELECT COUNT(*) AS count FROM portfolio_projects WHERE status = 'active'`,
  ).get() as ActiveCount;

  if (activeCount >= 5) {
    const existing = db.prepare<[string], { id: string }>(
      `SELECT id FROM recall_events WHERE type = 'personal_moment' AND source_name = ? LIMIT 1`,
    ).get('five_active_projects') as { id: string } | undefined;

    if (!existing) {
      events.push(makeEvent(
        'personal_moment',
        'custom',
        'five_active_projects',
        RECALL.moment_first(`${activeCount} projects active simultaneously`),
        0.65,
        { context_data: JSON.stringify({ activeCount }) },
      ));
    }
  }

  return events.slice(0, 2);
}

// ── Main detection run ────────────────────────────────────────────────────────

export async function runRecallDetection(
  settings: RecallSchedulerSettings = DEFAULT_RECALL_SETTINGS,
): Promise<RecallEvent[]> {
  const results: RecallEvent[] = [
    ...detectFileRevisits(settings),
    ...detectConversationCallbacks(settings),
    ...detectProjectMilestones(settings),
    ...detectPatternInsights(settings),
    ...detectPersonalMoments(settings),
  ];

  // Deduplicate: skip if same type+source_id was detected this week
  const db = getDatabase();
  const recentCutoff = nowMs() - ONE_WEEK_MS;
  const deduped: RecallEvent[] = [];

  for (const event of results) {
    if (!event.source_id) { deduped.push(event); continue; }
    type ExRow = { id: string };
    const existing = db.prepare<[string, string, number], ExRow>(
      `SELECT id FROM recall_events WHERE type = ? AND source_id = ? AND created_at > ? LIMIT 1`,
    ).get(event.type, event.source_id, recentCutoff) as ExRow | undefined;
    if (!existing) deduped.push(event);
  }

  return deduped;
}
