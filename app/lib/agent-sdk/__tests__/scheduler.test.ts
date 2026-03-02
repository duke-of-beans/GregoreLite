/**
 * scheduler.test.ts — Sprint 7E
 *
 * Tests for: priority-config, rate-limiter, SessionScheduler.
 *
 * DB is mocked — no real SQLite needed.
 * aegis-integrator is mocked — no real AEGIS needed.
 * budget-enforcer.getBudgetConfigNumber is mocked for rate-limiter capacity.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock DB ──────────────────────────────────────────────────────────────────

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockPrepare = vi.fn(() => ({ run: mockRun, get: mockGet, all: mockAll }));
const mockDb = { prepare: mockPrepare };

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

// ─── Mock AEGIS integrator ────────────────────────────────────────────────────

const mockNotify = vi.fn();
vi.mock('../aegis-integrator', () => ({
  notifyWorkerCountChanged: (...args: unknown[]) => mockNotify(...args),
}));

// ─── Mock budget-enforcer for rate-limiter capacity ──────────────────────────

vi.mock('../budget-enforcer', () => ({
  getBudgetConfigNumber: vi.fn((_key: string, fallback: number) => fallback),
  isDailyCapReached: vi.fn(() => false),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { getPriority, isBypassSession, MAX_CONCURRENT_SESSIONS } from '../priority-config';
import { RateLimiter } from '../rate-limiter';
import { SessionScheduler } from '../scheduler';
import type { TaskManifest } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeManifest(id: string, type: string): TaskManifest {
  return {
    manifest_id: id,
    version: '1.0',
    spawned_by: { thread_id: 't1', strategic_thread_id: 'st1', timestamp: new Date().toISOString() },
    task: {
      id, type: type as TaskManifest['task']['type'],
      title: `Task ${id}`, description: '', success_criteria: [],
    },
    context: { project_path: '/p', files: [], environment: {}, dependencies: [] },
    protocol: { output_format: 'json', reporting_interval: 30, max_duration: 60 },
    return_to_thread: { id: 't1', on_success: 'report', on_failure: 'report' },
    quality_gates: { shim_required: false, eos_required: false, tests_required: false },
    is_self_evolution: false,
  };
}

function makeScheduler(): SessionScheduler {
  SessionScheduler._resetForTests();
  return SessionScheduler.getInstance();
}

function noop(_manifest: TaskManifest, _onComplete: (id: string) => void) { /* no-op starter */ }

beforeEach(() => {
  vi.clearAllMocks();
  // Default: combined shape covers all callers (queue_position + cnt + active count queries)
  mockGet.mockReturnValue({ queue_position: 1, cnt: 0 });
  // Default: renumber returns empty pending list
  mockAll.mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
  SessionScheduler._resetForTests();
});

// ─── 1. priority-config ───────────────────────────────────────────────────────

describe('getPriority', () => {
  it('strategic_thread has priority 0', () => {
    expect(getPriority('strategic_thread')).toBe(0);
  });

  it('self_evolution has priority 1', () => {
    expect(getPriority('self_evolution')).toBe(1);
  });

  it('code and test share priority 2', () => {
    expect(getPriority('code')).toBe(2);
    expect(getPriority('test')).toBe(2);
  });

  it('docs/documentation/deploy share priority 3', () => {
    expect(getPriority('docs')).toBe(3);
    expect(getPriority('documentation')).toBe(3);
    expect(getPriority('deploy')).toBe(3);
  });

  it('research and analysis share priority 4', () => {
    expect(getPriority('research')).toBe(4);
    expect(getPriority('analysis')).toBe(4);
  });

  it('ghost has lowest priority 5', () => {
    expect(getPriority('ghost')).toBe(5);
  });

  it('unknown type falls back to 3 (documentation tier)', () => {
    expect(getPriority('some_future_type')).toBe(3);
  });

  it('priority ordering: self_evolution < code < research < ghost', () => {
    expect(getPriority('self_evolution')).toBeLessThan(getPriority('code'));
    expect(getPriority('code')).toBeLessThan(getPriority('research'));
    expect(getPriority('research')).toBeLessThan(getPriority('ghost'));
  });
});

describe('isBypassSession', () => {
  it('returns true only for strategic_thread', () => {
    expect(isBypassSession('strategic_thread')).toBe(true);
    expect(isBypassSession('self_evolution')).toBe(false);
    expect(isBypassSession('code')).toBe(false);
    expect(isBypassSession('ghost')).toBe(false);
  });
});

describe('MAX_CONCURRENT_SESSIONS', () => {
  it('is 8', () => {
    expect(MAX_CONCURRENT_SESSIONS).toBe(8);
  });
});

// ─── 2. RateLimiter ───────────────────────────────────────────────────────────

describe('RateLimiter', () => {
  it('is not throttled at 0% consumption', () => {
    const limiter = new RateLimiter();
    expect(limiter.isThrottled()).toBe(false);
    expect(limiter.getUsageRatio()).toBe(0);
  });

  it('is not throttled below 80% of capacity', () => {
    const limiter = new RateLimiter();
    limiter.consume(79_000); // 79% of 100k default
    expect(limiter.isThrottled()).toBe(false);
  });

  it('is throttled at exactly 80% consumption', () => {
    const limiter = new RateLimiter();
    limiter.consume(80_000);
    expect(limiter.isThrottled()).toBe(true);
  });

  it('is throttled above 80% consumption', () => {
    const limiter = new RateLimiter();
    limiter.consume(95_000);
    expect(limiter.isThrottled()).toBe(true);
  });

  it('getUsageRatio returns correct fraction', () => {
    const limiter = new RateLimiter();
    limiter.consume(50_000);
    expect(limiter.getUsageRatio()).toBeCloseTo(0.5, 3);
  });

  it('reset clears all consumption', () => {
    const limiter = new RateLimiter();
    limiter.consume(90_000);
    limiter.reset();
    expect(limiter.isThrottled()).toBe(false);
    expect(limiter.getUsageRatio()).toBe(0);
  });

  it('getUsedTokens returns total consumed', () => {
    const limiter = new RateLimiter();
    limiter.consume(10_000);
    limiter.consume(20_000);
    expect(limiter.getUsedTokens()).toBe(30_000);
  });

  it('ignores zero or negative consume calls', () => {
    const limiter = new RateLimiter();
    limiter.consume(0);
    limiter.consume(-100);
    expect(limiter.getUsedTokens()).toBe(0);
  });
});

// ─── 3. SessionScheduler ─────────────────────────────────────────────────────

describe('SessionScheduler — slot management', () => {
  it('starts 8 sessions immediately', () => {
    const sched = makeScheduler();
    const started: string[] = [];

    for (let i = 1; i <= 8; i++) {
      // Simulate active count growing: return i-1 for cnt query
      mockGet.mockReturnValue({ cnt: i - 1, queue_position: 1 });
      const result = sched.enqueue(makeManifest(`m${i}`, 'code'), (m, _onDone) => {
        started.push(m.manifest_id);
        // Don't call _onDone — session keeps running
      });
      expect(result.started).toBe(true);
      expect(result.queued).toBe(false);
    }
    expect(started).toHaveLength(8);
  });

  it('session 9 enters PENDING when 8 slots are full', () => {
    const sched = makeScheduler();
    // Fill all 8 slots (scheduler tracks active count in-memory via _running)
    for (let i = 1; i <= 8; i++) {
      sched.enqueue(makeManifest(`m${i}`, 'code'), noop);
    }
    expect(sched.getActiveCount()).toBe(8);

    // 9th session should be queued; mockGet provides the queue_position value
    mockGet.mockReturnValue({ queue_position: 1 });
    const result = sched.enqueue(makeManifest('m9', 'code'), noop);
    expect(result.started).toBe(false);
    expect(result.queued).toBe(true);
    expect(result.queuePosition).toBe(1);
  });

  it('active count increments correctly as sessions start', () => {
    const sched = makeScheduler();
    let capturedCount = 0;
    mockNotify.mockImplementation((n: number) => { capturedCount = n; });

    // First session: active count goes from 0 to 1
    mockGet.mockReturnValue({ cnt: 0, queue_position: 1 });
    sched.enqueue(makeManifest('m1', 'code'), noop);
    expect(capturedCount).toBe(1);
  });
});

describe('SessionScheduler — priority ordering', () => {
  it('self_evolution is promoted before code ahead of research', () => {
    const sched = makeScheduler();
    const promoted: string[] = [];

    // Fill all 8 slots first
    for (let i = 0; i < 8; i++) {
      mockGet.mockReturnValue({ cnt: i, queue_position: 1 });
      sched.enqueue(makeManifest(`running-${i}`, 'code'), noop);
    }

    // Enqueue 3 pending sessions out of priority order
    mockGet.mockReturnValue({ cnt: 8, queue_position: 3 });
    sched.enqueue(makeManifest('research-1', 'research'), noop);
    mockGet.mockReturnValue({ cnt: 8, queue_position: 2 });
    sched.enqueue(makeManifest('code-1', 'code'), noop);
    mockGet.mockReturnValue({ cnt: 8, queue_position: 1 });
    sched.enqueue(makeManifest('evo-1', 'self_evolution'), (_m, onDone) => {
      promoted.push(_m.manifest_id);
      onDone(_m.manifest_id);
    });

    const queue = sched.getPendingQueue();
    // self_evolution has priority 1, code has priority 2, research has priority 4
    expect(queue[0]?.sessionType).toBe('self_evolution');
  });
});

describe('SessionScheduler — strategic thread bypass', () => {
  it('strategic thread session starts immediately regardless of cap', () => {
    const sched = makeScheduler();
    // All 8 slots occupied
    mockGet.mockReturnValue({ cnt: 8, queue_position: 1 });

    let started = false;
    const result = sched.enqueue(
      makeManifest('strategic-1', 'strategic_thread' as TaskManifest['task']['type']),
      (_m, _onDone) => { started = true; },
    );

    expect(started).toBe(true);
    expect(result.started).toBe(true);
    expect(result.queued).toBe(false);
  });

  it('strategic thread does not count against the 8-slot cap', () => {
    const sched = makeScheduler();
    mockGet.mockReturnValue({ cnt: 8, queue_position: 1 });
    expect(sched.getActiveCount()).toBe(0); // bypass sessions not tracked

    sched.enqueue(
      makeManifest('strategic-1', 'strategic_thread' as TaskManifest['task']['type']),
      noop,
    );
    // Active count should still be 0 (bypass not tracked in _running)
    expect(sched.getActiveCount()).toBe(0);
  });
});

describe('SessionScheduler — promotion on complete', () => {
  it('completes session → promotes next pending', () => {
    const sched = makeScheduler();
    const promoted: string[] = [];

    // Start first session (slot 0 → 1)
    mockGet.mockReturnValue({ cnt: 0, queue_position: 1 });
    sched.enqueue(makeManifest('runner', 'code'), noop);

    // Queue a pending session
    mockGet.mockReturnValue({ cnt: 1, queue_position: 1 });
    sched.enqueue(makeManifest('waiter', 'code'), (_m, _onDone) => {
      promoted.push(_m.manifest_id);
    });

    // Complete the running session via public onComplete() — slot freed, next promoted
    mockGet.mockReturnValue({ cnt: 0, queue_position: null });
    sched.onComplete('runner');

    expect(promoted).toContain('waiter');
  });
});

describe('SessionScheduler — cancel', () => {
  it('cancels a pending session and removes from queue', () => {
    const sched = makeScheduler();

    // Fill all 8 slots so next session is queued (scheduler uses in-memory _running.size)
    for (let i = 1; i <= 8; i++) {
      sched.enqueue(makeManifest(`filler-${i}`, 'code'), noop);
    }
    mockGet.mockReturnValue({ queue_position: 1 });
    sched.enqueue(makeManifest('to-cancel', 'research'), noop);
    expect(sched.getPendingQueue()).toHaveLength(1);

    const cancelled = sched.cancel('to-cancel');
    expect(cancelled).toBe(true);
    expect(sched.getPendingQueue()).toHaveLength(0);
  });

  it('returns false when session not found', () => {
    const sched = makeScheduler();
    expect(sched.cancel('nonexistent')).toBe(false);
  });
});

describe('SessionScheduler — AEGIS notifications', () => {
  it('notifies on session start', () => {
    const sched = makeScheduler();
    mockGet.mockReturnValue({ cnt: 0, queue_position: 1 });
    sched.enqueue(makeManifest('m1', 'code'), noop);
    expect(mockNotify).toHaveBeenCalledWith(1);
  });

  it('notifies on session complete', () => {
    const sched = makeScheduler();

    mockGet.mockReturnValue({ cnt: 0, queue_position: 1 });
    sched.enqueue(makeManifest('m1', 'code'), noop);

    // Complete via public method — scheduler decrements count and notifies AEGIS
    sched.onComplete('m1');
    // After completion, active count drops back to 0
    expect(mockNotify).toHaveBeenLastCalledWith(0);
  });

  it('does not notify for strategic thread sessions', () => {
    const sched = makeScheduler();
    mockGet.mockReturnValue({ cnt: 8, queue_position: 1 });
    sched.enqueue(
      makeManifest('st', 'strategic_thread' as TaskManifest['task']['type']),
      noop,
    );
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe('SessionScheduler — rate limit queuing', () => {
  it('queues new session when rate limiter is throttled', async () => {
    // Import and override the rate limiter singleton for this test
    const { rateLimiter } = await import('../rate-limiter');
    rateLimiter.reset();
    rateLimiter.consume(80_000); // push to 80% throttle threshold

    const sched = makeScheduler();
    mockGet.mockReturnValue({ cnt: 0, queue_position: 1 }); // slots available but rate-limited

    const result = sched.enqueue(makeManifest('throttled', 'code'), noop);
    expect(result.queued).toBe(true);
    expect(result.throttled).toBe(true);

    rateLimiter.reset(); // clean up
  });
});
