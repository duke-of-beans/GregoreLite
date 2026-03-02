/**
 * Agent SDK — Public API
 *
 * ── Phase 7A API (new) ──────────────────────────────────────────────────────
 * spawnSession(manifest)    — start a Phase 7A query() session
 * killSession(manifestId)   — abort immediately, preserve files, return partial report
 * getJobState(manifestId)   — read job_state row from KERNL
 *
 * ── Sprint 2A API (legacy, kept for backward compat) ───────────────────────
 * spawn(manifest)  — start a worker session (or queue it if at capacity)
 * kill(jobId)      — abort a running session → INTERRUPTED
 * status(jobId)    — get current JobRecord
 * list()           — get all active + queued jobs
 *
 * In-memory priority queue for Phase 2. BullMQ upgrade is Phase 3.
 * Max 8 concurrent sessions per BLUEPRINT §4.3.6.
 *
 * BLUEPRINT §4.3 + §4.3.6
 */

import { runQuerySession, readJobState } from './query';
import { runSession } from './executor';
import { costTracker } from './cost-tracker';
import { markStaleJobsInterrupted } from './job-tracker';
import { AGENT_COST_CONFIG } from './config';
import { TASK_PRIORITY } from './types';
import type { TaskManifest, JobRecord, JobState, ResultReport, JobStatus, JobStateRow } from './types';
import { scheduler } from './scheduler';
import { isDailyCapReached } from './budget-enforcer';

// ─── Phase 7A: active query sessions ─────────────────────────────────────────

interface QuerySession {
  manifestId: string;
  abortController: AbortController;
  startedAt: string;
  filesWritten: string[];
}

const activeSessions = new Map<string, QuerySession>();

// ─── Phase 7A: spawnSession ───────────────────────────────────────────────────

export interface SpawnSessionResult {
  manifestId: string;
  started: boolean;
  queued?: boolean;
  queuePosition?: number | undefined;
}

export function spawnSession(manifest: TaskManifest): SpawnSessionResult {
  const manifestId = manifest.manifest_id;

  if (activeSessions.has(manifestId)) {
    return { manifestId, started: false };
  }

  // Daily cost cap check (Sprint 7D)
  if (isDailyCapReached()) {
    throw new Error('Daily cost cap reached. No new sessions until tomorrow UTC.');
  }

  // Route through the concurrency scheduler (Sprint 7E).
  // Strategic thread sessions bypass the queue; all others are subject to the
  // 8-slot cap and token-bucket rate limit.
  const result = scheduler.enqueue(manifest, _startQuerySession);
  return {
    manifestId,
    started: result.started,
    queued: result.queued,
    queuePosition: result.queuePosition,
  };
}

/**
 * Internal session starter passed to the scheduler as a callback.
 * Called immediately when a slot is available, or deferred when queued.
 * The scheduler supplies onSchedulerComplete — must be called on every
 * terminal path so the scheduler can promote the next PENDING session.
 */
function _startQuerySession(
  manifest: TaskManifest,
  onSchedulerComplete: (manifestId: string) => void,
): void {
  const manifestId = manifest.manifest_id;
  const abortController = new AbortController();

  const session: QuerySession = {
    manifestId,
    abortController,
    startedAt: new Date().toISOString(),
    filesWritten: [],
  };
  activeSessions.set(manifestId, session);

  const _complete = (id: string) => {
    activeSessions.delete(id);
    onSchedulerComplete(id);
  };

  // Fire-and-forget — state tracked via job_state table
  runQuerySession(manifest, abortController.signal, {
    onStatusChange(_id: string, _status: JobStatus) { /* job_state written by query.ts */ },
    onStreamEvent(_event) { /* callers poll job_state or subscribe via 7F UI */ },
    onLogLine(_id: string, _line: string) { /* logged internally */ },
    onComplete(id: string, _finalStatus: JobStatus) { _complete(id); },
    onError(id: string, _err: Error) { _complete(id); },
  }).catch((err: unknown) => {
    console.error(`[AgentSDK] Unhandled error in query session ${manifestId}:`, err);
    _complete(manifestId);
  });
}

// ─── Phase 7A: killSession ────────────────────────────────────────────────────

export interface KillSessionResult {
  killed: boolean;
  manifestId: string;
  partialReport: {
    filesWritten: string[];
    startedAt: string;
    killedAt: string;
    message: string;
  } | null;
}

/**
 * killSession — abort the in-flight SDK stream immediately.
 *
 * Per BLUEPRINT:
 * 1. Abort the stream immediately
 * 2. Write job_state status = 'failed', last_event = 'killed by user'
 * 3. Produce partial result report listing files already written
 * 4. Return immediately — cleanup is async
 */
export function killSession(manifestId: string): KillSessionResult {
  const session = activeSessions.get(manifestId);
  if (!session) {
    return { killed: false, manifestId, partialReport: null };
  }

  // Signal abort — query.ts detects this and transitions to INTERRUPTED
  session.abortController.abort();
  activeSessions.delete(manifestId);
  scheduler.cancel(manifestId); // release slot and promote next pending

  const killedAt = new Date().toISOString();

  return {
    killed: true,
    manifestId,
    partialReport: {
      filesWritten: [...session.filesWritten],
      startedAt: session.startedAt,
      killedAt,
      message: 'Session aborted by user. Files written before kill are preserved on disk.',
    },
  };
}

// ─── Phase 7A: getJobState ────────────────────────────────────────────────────

export function getJobState(manifestId: string): JobStateRow | null {
  return readJobState(manifestId);
}

// ─── Phase 7F: getPendingManifests ───────────────────────────────────────────

/** Returns manifests currently waiting in the scheduler's in-memory priority queue. */
export function getPendingManifests() {
  return scheduler.getPendingManifests();
}

// ─── Phase 7A: markInterruptedOnBoot ─────────────────────────────────────────

/**
 * On app startup: set any job_state rows in active states to INTERRUPTED.
 * Called once from the bootstrap sequence.
 */
export function markInterruptedOnBoot(): number {
  try {
    const { getDatabase } = require('../kernl/database') as typeof import('../kernl/database');
    const db = getDatabase();
    const result = db.prepare(`
      UPDATE job_state
      SET status = 'interrupted', updated_at = ?
      WHERE status IN ('spawning', 'running', 'working', 'validating')
    `).run(Date.now());
    return (result as { changes: number }).changes;
  } catch {
    return 0;
  }
}

// ─── In-memory state ──────────────────────────────────────────────────────────

const activeJobs = new Map<string, JobRecord>();
const pendingQueue: JobRecord[] = []; // sorted by priority desc

// ─── Boot-time cleanup ────────────────────────────────────────────────────────
// Mark any DB rows still in running/working from a previous crash

let _bootCleanupDone = false;
function ensureBootCleanup(): void {
  if (_bootCleanupDone) return;
  _bootCleanupDone = true;
  try {
    const changed = markStaleJobsInterrupted();
    if (changed > 0) {
      console.info(`[AgentSDK] Marked ${changed} stale job(s) INTERRUPTED on boot`);
    }
  } catch (err) {
    console.error('[AgentSDK] Boot cleanup failed:', err);
  }
}

// ─── spawn ────────────────────────────────────────────────────────────────────

export interface SpawnResult {
  jobId: string;
  queued: boolean;
  queuePosition?: number;
}

export function spawn(manifest: TaskManifest): SpawnResult {
  ensureBootCleanup();

  const jobId = manifest.manifest_id;

  if (costTracker.isDailyCapReached()) {
    throw new Error(
      `Daily cost cap ($${AGENT_COST_CONFIG.dailyHardCapUsd}) reached. No new sessions until cap resets.`
    );
  }

  const priority = TASK_PRIORITY[manifest.task.type] ?? 50;

  const record: JobRecord = {
    jobId,
    manifest,
    state: 'SPAWNING',
    priority,
    startedAt: null,
    completedAt: null,
    currentStep: 0,
    totalSteps: manifest.task.success_criteria.length,
    tokensUsed: 0,
    costUsd: 0,
    logLines: [],
    resultReport: null,
    abortController: new AbortController(),
  };

  if (activeJobs.size >= AGENT_COST_CONFIG.maxConcurrentSessions) {
    // Enqueue — maintain priority order (highest first)
    pendingQueue.push(record);
    pendingQueue.sort((a, b) => b.priority - a.priority);
    const queuePosition = pendingQueue.findIndex((j) => j.jobId === jobId) + 1;
    return { jobId, queued: true, queuePosition };
  }

  _startJob(record);
  return { jobId, queued: false };
}

// ─── kill ─────────────────────────────────────────────────────────────────────

export function kill(jobId: string): boolean {
  const job = activeJobs.get(jobId);
  if (!job) {
    // Check pending queue
    const idx = pendingQueue.findIndex((j) => j.jobId === jobId);
    if (idx !== -1) {
      pendingQueue.splice(idx, 1);
      return true;
    }
    return false;
  }
  // Signal abort and immediately evict from active tracking.
  // The executor detects the abort signal asynchronously (DB finalization),
  // but from the caller's perspective the job is removed on kill.
  // _finalizeJob() is safely idempotent if called again by the executor.
  job.abortController?.abort();
  activeJobs.delete(jobId);
  return true;
}

// ─── status ───────────────────────────────────────────────────────────────────

export function status(jobId: string): JobRecord | null {
  return activeJobs.get(jobId) ?? pendingQueue.find((j) => j.jobId === jobId) ?? null;
}

// ─── list ─────────────────────────────────────────────────────────────────────

export function list(): JobRecord[] {
  return [
    ...Array.from(activeJobs.values()),
    ...pendingQueue,
  ];
}

// ─── Internal: start executing a job ─────────────────────────────────────────

function _startJob(record: JobRecord): void {
  record.startedAt = new Date().toISOString();
  activeJobs.set(record.jobId, record);

  const callbacks = {
    onStateChange(jobId: string, state: JobState) {
      const job = activeJobs.get(jobId);
      if (job) job.state = state;
    },
    onLogLine(jobId: string, line: string) {
      const job = activeJobs.get(jobId);
      if (job) {
        job.logLines.push(line);
        // Keep last 200 lines in memory
        if (job.logLines.length > 200) job.logLines.shift();
      }
    },
    onUsageUpdate(jobId: string, tokensUsed: number, costUsd: number) {
      const job = activeJobs.get(jobId);
      if (job) {
        job.tokensUsed = tokensUsed;
        job.costUsd = costUsd;
      }
    },
    onStepIncrement(jobId: string) {
      const job = activeJobs.get(jobId);
      if (job) job.currentStep = Math.min(job.currentStep + 1, job.totalSteps);
    },
    onComplete(jobId: string, report: ResultReport) {
      const job = activeJobs.get(jobId);
      if (job) {
        job.resultReport = report;
        job.completedAt = report.completed_at;
      }
      _finalizeJob(jobId);
    },
    onError(jobId: string, _error: Error) {
      _finalizeJob(jobId);
    },
  };

  // Run async — intentionally fire-and-forget; state updates go through callbacks
  runSession(record.manifest, record, callbacks).catch((err) => {
    console.error(`[AgentSDK] Unhandled error in session ${record.jobId}:`, err);
    _finalizeJob(record.jobId);
  });
}

function _finalizeJob(jobId: string): void {
  activeJobs.delete(jobId);
  // Promote next queued job if capacity is now available
  if (pendingQueue.length > 0 && activeJobs.size < AGENT_COST_CONFIG.maxConcurrentSessions) {
    const next = pendingQueue.shift();
    if (next) _startJob(next);
  }
}
