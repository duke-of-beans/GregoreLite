/**
 * Ghost Ingest — AEGIS-Governed Queue
 *
 * IngestQueue — in-memory FIFO queue with backpressure-aware pause/resume.
 *
 * Processing pauses automatically when the AEGIS profile is PARALLEL_BUILD
 * or COUNCIL (high-load scenarios). Items are never dropped — the queue
 * continues accepting new items while paused and drains the backlog when
 * the profile returns to normal.
 *
 * At >10,000 items a warning is logged but acceptance continues (never-drop
 * guarantee).
 */

import { getLatestAegisSignal } from '@/lib/kernl/aegis-store';
import type { IngestItem } from './types';

const MAX_QUEUE_WARN = 10_000;
const AEGIS_PAUSE_PROFILES = new Set(['PARALLEL_BUILD', 'COUNCIL']);
const POLL_INTERVAL_MS = 200;

export class IngestQueue {
  private readonly _items: IngestItem[] = [];
  private _handler: ((item: IngestItem) => Promise<void>) | null = null;
  private _running = false;
  private _paused = false;
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _processing = false;

  /**
   * Register the item-processing callback.
   * Must be called before start().
   */
  onProcess(handler: (item: IngestItem) => Promise<void>): void {
    this._handler = handler;
  }

  /**
   * Start the queue processor. Idempotent — safe to call multiple times.
   */
  start(): void {
    if (this._running) return;
    this._running = true;
    this._timer = setInterval(() => void this._tick(), POLL_INTERVAL_MS);
  }

  /**
   * Stop the queue processor. Queued items are retained for the next start().
   */
  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._running = false;
  }

  /**
   * Enqueue an item. Never blocks, never drops.
   * Logs a warning if the backlog exceeds MAX_QUEUE_WARN.
   */
  enqueue(item: IngestItem): void {
    if (this._items.length >= MAX_QUEUE_WARN) {
      console.warn(
        `[GhostQueue] Depth ${this._items.length} exceeds ${MAX_QUEUE_WARN} — backlog accumulating`
      );
    }
    this._items.push(item);
  }

  /** Manually pause processing. The timer keeps running; items keep being accepted. */
  pause(): void {
    this._paused = true;
  }

  /** Resume processing after a manual pause. */
  resume(): void {
    this._paused = false;
  }

  /** Current number of items waiting in the queue. */
  getDepth(): number {
    return this._items.length;
  }

  private _isAegisPaused(): boolean {
    const signal = getLatestAegisSignal();
    return signal !== null && AEGIS_PAUSE_PROFILES.has(signal.profile);
  }

  private async _tick(): Promise<void> {
    // Re-entrancy guard: do not process a second item while one is in flight
    if (this._processing) return;
    if (this._paused || this._isAegisPaused()) return;
    if (this._items.length === 0) return;
    if (!this._handler) return;

    this._processing = true;
    try {
      const item = this._items.shift()!;
      await this._handler(item);
    } catch (err) {
      // Item was already shifted — do not re-enqueue. Log and continue.
      console.error('[GhostQueue] Error processing item:', err);
    } finally {
      this._processing = false;
    }
  }
}
