/**
 * Indexer Scheduler — cadence management and idle detection.
 *
 * Cadence: every 30 minutes, only if user has been idle for 5+ minutes.
 * Out-of-schedule triggers (session end, job completion) call runFn directly
 * via setImmediate — see index.ts.
 *
 * Wire recordUserActivity() into the chat route — call it on every user message.
 *
 * @module lib/indexer/scheduler
 */

const CADENCE_MS = 30 * 60 * 1000;    // 30 minutes
const IDLE_REQUIRED_MS = 5 * 60 * 1000; // 5 minutes

let _lastUserActivity = Date.now();
let _schedulerInterval: ReturnType<typeof setInterval> | null = null;

/** Call this on every user interaction (chat message, UI action). */
export function recordUserActivity(): void {
  _lastUserActivity = Date.now();
}

/** True when the user has been idle for at least IDLE_REQUIRED_MS. */
export function isUserIdle(): boolean {
  return Date.now() - _lastUserActivity > IDLE_REQUIRED_MS;
}

/** Returns the timestamp of last recorded user activity. */
export function getLastUserActivity(): number {
  return _lastUserActivity;
}

/**
 * Start the 30-minute cadence scheduler.
 * runFn is called only when the user is idle and AEGIS allows it.
 * Idempotent — calling start() twice does not create duplicate intervals.
 */
export function startScheduler(runFn: () => Promise<void>): void {
  if (_schedulerInterval !== null) return;

  _schedulerInterval = setInterval(() => {
    if (!isUserIdle()) return;
    void runFn();
  }, CADENCE_MS);
}

/** Stop the scheduler. Safe to call multiple times. */
export function stopScheduler(): void {
  if (_schedulerInterval !== null) {
    clearInterval(_schedulerInterval);
    _schedulerInterval = null;
  }
}

/** True when the scheduler is currently running. */
export function isSchedulerRunning(): boolean {
  return _schedulerInterval !== null;
}

/** Reset activity timestamp — used in tests only. */
export function _resetActivityForTest(ts = Date.now()): void {
  _lastUserActivity = ts;
}
