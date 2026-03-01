/**
 * Agent SDK — Public API
 *
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

import { runSession } from './executor';
import { costTracker } from './cost-tracker';
import { markStaleJobsInterrupted } from './job-tracker';
import { AGENT_COST_CONFIG } from './config';
import { TASK_PRIORITY } from './types';
import type { TaskManifest, JobRecord, JobState, ResultReport } from './types';

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
