/**
 * Priority Config — Sprint 7E
 *
 * Maps session type strings to numeric priority values.
 * Lower number = higher priority (min-heap convention).
 *
 * 'strategic_thread' (priority 0) is special — the scheduler bypasses the
 * queue entirely for these sessions; they never count against the 8-slot cap.
 * All other priorities are enforced by the priority queue.
 */

/** Numeric priority for every known session type. Lower = runs sooner. */
export const SESSION_PRIORITY: Record<string, number> = {
  strategic_thread: 0, // bypass only — never actually enqueued
  self_evolution:   1,
  code:             2,
  test:             2,
  documentation:    3,
  docs:             3, // alias used by existing TaskType
  deploy:           3,
  research:         4,
  analysis:         4,
  ghost:            5, // lowest — paused first when slots are scarce
};

/** Maximum number of sessions that may run concurrently (BLUEPRINT §4.3.6). */
export const MAX_CONCURRENT_SESSIONS = 8;

/**
 * Returns the numeric priority for the given session type.
 * Falls back to 3 (documentation tier) for unknown types.
 */
export function getPriority(sessionType: string): number {
  return SESSION_PRIORITY[sessionType] ?? 3;
}

/**
 * Returns true when the session type bypasses the queue entirely.
 * Strategic thread sessions represent David's main conversation and must
 * never be blocked.
 */
export function isBypassSession(sessionType: string): boolean {
  return sessionType === 'strategic_thread';
}
