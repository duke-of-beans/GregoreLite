/**
 * Tests for lib/startup/client.ts — Sprint 31.0
 *
 * Coverage:
 *   Dev-mode (no Tauri runtime):
 *     - isStartupRegistered() returns false without throwing
 *     - registerStartup() resolves without throwing
 *     - unregisterStartup() resolves without throwing
 *
 *   Tauri runtime present:
 *     - isStartupRegistered() invokes 'startup_is_registered' and returns result
 *     - registerStartup() invokes 'startup_register'
 *     - unregisterStartup() invokes 'startup_unregister'
 *     - isStartupRegistered() returns false when invoke throws (never crashes)
 *     - registerStartup() propagates errors from invoke
 *     - unregisterStartup() propagates errors from invoke
 *
 * Environment: vitest global = node. We manipulate globalThis.window to
 * simulate presence / absence of the Tauri runtime without requiring jsdom.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

type GlobalWithWindow = typeof globalThis & { window?: { __TAURI_INTERNALS__?: unknown } };

/** Simulate Tauri runtime being absent (plain Node / Next.js dev). */
function removeTauriRuntime() {
  delete (globalThis as GlobalWithWindow).window;
}

/** Simulate Tauri runtime being present with the internals sentinel. */
function addTauriRuntime() {
  (globalThis as GlobalWithWindow).window = { __TAURI_INTERNALS__: {} };
}

// ── Mock @tauri-apps/api/core ─────────────────────────────────────────────────
// vi.mock is hoisted by vitest — this mock is in place before any dynamic
// import of '@tauri-apps/api/core' that the module under test performs.

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// ── Import module under test AFTER mocks are set up ──────────────────────────

import {
  isStartupRegistered,
  registerStartup,
  unregisterStartup,
} from '@/lib/startup/client';

// ── Test suite ────────────────────────────────────────────────────────────────

describe('startup/client — dev mode (no Tauri runtime)', () => {
  beforeEach(() => {
    removeTauriRuntime();
    mockInvoke.mockReset();
  });

  afterEach(() => {
    removeTauriRuntime();
  });

  it('isStartupRegistered() returns false without invoking Tauri', async () => {
    const result = await isStartupRegistered();
    expect(result).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('registerStartup() resolves silently without invoking Tauri', async () => {
    await expect(registerStartup()).resolves.toBeUndefined();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('unregisterStartup() resolves silently without invoking Tauri', async () => {
    await expect(unregisterStartup()).resolves.toBeUndefined();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('startup/client — Tauri runtime present', () => {
  beforeEach(() => {
    addTauriRuntime();
    mockInvoke.mockReset();
  });

  afterEach(() => {
    removeTauriRuntime();
  });

  // ── isStartupRegistered ───────────────────────────────────────────────────

  it('isStartupRegistered() invokes startup_is_registered and returns true', async () => {
    mockInvoke.mockResolvedValueOnce(true);
    const result = await isStartupRegistered();
    expect(mockInvoke).toHaveBeenCalledWith('startup_is_registered', undefined);
    expect(result).toBe(true);
  });

  it('isStartupRegistered() invokes startup_is_registered and returns false', async () => {
    mockInvoke.mockResolvedValueOnce(false);
    const result = await isStartupRegistered();
    expect(result).toBe(false);
  });

  it('isStartupRegistered() returns false (not throws) when invoke rejects', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('registry read failed'));
    const result = await isStartupRegistered();
    expect(result).toBe(false);
  });

  // ── registerStartup ───────────────────────────────────────────────────────

  it('registerStartup() invokes startup_register', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await registerStartup();
    expect(mockInvoke).toHaveBeenCalledWith('startup_register', undefined);
  });

  it('registerStartup() propagates error from invoke', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('access denied'));
    await expect(registerStartup()).rejects.toThrow('access denied');
  });

  // ── unregisterStartup ─────────────────────────────────────────────────────

  it('unregisterStartup() invokes startup_unregister', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await unregisterStartup();
    expect(mockInvoke).toHaveBeenCalledWith('startup_unregister', undefined);
  });

  it('unregisterStartup() propagates error from invoke', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('key not found'));
    await expect(unregisterStartup()).rejects.toThrow('key not found');
  });
});
