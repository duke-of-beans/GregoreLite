/**
 * AEGIS Governor — Sprint 2C
 *
 * determineProfile(): maps observed workload state → WorkloadProfile
 * AEGISGovernor: periodic tick-based evaluation with anti-flap logic.
 *
 * Anti-flap window: 5 000 ms — ticks that fall within this window after the
 * last signal are silently skipped. forceEvaluate() always bypasses anti-flap.
 * Deduplication: identical consecutive profiles are never re-sent.
 */

import type { WorkloadProfile } from './types';

const POLL_INTERVAL_MS = 5_000;
const ANTI_FLAP_MS = 5_000;

// ─── State model ──────────────────────────────────────────────────────────────

interface GovernorState {
  activeWorkers: number;
  hasActiveThread: boolean;
  isClosing: boolean;
}

const DEFAULT_STATE: GovernorState = {
  activeWorkers: 0,
  hasActiveThread: false,
  isClosing: false,
};

// ─── Profile determination ────────────────────────────────────────────────────

/**
 * Pure function — maps workload state to the appropriate WorkloadProfile.
 * Priority order: SUSPEND > IDLE > DEEP_FOCUS > COWORK_BATCH > PARALLEL_BUILD
 */
export function determineProfile(state: GovernorState): WorkloadProfile {
  if (state.isClosing) return 'SUSPEND';
  if (state.activeWorkers === 0 && !state.hasActiveThread) return 'IDLE';
  if (state.activeWorkers === 0 && state.hasActiveThread) return 'DEEP_FOCUS';
  if (state.activeWorkers <= 2) return 'COWORK_BATCH';
  return 'PARALLEL_BUILD';
}

// ─── Governor class ───────────────────────────────────────────────────────────

export type GovernorCallback = (profile: WorkloadProfile) => Promise<void>;

export class AEGISGovernor {
  private state: GovernorState = { ...DEFAULT_STATE };
  private lastProfile: WorkloadProfile | null = null;
  private lastSignalAt = 0;
  private _interval: ReturnType<typeof setInterval> | null = null;
  private readonly cb: GovernorCallback;

  constructor(cb: GovernorCallback) {
    this.cb = cb;
  }

  /**
   * Immediately signal a profile change.
   * If profile is omitted, determineProfile(state) is used.
   * Deduplication: no-op if the resolved profile equals the last sent profile.
   * Anti-flap is NOT applied here — forceEvaluate always fires if profile changed.
   */
  async forceEvaluate(profile?: WorkloadProfile): Promise<void> {
    const p = profile ?? determineProfile(this.state);
    if (p === this.lastProfile) return; // dedup
    this.lastProfile = p;
    this.lastSignalAt = Date.now();
    await this.cb(p);
  }

  /** Returns the last profile that was signalled, or null before any signal. */
  getLastProfile(): WorkloadProfile | null {
    return this.lastProfile;
  }

  /**
   * Start the polling interval. Idempotent — multiple calls register exactly
   * one interval.
   */
  start(): void {
    if (this._interval !== null) return;
    this._interval = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
  }

  /** Stop the polling interval. Safe to call if already stopped. */
  stop(): void {
    if (this._interval !== null) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  /** Merge partial state updates without touching unspecified fields. */
  updateState(partial: Partial<GovernorState>): void {
    this.state = { ...this.state, ...partial };
  }

  // ── Private tick (runs on interval) ─────────────────────────────────────────

  private async tick(): Promise<void> {
    const now = Date.now();

    // Anti-flap: skip if within cooldown window since last signal
    if (now - this.lastSignalAt < ANTI_FLAP_MS) return;

    const p = determineProfile(this.state);

    // Dedup: skip if profile hasn't changed
    if (p === this.lastProfile) return;

    this.lastProfile = p;
    this.lastSignalAt = now;
    await this.cb(p);
  }
}
