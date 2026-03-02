/**
 * Job Tracker
 *
 * Writes job state transitions to the KERNL manifests table.
 * Each call to transition() is an atomic SQLite write.
 *
 * BLUEPRINT §4.3.2
 */

import { getDatabase } from '../kernl/database';
import type { TaskManifest, JobState, ResultReport } from './types';
import { runOnce } from '../indexer';
import { scan, persistHealthScore } from '../eos/index';

// ─── Row shape matching schema.sql manifests table ────────────────────────────

export interface ManifestRow {
  id: string;
  version: string;
  spawned_by_thread: string;
  strategic_thread_id: string;
  created_at: string;
  updated_at: number;
  status: string;
  task_type: string | null;
  title: string | null;
  description: string | null;
  project_path: string | null;
  dependencies: string | null; // JSON
  quality_gates: string | null; // JSON
  is_self_evolution: number;
  self_evolution_branch: string | null;
  result_report: string | null; // JSON
  tokens_used: number;
  cost_usd: number;
}

// ─── Insert a new manifest row (SPAWNING state) ───────────────────────────────

export function insertManifest(manifest: TaskManifest): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO manifests (
      id, version, spawned_by_thread, strategic_thread_id,
      created_at, updated_at, status,
      task_type, title, description, project_path,
      dependencies, quality_gates,
      is_self_evolution, self_evolution_branch,
      tokens_used, cost_usd
    ) VALUES (
      @id, @version, @spawned_by_thread, @strategic_thread_id,
      @created_at, @updated_at, @status,
      @task_type, @title, @description, @project_path,
      @dependencies, @quality_gates,
      @is_self_evolution, @self_evolution_branch,
      0, 0
    )
  `);

  stmt.run({
    id: manifest.manifest_id,
    version: manifest.version,
    spawned_by_thread: manifest.spawned_by.thread_id,
    strategic_thread_id: manifest.spawned_by.strategic_thread_id,
    created_at: manifest.spawned_by.timestamp,
    updated_at: Date.now(),
    status: 'spawning',
    task_type: manifest.task.type,
    title: manifest.task.title,
    description: manifest.task.description,
    project_path: manifest.context.project_path,
    dependencies: JSON.stringify(manifest.context.dependencies),
    quality_gates: JSON.stringify(manifest.quality_gates),
    is_self_evolution: manifest.is_self_evolution ? 1 : 0,
    self_evolution_branch: manifest.self_evolution_branch ?? null,
  });
}

// ─── State transition ─────────────────────────────────────────────────────────

export function transitionState(manifestId: string, state: JobState): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE manifests SET status = @status, updated_at = @updated_at WHERE id = @id
  `).run({
    status: state.toLowerCase(),
    updated_at: Date.now(),
    id: manifestId,
  });
}

// ─── Update token usage (called on each streaming chunk with usage data) ──────

export function updateUsage(manifestId: string, tokensUsed: number, costUsd: number): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE manifests SET tokens_used = @tokens_used, cost_usd = @cost_usd, updated_at = @updated_at WHERE id = @id
  `).run({
    tokens_used: tokensUsed,
    cost_usd: costUsd,
    updated_at: Date.now(),
    id: manifestId,
  });
}

// ─── Write final result report on completion ──────────────────────────────────

export function writeResultReport(
  manifestId: string,
  state: 'COMPLETED' | 'FAILED' | 'INTERRUPTED',
  report: ResultReport
): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE manifests
    SET status = @status,
        result_report = @result_report,
        tokens_used = @tokens_used,
        cost_usd = @cost_usd,
        updated_at = @updated_at
    WHERE id = @id
  `).run({
    status: state.toLowerCase(),
    result_report: JSON.stringify(report),
    tokens_used: report.tokens_used,
    cost_usd: report.cost_usd,
    updated_at: Date.now(),
    id: manifestId,
  });

  // After a successful job, opportunistically index any new content
  // and run an EoS health scan on the project path (fire-and-forget)
  if (state === 'COMPLETED') {
    setImmediate(() => {
      runOnce().catch((err: unknown) =>
        console.warn('[indexer] post-job run failed', { err })
      );
    });

    // Look up project path + id from the manifest row for EoS wiring
    const manifestRow = getManifestRow(manifestId);
    const projectPath = manifestRow?.project_path ?? null;
    if (projectPath) {
      const projectRow = db
        .prepare('SELECT id FROM projects WHERE path = ?')
        .get(projectPath) as { id: string } | null;
      const projectId = projectRow?.id ?? null;
      setImmediate(() => {
        scan(projectPath, 'quick', projectId ?? undefined)
          .then((result) => {
            if (projectId) persistHealthScore(projectId, result.healthScore);
          })
          .catch((err: unknown) =>
            console.warn('[EoS] post-job scan failed', { err })
          );
      });
    }
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export function getManifestRow(manifestId: string): ManifestRow | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM manifests WHERE id = ?').get(manifestId) as ManifestRow) ?? null;
}

export function listManifestRows(statuses?: JobState[]): ManifestRow[] {
  const db = getDatabase();
  if (!statuses || statuses.length === 0) {
    return db.prepare('SELECT * FROM manifests ORDER BY updated_at DESC').all() as ManifestRow[];
  }
  const placeholders = statuses.map(() => '?').join(', ');
  return db
    .prepare(`SELECT * FROM manifests WHERE status IN (${placeholders}) ORDER BY updated_at DESC`)
    .all(...statuses.map((s) => s.toLowerCase())) as ManifestRow[];
}

// ─── Mark any previously running jobs INTERRUPTED on boot ────────────────────
// Called once at startup to handle crash recovery per BLUEPRINT §4.3.2

export function markStaleJobsInterrupted(): number {
  const db = getDatabase();
  const result = db
    .prepare(`
      UPDATE manifests
      SET status = 'interrupted', updated_at = @updated_at
      WHERE status IN ('spawning', 'running', 'working', 'validating')
    `)
    .run({ updated_at: Date.now() });
  return result.changes;
}
