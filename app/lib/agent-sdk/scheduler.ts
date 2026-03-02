/**
 * Session Scheduler — Sprint 7E
 *
 * Swarm governor for Phase 7 worker sessions.
 *
 * Rules (BLUEPRINT §4.3.6):
 *   - Max 8 sessions run concurrently. Session 9+ enters PENDING with a visible
 *     queue position.
 *   - Priority ordering: strategic_thread(0) > self_evolution(1) > code/test(2) >
 *     docs/deploy(3) > research/analysis(4) > ghost(5).
 *   - Strategic thread sessions bypass the queue and the 8-slot cap entirely.
 *   - Token bucket at 80% → new spawns queue; running sessions continue.
 *   - When a session completes, the highest-priority PENDING session is promoted
 *     immediately (no empty-slot lag).
 *   - All queue state is persisted to session_queue (survives restarts in 7F+ UI).
 */

import { randomUUID } from 'crypto';
import type { TaskManifest } from './types';
import { getPriority, isBypassSession, MAX_CONCURRENT_SESSIONS } from './priority-config';
import { rateLimiter } from './rate-limiter';
import { notifyWorkerCountChanged } from './aegis-integrator';
import { getDatabase } from '@/lib/kernl/database';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueueEntry {
  id: string;           // session_queue PK
  manifestId: string;
  sessionType: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  queuePosition: number | null;
  enqueuedAt: number;
  startedAt: number | null;
  completedAt: number | null;
}

/** Callback invoked by the scheduler to actually start a session. */
export type SessionStarter = (
  manifest: TaskManifest,
  onComplete: (manifestId: string) => void,
) => void;

export interface EnqueueResult {
  manifestId: string;
  started: boolean;
  queued: boolean;
  queuePosition?: number;
  throttled: boolean;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function getDb() {
  return getDatabase();
}

function dbInsertQueue(entry: QueueEntry): void {
  getDb().prepare(`
    INSERT INTO session_queue
      (id, manifest_id, session_type, priority, status, queue_position, enqueued_at, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id, entry.manifestId, entry.sessionType, entry.priority,
    entry.status, entry.queuePosition, entry.enqueuedAt,
    entry.startedAt, entry.completedAt,
  );
}

function dbSetRunning(id: string, startedAt: number): void {
  getDb().prepare(`
    UPDATE session_queue
    SET status = 'running', started_at = ?, queue_position = NULL
    WHERE id = ?
  `).run(startedAt, id);
}

function dbSetCompleted(id: string, completedAt: number): void {
  getDb().prepare(`
    UPDATE session_queue
    SET status = 'completed', completed_at = ?
    WHERE id = ?
  `).run(completedAt, id);
}

function dbSetCancelled(id: string): void {
  getDb().prepare(`
    UPDATE session_queue SET status = 'cancelled' WHERE id = ?
  `).run(id);
}

function dbRenumberPositions(): void {
  // Re-rank all PENDING rows by (priority ASC, enqueued_at ASC)
  const rows = getDb().prepare(`
    SELECT id FROM session_queue
    WHERE status = 'pending'
    ORDER BY priority ASC, enqueued_at ASC
  `).all() as { id: string }[];

  const update = getDb().prepare(
    `UPDATE session_queue SET queue_position = ? WHERE id = ?`,
  );
  rows.forEach((r, i) => update.run(i + 1, r.id));
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class SessionScheduler {
  private static _instance: SessionScheduler | null = null;

  /** Active manifest IDs → queue entry IDs. Drives slot count without DB round-trip. */
  private _running = new Map<string, string>(); // manifestId → queueEntryId

  /** Pending manifests held in memory while waiting to be promoted. */
  private _pending = new Map<string, { entry: QueueEntry; manifest: TaskManifest; starter: SessionStarter }>();

  private constructor() {}

  static getInstance(): SessionScheduler {
    if (!SessionScheduler._instance) {
      SessionScheduler._instance = new SessionScheduler();
    }
    return SessionScheduler._instance;
  }

  /**
   * Enqueue a session for execution.
   * Strategic thread sessions bypass the scheduler entirely — call starter directly.
   */
  enqueue(manifest: TaskManifest, starter: SessionStarter): EnqueueResult {
    const manifestId = manifest.manifest_id;
    const sessionType = manifest.task.type as string;

    // Strategic thread: bypass queue, bypass cap, bypass rate limiter
    if (isBypassSession(sessionType)) {
      starter(manifest, () => { /* bypass sessions manage their own lifecycle */ });
      return { manifestId, started: true, queued: false, throttled: false };
    }

    const priority = getPriority(sessionType);
    const now = Date.now();
    const entryId = randomUUID();

    const entry: QueueEntry = {
      id: entryId,
      manifestId,
      sessionType,
      priority,
      status: 'pending',
      queuePosition: null,
      enqueuedAt: now,
      startedAt: null,
      completedAt: null,
    };

    const activeCount = this._running.size;
    const throttled = rateLimiter.isThrottled();
    const canStart = activeCount < MAX_CONCURRENT_SESSIONS && !throttled;

    if (canStart) {
      entry.status = 'running';
      entry.startedAt = now;
      dbInsertQueue(entry);
      this._running.set(manifestId, entryId);
      this._fireSession(manifest, entry, starter);
      this._broadcastWorkerCount();
      return { manifestId, started: true, queued: false, throttled: false };
    }

    // Queue the session
    dbInsertQueue(entry);
    dbRenumberPositions();
    const updatedRow = getDb().prepare(
      `SELECT queue_position FROM session_queue WHERE id = ?`,
    ).get(entryId) as { queue_position: number };
    entry.queuePosition = updatedRow.queue_position;

    this._pending.set(manifestId, { entry, manifest, starter });

    return {
      manifestId,
      started: false,
      queued: true,
      queuePosition: entry.queuePosition ?? undefined,
      throttled,
    };
  }

  /**
   * Cancel a pending or running session.
   * Returns true if the session was found and cancelled/killed.
   */
  cancel(manifestId: string): boolean {
    const pending = this._pending.get(manifestId);
    if (pending) {
      this._pending.delete(manifestId);
      dbSetCancelled(pending.entry.id);
      dbRenumberPositions();
      return true;
    }
    const entryId = this._running.get(manifestId);
    if (entryId) {
      // Running sessions are killed by the caller (AbortController in index.ts)
      // We just clean up our tracking here
      this._running.delete(manifestId);
      dbSetCompleted(entryId, Date.now());
      this._broadcastWorkerCount();
      this._promotePending();
      return true;
    }
    return false;
  }

  /** Called by the session runner when a session finishes (any terminal state). */
  onComplete(manifestId: string): void {
    const entryId = this._running.get(manifestId);
    if (!entryId) return;

    this._running.delete(manifestId);
    dbSetCompleted(entryId, Date.now());
    this._broadcastWorkerCount();
    this._promotePending();
  }

  /** Number of currently running sessions (excluding bypass). */
  getActiveCount(): number {
    return this._running.size;
  }

  /** All pending queue entries in priority order. */
  getPendingQueue(): QueueEntry[] {
    return Array.from(this._pending.values())
      .map((p) => p.entry)
      .sort((a, b) => a.priority - b.priority || a.enqueuedAt - b.enqueuedAt);
  }

  /** All pending entries with their full manifests — used by the 7F list API. */
  getPendingManifests(): Array<{ entry: QueueEntry; manifest: TaskManifest }> {
    return Array.from(this._pending.values())
      .map(({ entry, manifest }) => ({ entry, manifest }))
      .sort((a, b) => a.entry.priority - b.entry.priority || a.entry.enqueuedAt - b.entry.enqueuedAt);
  }

  /** Reset singleton — test use only. */
  static _resetForTests(): void {
    SessionScheduler._instance = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _fireSession(
    manifest: TaskManifest,
    entry: QueueEntry,
    starter: SessionStarter,
  ): void {
    dbSetRunning(entry.id, entry.startedAt ?? Date.now());
    starter(manifest, (completedId) => {
      this.onComplete(completedId);
    });
  }

  private _promotePending(): void {
    if (this._pending.size === 0) return;
    if (this._running.size >= MAX_CONCURRENT_SESSIONS) return;
    if (rateLimiter.isThrottled()) return;

    // Find highest-priority pending entry
    const next = this.getPendingQueue()[0];
    if (!next) return;

    const item = this._pending.get(next.manifestId);
    if (!item) return;

    this._pending.delete(next.manifestId);
    next.status = 'running';
    next.startedAt = Date.now();
    next.queuePosition = null;

    this._running.set(next.manifestId, next.id);
    dbRenumberPositions();
    this._fireSession(item.manifest, next, item.starter);
    this._broadcastWorkerCount();
  }

  private _broadcastWorkerCount(): void {
    try {
      notifyWorkerCountChanged(this._running.size);
    } catch {
      // AEGIS offline — non-fatal
    }
  }
}

/** Module-level singleton accessor. */
export const scheduler = SessionScheduler.getInstance();
