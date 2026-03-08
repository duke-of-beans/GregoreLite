/**
 * lib/synthesis/orchestrator.ts — Sprint 28.0 Ceremonial Onboarding
 *
 * IndexingOrchestrator: the ceremony conductor.
 * Manages the full lifecycle of source indexing and synthesis generation.
 *
 * Also owns behavioural telemetry (no content, no paths — strictly counts/timings).
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '@/lib/kernl/database';
import { generateSourceSynthesis } from './generator';
import { generateMasterSynthesis, loadMasterSynthesis } from './master';
import type {
  IndexingSource,
  IndexingSourceType,
  IndexingStatus,
  MasterSynthesis,
  SynthesisProgress,
} from './types';

// ── DB row → domain type ──────────────────────────────────────────────────────

type SourceRow = {
  id: string;
  type: string;
  label: string;
  status: string;
  path_or_config: string | null;
  indexed_count: number;
  total_count: number | null;
  started_at: number | null;
  completed_at: number | null;
  synthesis_text: string | null;
  combination_text: string | null;
  created_at: number;
};

function rowToSource(row: SourceRow): IndexingSource {
  return {
    id: row.id,
    type: row.type as IndexingSourceType,
    label: row.label,
    status: row.status as IndexingStatus,
    path_or_config: row.path_or_config,
    indexed_count: row.indexed_count,
    total_count: row.total_count,
    started_at: row.started_at,
    completed_at: row.completed_at,
    synthesis_text: row.synthesis_text,
    combination_text: row.combination_text,
    created_at: row.created_at,
  };
}

// ── Default labels per source type ───────────────────────────────────────────

const DEFAULT_LABELS: Record<IndexingSourceType, string> = {
  local_files:   'Local Files',
  projects:      'Projects',
  email:         'Email',
  conversations: 'Conversations',
  calendar:      'Calendar',
  notes:         'Notes',
  custom:        'Custom Source',
};

// ── Telemetry session state (in-memory, reset per session) ────────────────────

interface TelemetrySession {
  id: string;
  sourcesAddedOrder: IndexingSourceType[];
  sourcesSkipped: IndexingSourceType[];
  perSourceReadTimeMs: Record<string, number>;
  completedMaster: boolean;
  exitedEarly: boolean;
  nudgeConversions: IndexingSourceType[];
  stepStartTimes: Map<string, number>;
}

let _telemetry: TelemetrySession | null = null;

function getTelemetry(): TelemetrySession {
  if (!_telemetry) {
    _telemetry = {
      id: randomUUID(),
      sourcesAddedOrder: [],
      sourcesSkipped: [],
      perSourceReadTimeMs: {},
      completedMaster: false,
      exitedEarly: false,
      nudgeConversions: [],
      stepStartTimes: new Map(),
    };
  }
  return _telemetry;
}

function flushTelemetry(): void {
  const t = getTelemetry();
  const db = getDatabase();
  try {
    db.prepare(`
      INSERT INTO synthesis_telemetry
        (id, sources_added_order, sources_skipped, per_source_read_time_ms,
         completed_master, exited_early, nudge_conversions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      t.id,
      JSON.stringify(t.sourcesAddedOrder),
      JSON.stringify(t.sourcesSkipped),
      JSON.stringify(t.perSourceReadTimeMs),
      t.completedMaster ? 1 : 0,
      t.exitedEarly ? 1 : 0,
      JSON.stringify(t.nudgeConversions),
      Date.now(),
    );
  } catch (err) {
    console.warn('[synthesis/orchestrator] Telemetry flush failed:', err);
  }
  _telemetry = null; // reset for next session
}

// ── IndexingOrchestrator ──────────────────────────────────────────────────────

export class IndexingOrchestrator {
  // ── Source registration ─────────────────────────────────────────────────

  /**
   * Register a new source and begin indexing it.
   * Returns the created IndexingSource.
   */
  addSource(
    type: IndexingSourceType,
    pathOrConfig: string | null = null,
    label?: string,
  ): IndexingSource {
    const db = getDatabase();
    const id = randomUUID();
    const resolvedLabel = label ?? DEFAULT_LABELS[type];
    const now = Date.now();

    db.prepare(`
      INSERT INTO indexing_sources
        (id, type, label, status, path_or_config, indexed_count, created_at)
      VALUES (?, ?, ?, 'pending', ?, 0, ?)
    `).run(id, type, resolvedLabel, pathOrConfig, now);

    // Telemetry: record addition order
    const t = getTelemetry();
    t.sourcesAddedOrder.push(type);
    t.stepStartTimes.set(id, now);

    const row = db.prepare<[string], SourceRow>(
      `SELECT * FROM indexing_sources WHERE id = ?`,
    ).get(id) as SourceRow;

    return rowToSource(row);
  }

  /**
   * Mark a source as skipped (user opted out).
   */
  skipSource(sourceId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE indexing_sources SET status = 'skipped' WHERE id = ?
    `).run(sourceId);

    const row = db.prepare<[string], SourceRow>(
      `SELECT type FROM indexing_sources WHERE id = ?`,
    ).get(sourceId) as Pick<SourceRow, 'type'> | undefined;

    if (row) {
      getTelemetry().sourcesSkipped.push(row.type as IndexingSourceType);
    }
  }

  /**
   * Mark a source as indexing and record start time.
   */
  startIndexing(sourceId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE indexing_sources
      SET status = 'indexing', started_at = ?
      WHERE id = ?
    `).run(Date.now(), sourceId);
  }

  /**
   * Update the indexed_count and optional total_count for a source mid-flight.
   * Called by Ghost ingest pipeline as batches complete.
   */
  updateProgress(
    sourceId: string,
    indexedCount: number,
    totalCount?: number,
  ): void {
    const db = getDatabase();
    if (totalCount !== undefined) {
      db.prepare(`
        UPDATE indexing_sources
        SET indexed_count = ?, total_count = ?
        WHERE id = ?
      `).run(indexedCount, totalCount, sourceId);
    } else {
      db.prepare(`
        UPDATE indexing_sources
        SET indexed_count = ?
        WHERE id = ?
      `).run(indexedCount, sourceId);
    }
  }

  /**
   * Called by Ghost ingest when a source finishes processing.
   * Marks complete, fires per-source synthesis, then checks for all-complete.
   * Non-blocking — synthesis runs async, caller returns immediately.
   */
  onSourceComplete(sourceId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE indexing_sources
      SET status = 'complete', completed_at = ?
      WHERE id = ?
    `).run(Date.now(), sourceId);

    // Telemetry: record time-to-complete
    const t = getTelemetry();
    const startTime = t.stepStartTimes.get(sourceId);
    if (startTime) {
      t.perSourceReadTimeMs[sourceId] = Date.now() - startTime;
      t.stepStartTimes.delete(sourceId);
    }

    // Fire synthesis async — never block the caller
    void this._runSourceSynthesis(sourceId);
  }

  /**
   * Mark a source as errored.
   */
  onSourceError(sourceId: string, _errorMessage: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE indexing_sources
      SET status = 'error'
      WHERE id = ?
    `).run(sourceId);
    // Error message is logged server-side; not stored in DB (no PII risk but
    // also not useful for the synthesis pipeline — skipped sources are treated
    // the same as errored ones for master synthesis eligibility).
  }

  /**
   * Record that the user has read (spent time on) a synthesis step.
   * Used for telemetry — tracks engagement, not content.
   */
  recordReadTime(sourceId: string, durationMs: number): void {
    const t = getTelemetry();
    const existing = t.perSourceReadTimeMs[sourceId] ?? 0;
    t.perSourceReadTimeMs[sourceId] = existing + durationMs;
  }

  /**
   * Record that the user dismissed without completing all sources (exited early).
   */
  recordEarlyExit(): void {
    getTelemetry().exitedEarly = true;
    flushTelemetry();
  }

  /**
   * Record that a nudge conversion happened (user added a skipped source after nudge).
   */
  recordNudgeConversion(type: IndexingSourceType): void {
    getTelemetry().nudgeConversions.push(type);
  }

  // ── Progress query ──────────────────────────────────────────────────────

  getProgress(): SynthesisProgress {
    const db = getDatabase();
    const rows = db.prepare<[], SourceRow>(
      `SELECT * FROM indexing_sources ORDER BY created_at ASC`,
    ).all() as SourceRow[];

    const sources = rows.map(rowToSource);
    const nonSkipped = sources.filter((s) => s.status !== 'skipped');
    const complete   = sources.filter((s) => s.status === 'complete');
    const allComplete = nonSkipped.length > 0 && nonSkipped.every((s) => s.status === 'complete');

    const pendingNudgeSources = sources.filter(
      (s) => s.status === 'skipped',
    );

    const masterSynthesis = allComplete ? loadMasterSynthesis() : null;

    return {
      sources,
      allComplete,
      masterSynthesis,
      totalIndexed: complete.reduce((sum, s) => sum + s.indexed_count, 0),
      totalSources: sources.length,
      pendingNudgeSources,
    };
  }

  /**
   * Manually trigger master synthesis generation.
   * For users who want it before all sources are added.
   */
  async generateMasterNow(): Promise<MasterSynthesis> {
    const db = getDatabase();
    const rows = db.prepare<[], SourceRow>(
      `SELECT * FROM indexing_sources WHERE status = 'complete' ORDER BY created_at ASC`,
    ).all() as SourceRow[];

    const sources = rows.map(rowToSource);
    const result = await generateMasterSynthesis(sources);

    getTelemetry().completedMaster = true;
    flushTelemetry();

    return result;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async _runSourceSynthesis(sourceId: string): Promise<void> {
    const db = getDatabase();

    const sourceRow = db.prepare<[string], SourceRow>(
      `SELECT * FROM indexing_sources WHERE id = ?`,
    ).get(sourceId) as SourceRow | undefined;

    if (!sourceRow) return;

    const source = rowToSource(sourceRow);

    // Get all previously-completed sources (excluding this one)
    const prevRows = db.prepare<[string], SourceRow>(`
      SELECT * FROM indexing_sources
      WHERE status = 'complete' AND id != ?
      ORDER BY completed_at ASC
    `).all(sourceId) as SourceRow[];

    const previousSources = prevRows.map(rowToSource);

    try {
      await generateSourceSynthesis(source, previousSources);
    } catch (err) {
      console.error('[synthesis/orchestrator] Source synthesis failed:', err);
    }

    // Check if all non-skipped sources are now complete → auto-trigger master
    await this._checkAllComplete();
  }

  private async _checkAllComplete(): Promise<void> {
    const db = getDatabase();

    type CountRow = { pending: number; indexing: number; complete: number };
    const counts = db.prepare<[], CountRow>(`
      SELECT
        SUM(CASE WHEN status IN ('pending','indexing') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'indexing'             THEN 1 ELSE 0 END) AS indexing,
        SUM(CASE WHEN status = 'complete'             THEN 1 ELSE 0 END) AS complete
      FROM indexing_sources
      WHERE status NOT IN ('skipped', 'error')
    `).get() as CountRow;

    if (counts.pending === 0 && counts.complete > 0) {
      // All non-skipped sources are done — generate master synthesis
      await this.generateMasterNow().catch((err) => {
        console.error('[synthesis/orchestrator] Master synthesis failed:', err);
      });
    }
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────

let _orchestrator: IndexingOrchestrator | null = null;

export function getOrchestrator(): IndexingOrchestrator {
  if (!_orchestrator) _orchestrator = new IndexingOrchestrator();
  return _orchestrator;
}
