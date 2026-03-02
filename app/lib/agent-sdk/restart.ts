/**
 * restart.ts — Phase 7C
 *
 * spawnRestart() — creates a new session to retry a failed or interrupted manifest.
 *
 * Flow:
 *   1. Load original manifest row from DB
 *   2. Build handoff report from prior job_state
 *   3. Clone manifest with new ID + handoff context prepended to description
 *   4. Insert new manifest row
 *   5. Record session_restarts audit row
 *   6. Call spawnSession() from Phase 7A
 *
 * Note: The manifests table CHECK constraint on task_type was written before
 * 'analysis' was added in 7B. If runMigrations() in database.ts has not yet
 * relaxed that constraint on the live DB, restart of an analysis session will
 * fail at the INSERT. This is tracked and will be resolved when 7D runs
 * the manifest schema migration.
 *
 * BLUEPRINT §4.3.4
 */

import { randomUUID } from 'crypto';
import { getDatabase } from '../kernl/database';
import { buildHandoffReport } from './handoff-report';
import { spawnSession } from './index';
import type { SpawnSessionResult } from './index';
import type { TaskManifest } from './types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RestartResult {
  originalManifestId: string;
  newManifestId:      string;
  spawnResult:        SpawnSessionResult;
}

export interface RestartOptions {
  /** Who triggered the restart: 'user' (default) or 'auto' (future auto-restart). */
  restartedBy?: 'user' | 'auto';
}

// ─── spawnRestart ─────────────────────────────────────────────────────────────

/**
 * spawnRestart — restart a failed or interrupted session.
 *
 * The new session receives the original manifest with a fresh manifest_id and
 * the handoff report prepended to the task description so the agent immediately
 * understands what has already been done.
 */
export async function spawnRestart(
  originalManifestId: string,
  opts: RestartOptions = {},
): Promise<RestartResult> {
  const db          = getDatabase();
  const restartedBy = opts.restartedBy ?? 'user';

  // ── 1. Load original manifest row ─────────────────────────────────────────
  const originalRow = db
    .prepare('SELECT * FROM manifests WHERE id = ?')
    .get(originalManifestId) as ManifestRow | undefined;

  if (!originalRow) {
    throw new Error(
      `spawnRestart: manifest not found — id=${originalManifestId}`,
    );
  }

  // ── 2. Build handoff report from prior job_state ──────────────────────────
  const handoffReport = buildHandoffReport(originalManifestId);

  // ── 3. Reconstruct TaskManifest and clone with new ID ────────────────────
  const originalManifest = rowToManifest(originalRow);
  const newManifestId    = randomUUID();

  const newManifest: TaskManifest = {
    ...originalManifest,
    manifest_id: newManifestId,
    spawned_by: {
      ...originalManifest.spawned_by,
      timestamp: new Date().toISOString(),
    },
    task: {
      ...originalManifest.task,
      // Prepend handoff report to description so the agent sees prior context
      description: `${handoffReport}\n\n---\n\n${originalManifest.task.description}`,
    },
  };

  // ── 4. Insert new manifest row ────────────────────────────────────────────
  db.prepare(`
    INSERT INTO manifests (
      id, version, spawned_by_thread, strategic_thread_id,
      created_at, updated_at, status, task_type, title, description,
      project_path, dependencies, quality_gates, is_self_evolution,
      self_evolution_branch
    ) VALUES (
      @id, @version, @spawned_by_thread, @strategic_thread_id,
      @created_at, @updated_at, @status, @task_type, @title, @description,
      @project_path, @dependencies, @quality_gates, @is_self_evolution,
      @self_evolution_branch
    )
  `).run({
    id:                   newManifestId,
    version:              originalRow.version,
    spawned_by_thread:    originalRow.spawned_by_thread,
    strategic_thread_id:  originalRow.strategic_thread_id,
    created_at:           new Date().toISOString(),
    updated_at:           Date.now(),
    status:               'pending',
    task_type:            originalRow.task_type,
    title:                originalRow.title,
    description:          newManifest.task.description,
    project_path:         originalRow.project_path,
    dependencies:         originalRow.dependencies ?? '[]',
    quality_gates:        originalRow.quality_gates ?? '{}',
    is_self_evolution:    originalRow.is_self_evolution ?? 0,
    self_evolution_branch: originalRow.self_evolution_branch ?? null,
  });

  // ── 5. Record session_restarts audit row ──────────────────────────────────
  const restartReason = readRestartReason(originalManifestId);

  db.prepare(`
    INSERT INTO session_restarts (
      id, original_manifest_id, new_manifest_id,
      restart_reason, restarted_at, restarted_by
    ) VALUES (
      @id, @original_manifest_id, @new_manifest_id,
      @restart_reason, @restarted_at, @restarted_by
    )
  `).run({
    id:                   randomUUID(),
    original_manifest_id: originalManifestId,
    new_manifest_id:      newManifestId,
    restart_reason:       restartReason,
    restarted_at:         Date.now(),
    restarted_by:         restartedBy,
  });

  // ── 6. Spawn the new session ──────────────────────────────────────────────
  const spawnResult = spawnSession(newManifest);

  return { originalManifestId, newManifestId, spawnResult };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface ManifestRow {
  id:                    string;
  version:               string;
  spawned_by_thread:     string;
  strategic_thread_id:   string;
  created_at:            string;
  updated_at:            number;
  status:                string;
  task_type:             string;
  title:                 string | null;
  description:           string | null;
  project_path:          string | null;
  dependencies:          string | null;
  quality_gates:         string | null;
  is_self_evolution:     number;
  self_evolution_branch: string | null;
}

function rowToManifest(row: ManifestRow): TaskManifest {
  let qualityGates = { shim_required: false, eos_required: false, tests_required: true };
  try {
    const parsed = JSON.parse(row.quality_gates ?? '{}') as typeof qualityGates;
    qualityGates = parsed;
  } catch { /* use defaults */ }

  let dependencies: string[] = [];
  try {
    dependencies = JSON.parse(row.dependencies ?? '[]') as string[];
  } catch { /* use empty array */ }

  return {
    manifest_id: row.id,
    version:     '1.0',
    spawned_by: {
      thread_id:           row.spawned_by_thread,
      strategic_thread_id: row.strategic_thread_id,
      timestamp:           row.created_at,
    },
    task: {
      id:               row.id,
      type:             row.task_type as TaskManifest['task']['type'],
      title:            row.title ?? '',
      description:      row.description ?? '',
      success_criteria: [],
    },
    context: {
      project_path: row.project_path ?? '',
      files:        [],
      environment:  {},
      dependencies,
    },
    protocol: {
      output_format:      'mixed',
      reporting_interval: 30,
      max_duration:       60,
    },
    return_to_thread: {
      id:         row.spawned_by_thread,
      on_success: 'report',
      on_failure: 'report',
    },
    quality_gates:     qualityGates,
    is_self_evolution: row.is_self_evolution === 1,
    ...(row.self_evolution_branch ? { self_evolution_branch: row.self_evolution_branch } : {}),
  };
}

function readRestartReason(originalManifestId: string): string {
  try {
    const db       = getDatabase();
    const jobState = db
      .prepare('SELECT last_event FROM job_state WHERE manifest_id = ?')
      .get(originalManifestId) as { last_event: string } | undefined;

    if (!jobState?.last_event) return 'unknown';

    const event = JSON.parse(jobState.last_event) as Record<string, unknown>;
    return String(event['context'] ?? event['message'] ?? event['type'] ?? 'unknown');
  } catch {
    return 'unknown';
  }
}
