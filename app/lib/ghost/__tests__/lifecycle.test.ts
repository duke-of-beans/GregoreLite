/**
 * Ghost Lifecycle Tests — Sprint 6F
 *
 * Tests cover:
 * - Startup sequence: components called in correct order
 * - Shutdown: reverse order with 5s timeout
 * - Degraded mode: one component failure does not block others
 * - Pause/resume: AEGIS profile change propagates
 * - Component restart: 30s delay, single retry, exhausted marking
 * - Status updates: state transitions emit correct values
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mock variables ───────────────────────────────────────────────────────

const {
  mockStartIngestQueue,
  mockStopIngestQueue,
  mockPauseIngestQueue,
  mockResumeIngestQueue,
  mockStartWatching,
  mockStopWatching,
  mockStartEmailPoller,
  mockStopEmailPoller,
  mockPauseEmailPoller,
  mockResumeEmailPoller,
  mockStartScorerSchedule,
  mockStopScorerSchedule,
  mockGetUserExclusions,
  mockGetDatabase,
  mockEmitGhostStatus,
  mockEmitGhostError,
  mockIsPollerRunning,
  mockGetActiveSuggestions,
  mockGetQueueDepth,
} = vi.hoisted(() => ({
  mockStartIngestQueue:     vi.fn(),
  mockStopIngestQueue:      vi.fn(),
  mockPauseIngestQueue:     vi.fn(),
  mockResumeIngestQueue:    vi.fn(),
  mockStartWatching:        vi.fn().mockResolvedValue(undefined),
  mockStopWatching:         vi.fn().mockResolvedValue(undefined),
  mockStartEmailPoller:     vi.fn(),
  mockStopEmailPoller:      vi.fn(),
  mockPauseEmailPoller:     vi.fn(),
  mockResumeEmailPoller:    vi.fn(),
  mockStartScorerSchedule:  vi.fn(),
  mockStopScorerSchedule:   vi.fn(),
  mockGetUserExclusions:    vi.fn().mockReturnValue([]),
  mockGetDatabase:          vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }),
  }),
  mockEmitGhostStatus:      vi.fn(),
  mockEmitGhostError:       vi.fn(),
  mockIsPollerRunning:      vi.fn().mockReturnValue(false),
  mockGetActiveSuggestions: vi.fn().mockReturnValue([]),
  mockGetQueueDepth:        vi.fn().mockReturnValue(0),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/ghost/ingest', () => ({
  startIngestQueue:   mockStartIngestQueue,
  stopIngestQueue:    mockStopIngestQueue,
  pauseIngestQueue:   mockPauseIngestQueue,
  resumeIngestQueue:  mockResumeIngestQueue,
  getQueueDepth:      mockGetQueueDepth,
}));

vi.mock('@/lib/ghost/watcher-bridge', () => ({
  startWatching: mockStartWatching,
  stopWatching:  mockStopWatching,
  ghostPause:    vi.fn().mockResolvedValue(undefined),
  ghostResume:   vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ghost/email/poller', () => ({
  startEmailPoller:  mockStartEmailPoller,
  stopEmailPoller:   mockStopEmailPoller,
  pauseEmailPoller:  mockPauseEmailPoller,
  resumeEmailPoller: mockResumeEmailPoller,
  isPollerRunning:   mockIsPollerRunning,
}));

vi.mock('@/lib/ghost/scorer', () => ({
  startScorerSchedule: mockStartScorerSchedule,
  stopScorerSchedule:  mockStopScorerSchedule,
  getActiveSuggestions: mockGetActiveSuggestions,
}));

vi.mock('@/lib/ghost/privacy/layer4', () => ({
  getUserExclusions: mockGetUserExclusions,
}));

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: mockGetDatabase,
}));

vi.mock('@/lib/ghost/ipc', () => ({
  emitGhostStatus: mockEmitGhostStatus,
  emitGhostError:  mockEmitGhostError,
}));

// ── Import SUT after mocks ────────────────────────────────────────────────────

// NOTE: lifecycle is imported via freshLifecycle() below (vi.resetModules pattern)
// to get a clean module state for each test. Static top-level imports would
// share module-level state (_started, _paused) across tests.

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reset all mock call counts and re-import lifecycle module state between tests. */
async function freshLifecycle() {
  vi.resetModules();
  // Re-import after module reset to get a fresh module instance
  return await import('../lifecycle');
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Ghost Lifecycle', () => {
  beforeEach(() => {
    mockStartIngestQueue.mockReset();
    mockStopIngestQueue.mockReset();
    mockPauseIngestQueue.mockReset();
    mockResumeIngestQueue.mockReset();
    mockStartWatching.mockReset().mockResolvedValue(undefined);
    mockStopWatching.mockReset().mockResolvedValue(undefined);
    mockStartEmailPoller.mockReset();
    mockStopEmailPoller.mockReset();
    mockPauseEmailPoller.mockReset();
    mockResumeEmailPoller.mockReset();
    mockStartScorerSchedule.mockReset();
    mockStopScorerSchedule.mockReset();
    mockGetUserExclusions.mockReset().mockReturnValue([]);
    mockEmitGhostStatus.mockReset();
    mockEmitGhostError.mockReset();
    mockGetDatabase.mockReturnValue({
      prepare: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue(undefined) }),
    });
    mockGetQueueDepth.mockReturnValue(0);
    mockGetActiveSuggestions.mockReturnValue([]);
    mockIsPollerRunning.mockReturnValue(false);
  });

  // ── Startup ────────────────────────────────────────────────────────────────

  describe('startGhost', () => {
    it('calls all components in the correct startup order', async () => {
      const lc = await freshLifecycle();
      const callOrder: string[] = [];
      mockStartIngestQueue.mockImplementation(() => { callOrder.push('ingest'); });
      mockGetUserExclusions.mockImplementation(() => { callOrder.push('exclusions'); return []; });
      mockStartWatching.mockImplementation(async () => { callOrder.push('watcher'); });
      mockStartEmailPoller.mockImplementation(() => { callOrder.push('email'); });
      mockStartScorerSchedule.mockImplementation(() => { callOrder.push('scorer'); });

      await lc.startGhost();

      expect(callOrder).toEqual(['ingest', 'exclusions', 'watcher', 'email', 'scorer']);
    });

    it('emits state: "running" when all steps succeed', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();

      const lastEmit = mockEmitGhostStatus.mock.calls.at(-1)?.[0] as { state: string } | undefined;
      expect(lastEmit?.state).toBe('running');
    });

    it('emits state: "starting" then "running"', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();

      const states = mockEmitGhostStatus.mock.calls.map((c) => (c[0] as { state: string }).state);
      expect(states[0]).toBe('starting');
      expect(states.at(-1)).toBe('running');
    });

    it('is idempotent — calling twice does not double-start components', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      await lc.startGhost();

      expect(mockStartIngestQueue).toHaveBeenCalledTimes(1);
    });
  });

  // ── Degraded mode ──────────────────────────────────────────────────────────

  describe('degraded mode', () => {
    it('continues startup when one component throws', async () => {
      const lc = await freshLifecycle();
      mockStartEmailPoller.mockImplementation(() => {
        throw new Error('OAuth expired');
      });

      await lc.startGhost();

      // Scorer should still start despite email failure
      expect(mockStartScorerSchedule).toHaveBeenCalledTimes(1);
    });

    it('emits state: "degraded" when a component fails', async () => {
      const lc = await freshLifecycle();
      mockStartWatching.mockRejectedValue(new Error('Tauri IPC unavailable'));

      await lc.startGhost();

      const lastEmit = mockEmitGhostStatus.mock.calls.at(-1)?.[0] as { state: string } | undefined;
      expect(lastEmit?.state).toBe('degraded');
    });

    it('emits ghost:error for the failing component', async () => {
      const lc = await freshLifecycle();
      mockStartEmailPoller.mockImplementation(() => {
        throw new Error('Connector auth failed');
      });

      await lc.startGhost();

      expect(mockEmitGhostError).toHaveBeenCalledWith('email-poller', 'Connector auth failed');
    });
  });

  // ── Shutdown ───────────────────────────────────────────────────────────────

  describe('stopGhost', () => {
    it('stops components in reverse startup order', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();

      const callOrder: string[] = [];
      mockStopScorerSchedule.mockImplementation(() => { callOrder.push('scorer'); });
      mockStopEmailPoller.mockImplementation(() => { callOrder.push('email'); });
      mockStopWatching.mockImplementation(async () => { callOrder.push('watcher'); });
      mockStopIngestQueue.mockImplementation(() => { callOrder.push('ingest'); });

      await lc.stopGhost();

      expect(callOrder).toEqual(['scorer', 'email', 'watcher', 'ingest']);
    });

    it('emits state: "stopped" after shutdown', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      mockEmitGhostStatus.mockReset();
      await lc.stopGhost();

      const lastEmit = mockEmitGhostStatus.mock.calls.at(-1)?.[0] as { state: string } | undefined;
      expect(lastEmit?.state).toBe('stopped');
    });

    it('is idempotent — calling twice does not error', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      await lc.stopGhost();
      await expect(lc.stopGhost()).resolves.toBeUndefined();
    });

    it('resolves within 5 seconds even if watcher hangs', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      // Watcher never resolves
      mockStopWatching.mockImplementation(() => new Promise(() => {}));

      vi.useFakeTimers();
      const stopPromise = lc.stopGhost();
      await vi.runAllTimersAsync();
      await expect(stopPromise).resolves.toBeUndefined();
      vi.useRealTimers();
    }, 10000);
  });

  // ── Pause / resume ─────────────────────────────────────────────────────────

  describe('pauseGhost / resumeGhost', () => {
    it('pauses email poller and ingest queue', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      lc.pauseGhost();

      expect(mockPauseEmailPoller).toHaveBeenCalledTimes(1);
      expect(mockPauseIngestQueue).toHaveBeenCalledTimes(1);
    });

    it('emits state: "paused" after pause', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      mockEmitGhostStatus.mockReset();
      lc.pauseGhost();

      const lastEmit = mockEmitGhostStatus.mock.calls.at(-1)?.[0] as { state: string } | undefined;
      expect(lastEmit?.state).toBe('paused');
    });

    it('is idempotent — calling pauseGhost twice only pauses once', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      lc.pauseGhost();
      lc.pauseGhost();

      expect(mockPauseEmailPoller).toHaveBeenCalledTimes(1);
    });

    it('resumes email poller and ingest queue', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      lc.pauseGhost();
      lc.resumeGhost();

      expect(mockResumeEmailPoller).toHaveBeenCalledTimes(1);
      expect(mockResumeIngestQueue).toHaveBeenCalledTimes(1);
    });

    it('emits state: "running" after resume (no errors)', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      lc.pauseGhost();
      mockEmitGhostStatus.mockReset();
      lc.resumeGhost();

      const lastEmit = mockEmitGhostStatus.mock.calls.at(-1)?.[0] as { state: string } | undefined;
      expect(lastEmit?.state).toBe('running');
    });

    it('is idempotent — calling resumeGhost when not paused is a no-op', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      lc.resumeGhost(); // not paused yet

      expect(mockResumeEmailPoller).not.toHaveBeenCalled();
    });
  });

  // ── isGhostRunning / isGhostPaused ────────────────────────────────────────

  describe('state flags', () => {
    it('isGhostRunning returns false before start', async () => {
      const lc = await freshLifecycle();
      expect(lc.isGhostRunning()).toBe(false);
    });

    it('isGhostRunning returns true after startGhost', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      expect(lc.isGhostRunning()).toBe(true);
    });

    it('isGhostRunning returns false after stopGhost', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      await lc.stopGhost();
      expect(lc.isGhostRunning()).toBe(false);
    });

    it('isGhostPaused returns false before any pause', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      expect(lc.isGhostPaused()).toBe(false);
    });

    it('isGhostPaused returns true after pauseGhost', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      lc.pauseGhost();
      expect(lc.isGhostPaused()).toBe(true);
    });

    it('isGhostPaused returns false after resumeGhost', async () => {
      const lc = await freshLifecycle();
      await lc.startGhost();
      lc.pauseGhost();
      lc.resumeGhost();
      expect(lc.isGhostPaused()).toBe(false);
    });
  });

  // ── Component restart ──────────────────────────────────────────────────────

  describe('restartComponent', () => {
    it('calls startFn after the 30-second delay', async () => {
      const lc = await freshLifecycle();
      const startFn = vi.fn().mockResolvedValue(undefined);

      vi.useFakeTimers();
      const restartPromise = lc.restartComponent('test-component', startFn);
      expect(startFn).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(30_000);
      await restartPromise;
      vi.useRealTimers();

      expect(startFn).toHaveBeenCalledTimes(1);
    });

    it('does not retry if first restart succeeds', async () => {
      const lc = await freshLifecycle();
      const startFn = vi.fn().mockResolvedValue(undefined);

      vi.useFakeTimers();
      const restartPromise = lc.restartComponent('scorer', startFn);
      await vi.advanceTimersByTimeAsync(30_000);
      await restartPromise;

      // Second call should be a no-op (exhausted)
      const restartPromise2 = lc.restartComponent('scorer', startFn);
      await vi.advanceTimersByTimeAsync(30_000);
      await restartPromise2;
      vi.useRealTimers();

      expect(startFn).toHaveBeenCalledTimes(1);
    });

    it('emits ghost:error if restart also fails', async () => {
      const lc = await freshLifecycle();
      const startFn = vi.fn().mockRejectedValue(new Error('Still broken'));

      vi.useFakeTimers();
      const restartPromise = lc.restartComponent('watcher', startFn);
      await vi.advanceTimersByTimeAsync(30_000);
      await restartPromise;
      vi.useRealTimers();

      expect(mockEmitGhostError).toHaveBeenCalledWith(
        'watcher',
        expect.stringContaining('Still broken'),
      );
    });
  });
});
