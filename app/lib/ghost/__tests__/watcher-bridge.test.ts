/**
 * watcher-bridge.test.ts — Sprint 6A
 *
 * Tests Ghost Thread TypeScript bridge:
 *   - startWatching / stopWatching invoke correct Tauri commands
 *   - onFileChange sets up the 'ghost:file-changed' listener
 *   - ghostPause / ghostResume invoke correct Tauri commands
 *   - loadWatchPaths falls back to defaults when KERNL not set
 *   - loadWatchPaths loads from KERNL settings on second run
 *   - AEGIS PARALLEL_BUILD triggers ghostPause
 *   - AEGIS COUNCIL triggers ghostPause
 *   - AEGIS non-intensive profile triggers ghostResume
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mock variables ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  // Cast to `any` — vi.fn generic constraints fight parameter contravariance in tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoke = (vi.fn() as any).mockResolvedValue(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listen = (vi.fn() as any).mockResolvedValue(() => undefined);
  return {
    invoke,
    listen,
    fetchJson: null as { value: string[] | null } | null,
    fetchOk: true,
  };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mocks.listen,
}));

// Mock KERNL aegis-store to prevent SQLite DB init during AEGIS integration tests
vi.mock('@/lib/kernl/aegis-store', () => ({
  logAegisSignal: vi.fn().mockReturnValue({
    id: 'mock-signal-id',
    profile: 'TEST',
    source_thread: null,
    sent_at: Date.now(),
    is_override: 0,
  }),
  getLatestAegisSignal: vi.fn().mockReturnValue(null),
}));

// Mock fetch globally for settings API calls
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// ── Import SUT after mocks ────────────────────────────────────────────────────

import {
  startWatching,
  stopWatching,
  onFileChange,
  ghostPause,
  ghostResume,
  type FileChangeEvent,
} from '../watcher-bridge';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFetchResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('watcher-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: settings not set (first run)
    fetchMock.mockResolvedValue(makeFetchResponse({ value: null }));
  });

  // ── startWatching ──────────────────────────────────────────────────────────

  describe('startWatching', () => {
    it('invokes ghost_start_watching with provided paths', async () => {
      const paths = ['D:\\Dev', 'D:\\Projects'];
      await startWatching(paths);

      expect(mocks.invoke).toHaveBeenCalledWith('ghost_start_watching', {
        paths,
      });
    });

    it('loads default paths from KERNL when no paths provided', async () => {
      // First run: KERNL returns null → use defaults
      fetchMock
        .mockResolvedValueOnce(makeFetchResponse({ value: null })) // GET
        .mockResolvedValueOnce(makeFetchResponse(null, true));      // POST (store defaults)

      await startWatching();

      expect(mocks.invoke).toHaveBeenCalledWith('ghost_start_watching', {
        paths: expect.arrayContaining(['D:\\Dev', 'D:\\Projects']),
      });
    });

    it('loads saved paths from KERNL when set', async () => {
      const savedPaths = ['C:\\CustomWork', 'D:\\Research'];
      fetchMock.mockResolvedValueOnce(makeFetchResponse({ value: savedPaths }));

      await startWatching();

      expect(mocks.invoke).toHaveBeenCalledWith('ghost_start_watching', {
        paths: savedPaths,
      });
    });

    it('falls back to defaults when fetch fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network error'));

      await startWatching();

      expect(mocks.invoke).toHaveBeenCalledWith('ghost_start_watching', {
        paths: expect.arrayContaining(['D:\\Dev', 'D:\\Projects']),
      });
    });

    it('does not throw when invoke fails', async () => {
      mocks.invoke.mockRejectedValueOnce(new Error('Tauri not available'));
      await expect(startWatching(['D:\\Dev'])).resolves.toBeUndefined();
    });
  });

  // ── stopWatching ───────────────────────────────────────────────────────────

  describe('stopWatching', () => {
    it('invokes ghost_stop_watching', async () => {
      await stopWatching();
      expect(mocks.invoke).toHaveBeenCalledWith('ghost_stop_watching');
    });

    it('does not throw when invoke fails', async () => {
      mocks.invoke.mockRejectedValueOnce(new Error('Tauri not available'));
      await expect(stopWatching()).resolves.toBeUndefined();
    });
  });

  // ── onFileChange ───────────────────────────────────────────────────────────

  describe('onFileChange', () => {
    it('calls listen with ghost:file-changed event name', () => {
      onFileChange(() => undefined);
      expect(mocks.listen).toHaveBeenCalledWith(
        'ghost:file-changed',
        expect.any(Function),
      );
    });

    it('returns an unlisten function', () => {
      const unlisten = onFileChange(() => undefined);
      expect(typeof unlisten).toBe('function');
    });

    it('calls handler when event fires', async () => {
      const handler = vi.fn();
      const mockEvent: FileChangeEvent = {
        path: 'D:\\Dev\\project\\src\\index.ts',
        kind: 'modified',
        timestamp_ms: Date.now(),
      };

      onFileChange(handler);

      // Retrieve the event callback via mock.calls — avoids CFA narrowing issues
      // with captured-in-callback variables
      const cb = mocks.listen.mock.calls[0]?.[1] as ((e: unknown) => void) | undefined;
      expect(cb).toBeDefined();
      cb!({ payload: mockEvent });

      expect(handler).toHaveBeenCalledWith(mockEvent);
    });
  });

  // ── ghostPause ─────────────────────────────────────────────────────────────

  describe('ghostPause', () => {
    it('invokes ghost_pause', async () => {
      await ghostPause();
      expect(mocks.invoke).toHaveBeenCalledWith('ghost_pause');
    });

    it('does not throw when invoke fails (non-Tauri env)', async () => {
      mocks.invoke.mockRejectedValueOnce(new Error('not in Tauri'));
      await expect(ghostPause()).resolves.toBeUndefined();
    });
  });

  // ── ghostResume ────────────────────────────────────────────────────────────

  describe('ghostResume', () => {
    it('invokes ghost_resume', async () => {
      await ghostResume();
      expect(mocks.invoke).toHaveBeenCalledWith('ghost_resume');
    });

    it('does not throw when invoke fails (non-Tauri env)', async () => {
      mocks.invoke.mockRejectedValueOnce(new Error('not in Tauri'));
      await expect(ghostResume()).resolves.toBeUndefined();
    });
  });
});

// ── AEGIS → Ghost integration ─────────────────────────────────────────────────

describe('AEGIS → Ghost integration', () => {
  // Test that the AEGIS switchProfile callback correctly calls ghost pause/resume
  // We test this by importing and calling the AEGIS module directly

  beforeEach(() => {
    vi.clearAllMocks();
    // Stub fetch for AEGIS HTTP calls
    fetchMock.mockResolvedValue(makeFetchResponse({ ok: true }));
  });

  it('calls ghost_pause when AEGIS transitions to PARALLEL_BUILD', async () => {
    // Import AEGIS and trigger a profile override
    const { overrideAEGISProfile } = await import('@/lib/aegis/index');
    await overrideAEGISProfile('PARALLEL_BUILD');
    expect(mocks.invoke).toHaveBeenCalledWith('ghost_pause');
  });

  it('calls ghost_pause when AEGIS transitions to COUNCIL', async () => {
    const { overrideAEGISProfile } = await import('@/lib/aegis/index');
    await overrideAEGISProfile('COUNCIL');
    expect(mocks.invoke).toHaveBeenCalledWith('ghost_pause');
  });

  it('calls ghost_resume when AEGIS transitions to IDLE', async () => {
    const { overrideAEGISProfile } = await import('@/lib/aegis/index');
    await overrideAEGISProfile('IDLE');
    expect(mocks.invoke).toHaveBeenCalledWith('ghost_resume');
  });

  it('calls ghost_resume when AEGIS transitions to DEEP_FOCUS', async () => {
    const { overrideAEGISProfile } = await import('@/lib/aegis/index');
    await overrideAEGISProfile('DEEP_FOCUS');
    expect(mocks.invoke).toHaveBeenCalledWith('ghost_resume');
  });

  it('calls ghost_resume when AEGIS transitions to COWORK_BATCH', async () => {
    const { overrideAEGISProfile } = await import('@/lib/aegis/index');
    await overrideAEGISProfile('COWORK_BATCH');
    expect(mocks.invoke).toHaveBeenCalledWith('ghost_resume');
  });
});
