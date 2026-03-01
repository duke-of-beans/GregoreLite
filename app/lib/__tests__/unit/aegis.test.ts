/**
 * Tests for app/lib/aegis/ — Sprint 2C
 *
 * Coverage:
 *   - determineProfile() all branches
 *   - AEGIS_PROFILE_MAP completeness + spot-checks
 *   - AEGISGovernor: callback dedup, anti-flap, start/stop idempotency
 *   - AEGIS lifecycle: initAEGIS / shutdownAEGIS / getAEGISStatus
 *
 * fetch is stubbed globally so no real network calls are made.
 * @/lib/kernl/aegis-store is mocked so no SQLite dependency.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks — must be declared with vi.hoisted() so they are available
// when vi.mock() factories execute (vi.mock is hoisted before const declarations) ──
const { mockLogAegisSignal } = vi.hoisted(() => ({
  mockLogAegisSignal: vi.fn(),
}));

vi.mock('@/lib/kernl/aegis-store', () => ({
  logAegisSignal: mockLogAegisSignal,
}));

// ── Global fetch stub (not hoisted, safe to declare inline) ───────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Imports must come after vi.mock() declarations ────────────────────────────
import { determineProfile, AEGISGovernor } from '@/lib/aegis/governor';
import { AEGIS_PROFILE_MAP, type WorkloadProfile } from '@/lib/aegis/types';
import { initAEGIS, shutdownAEGIS, getAEGISStatus } from '@/lib/aegis';

// ─── determineProfile ─────────────────────────────────────────────────────────

describe('determineProfile', () => {
  it('returns SUSPEND when isClosing is true', () => {
    expect(determineProfile({ activeWorkers: 0, hasActiveThread: false, isClosing: true }))
      .toBe('SUSPEND');
  });

  it('SUSPEND takes priority over workers and active thread', () => {
    expect(determineProfile({ activeWorkers: 5, hasActiveThread: true, isClosing: true }))
      .toBe('SUSPEND');
  });

  it('returns IDLE with no workers and no active thread', () => {
    expect(determineProfile({ activeWorkers: 0, hasActiveThread: false, isClosing: false }))
      .toBe('IDLE');
  });

  it('returns DEEP_FOCUS with no workers but active thread', () => {
    expect(determineProfile({ activeWorkers: 0, hasActiveThread: true, isClosing: false }))
      .toBe('DEEP_FOCUS');
  });

  it('returns COWORK_BATCH for 1 worker', () => {
    expect(determineProfile({ activeWorkers: 1, hasActiveThread: false, isClosing: false }))
      .toBe('COWORK_BATCH');
  });

  it('returns COWORK_BATCH for 2 workers (upper boundary)', () => {
    expect(determineProfile({ activeWorkers: 2, hasActiveThread: false, isClosing: false }))
      .toBe('COWORK_BATCH');
  });

  it('returns PARALLEL_BUILD for 3 workers (lower boundary)', () => {
    expect(determineProfile({ activeWorkers: 3, hasActiveThread: false, isClosing: false }))
      .toBe('PARALLEL_BUILD');
  });

  it('returns PARALLEL_BUILD for 10+ workers', () => {
    expect(determineProfile({ activeWorkers: 10, hasActiveThread: true, isClosing: false }))
      .toBe('PARALLEL_BUILD');
  });
});

// ─── AEGIS_PROFILE_MAP ────────────────────────────────────────────────────────

describe('AEGIS_PROFILE_MAP', () => {
  const ALL_PROFILES: WorkloadProfile[] = [
    'STARTUP', 'DEEP_FOCUS', 'CODE_GEN', 'COWORK_BATCH',
    'RESEARCH', 'BUILD', 'PARALLEL_BUILD', 'COUNCIL', 'IDLE', 'SUSPEND',
  ];

  it('has an AEGIS native profile entry for every WorkloadProfile', () => {
    for (const p of ALL_PROFILES) {
      expect(AEGIS_PROFILE_MAP[p], `Missing mapping for ${p}`).toBeTruthy();
    }
  });

  it('maps PARALLEL_BUILD → wartime (highest load)', () => {
    expect(AEGIS_PROFILE_MAP.PARALLEL_BUILD).toBe('wartime');
  });

  it('maps DEEP_FOCUS → deep-research', () => {
    expect(AEGIS_PROFILE_MAP.DEEP_FOCUS).toBe('deep-research');
  });

  it('maps CODE_GEN → performance', () => {
    expect(AEGIS_PROFILE_MAP.CODE_GEN).toBe('performance');
  });

  it('maps COWORK_BATCH → build-mode', () => {
    expect(AEGIS_PROFILE_MAP.COWORK_BATCH).toBe('build-mode');
  });

  it('maps IDLE → idle', () => {
    expect(AEGIS_PROFILE_MAP.IDLE).toBe('idle');
  });

  it('maps SUSPEND → idle (app closing treated as idle)', () => {
    expect(AEGIS_PROFILE_MAP.SUSPEND).toBe('idle');
  });

  it('maps STARTUP → idle', () => {
    expect(AEGIS_PROFILE_MAP.STARTUP).toBe('idle');
  });
});

// ─── AEGISGovernor ────────────────────────────────────────────────────────────

describe('AEGISGovernor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('forceEvaluate fires callback immediately', async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    const gov = new AEGISGovernor(cb);
    await gov.forceEvaluate('IDLE');
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith('IDLE');
  });

  it('forceEvaluate with same profile does not re-fire (dedup)', async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    const gov = new AEGISGovernor(cb);
    await gov.forceEvaluate('IDLE');
    await gov.forceEvaluate('IDLE');
    expect(cb).toHaveBeenCalledOnce();
  });

  it('forceEvaluate with different profile bypasses anti-flap and fires', async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    const gov = new AEGISGovernor(cb);
    await gov.forceEvaluate('IDLE');
    await gov.forceEvaluate('DEEP_FOCUS');
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith('DEEP_FOCUS');
  });

  it('getLastProfile returns null before any signals', () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    const gov = new AEGISGovernor(cb);
    expect(gov.getLastProfile()).toBeNull();
  });

  it('getLastProfile reflects most recent signal', async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    const gov = new AEGISGovernor(cb);
    await gov.forceEvaluate('DEEP_FOCUS');
    expect(gov.getLastProfile()).toBe('DEEP_FOCUS');
  });

  it('anti-flap: tick blocks profile change within 5000ms', async () => {
    vi.useFakeTimers();
    const cb = vi.fn().mockResolvedValue(undefined);
    const gov = new AEGISGovernor(cb);

    // Anchor lastSignalAt at t=0 via forceEvaluate (bypass=true)
    await gov.forceEvaluate('IDLE');
    expect(cb).toHaveBeenCalledTimes(1);

    // Change state so tick() would produce a different profile
    gov.updateState({ activeWorkers: 5 });
    gov.start();

    // Advance 4999ms — tick fires but anti-flap blocks it (< 5000ms elapsed)
    vi.advanceTimersByTime(4999);
    await Promise.resolve();
    await Promise.resolve();

    expect(cb).toHaveBeenCalledTimes(1); // no new signal
    gov.stop();
  });

  it('anti-flap: tick fires after 5000ms elapsed', async () => {
    vi.useFakeTimers();
    const cb = vi.fn().mockResolvedValue(undefined);
    const gov = new AEGISGovernor(cb);
    gov.start();

    // First tick at t=5000ms — IDLE state, lastSignalAt set
    vi.advanceTimersByTime(5000);
    await Promise.resolve();
    await Promise.resolve();
    const afterFirst = cb.mock.calls.length;

    // Change state then advance another 5000ms — anti-flap cleared
    gov.updateState({ activeWorkers: 3 });
    vi.advanceTimersByTime(5000);
    await Promise.resolve();
    await Promise.resolve();

    expect(cb.mock.calls.length).toBeGreaterThan(afterFirst);
    gov.stop();
  });

  it('start() is idempotent — multiple calls register only one interval', () => {
    vi.useFakeTimers();
    const cb = vi.fn().mockResolvedValue(undefined);
    const gov = new AEGISGovernor(cb);
    gov.start();
    gov.start();
    gov.start();
    // Should not throw or multiply intervals
    gov.stop();
  });

  it('stop() halts the polling loop', async () => {
    vi.useFakeTimers();
    const cb = vi.fn().mockResolvedValue(undefined);
    const gov = new AEGISGovernor(cb);
    gov.start();
    gov.stop();

    vi.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(cb).not.toHaveBeenCalled();
  });

  it('updateState patches only provided fields', async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    const gov = new AEGISGovernor(cb);
    gov.updateState({ activeWorkers: 2 });
    // hasActiveThread defaults to false, isClosing defaults to false
    // so determineProfile → COWORK_BATCH
    await gov.forceEvaluate(); // uses determineProfile(state)
    expect(cb).toHaveBeenCalledWith('COWORK_BATCH');
  });
});

// ─── AEGIS lifecycle ──────────────────────────────────────────────────────────

describe('AEGIS lifecycle (initAEGIS / shutdownAEGIS / getAEGISStatus)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    mockLogAegisSignal.mockReset();
  });

  afterEach(async () => {
    // switchProfile never throws so shutdown is always safe cleanup
    await shutdownAEGIS();
    vi.useRealTimers();
  });

  it('initAEGIS returns true when health check responds ok', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const online = await initAEGIS();
    expect(online).toBe(true);
  });

  it('initAEGIS returns false when AEGIS is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const online = await initAEGIS();
    expect(online).toBe(false);
  });

  it('initAEGIS logs STARTUP signal to KERNL regardless of AEGIS state', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    await initAEGIS();
    expect(mockLogAegisSignal).toHaveBeenCalledWith('STARTUP', undefined, false);
  });

  it('getAEGISStatus.online reflects health check result', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await initAEGIS();
    expect(getAEGISStatus().online).toBe(true);
  });

  it('getAEGISStatus.lastProfile is STARTUP immediately after init', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await initAEGIS();
    expect(getAEGISStatus().lastProfile).toBe('STARTUP');
  });

  it('shutdownAEGIS logs SUSPEND signal to KERNL', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await initAEGIS();
    mockLogAegisSignal.mockClear();
    await shutdownAEGIS();
    expect(mockLogAegisSignal).toHaveBeenCalledWith('SUSPEND', undefined, false);
  });

  it('initAEGIS does not throw when AEGIS is offline', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    await expect(initAEGIS()).resolves.toBe(false);
  });
});
