/**
 * sprint-12-batch-executor.test.ts
 *
 * Sprint 12.0 — Batch API Executor
 *
 * Tests:
 *   1. Batch request uses manifestId as custom_id
 *   2. onComplete fires with 'completed' on successful batch result
 *   3. onError fires when batch result type is 'errored'
 *   4. Abort before batch create calls onComplete with 'interrupted'
 *
 * Uses vi.useFakeTimers() to skip the 30-second poll interval.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TaskManifest } from '../types';

// ─── vi.hoisted: ensure mock fns survive Vitest's vi.mock hoisting ────────────

const { mockBatchCreate, mockBatchRetrieve, mockBatchResults } = vi.hoisted(() => ({
  mockBatchCreate: vi.fn(),
  mockBatchRetrieve: vi.fn(),
  mockBatchResults: vi.fn(),
}));

// ─── Anthropic SDK mock ───────────────────────────────────────────────────────
// Must use a regular function (not arrow) — new Anthropic() requires a constructor.

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function MockAnthropic() {
    return {
      messages: {
        batches: {
          create: mockBatchCreate,
          retrieve: mockBatchRetrieve,
          results: mockBatchResults,
        },
      },
    };
  }),
}));

// ─── Mock DB ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn() })),
  })),
}));

// ─── Mock fs / pricing YAML ───────────────────────────────────────────────────

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn((filePath: unknown) => {
      if (typeof filePath === 'string' && filePath.endsWith('pricing.yaml')) {
        return `
models:
  claude-haiku-4-5-20251001:
    input_per_million: 0.80
    output_per_million: 4.00
`;
      }
      return actual.readFileSync(filePath as string);
    }),
    watch: vi.fn(),
    existsSync: actual.existsSync,
  };
});

// ─── Import after mocks ───────────────────────────────────────────────────────

import { runBatchSession } from '../batch-executor';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeManifest(id = 'test-manifest-001'): TaskManifest {
  return {
    manifest_id: id,
    version: '1.0',
    spawned_by: {
      thread_id: 'thread-1',
      strategic_thread_id: 'strat-1',
      timestamp: new Date().toISOString(),
    },
    task: {
      id: 'task-1',
      type: 'analysis',
      title: 'Analyse cost patterns',
      description: 'Review API cost data and identify optimisation opportunities.',
      success_criteria: ['Provide cost breakdown', 'Identify top 3 savings'],
    },
    context: {
      project_path: 'D:/Projects/GregLite/app',
      files: [],
      environment: {},
      dependencies: [],
    },
    protocol: {
      output_format: 'markdown',
      reporting_interval: 60,
      max_duration: 30,
      batch: true,
    },
    return_to_thread: {
      id: 'thread-1',
      on_success: 'report',
      on_failure: 'report',
    },
    quality_gates: {
      shim_required: false,
      eos_required: false,
      tests_required: false,
    },
    is_self_evolution: false,
  };
}

function makeCallbacks() {
  return {
    onStatusChange: vi.fn(),
    onStreamEvent: vi.fn(),
    onLogLine: vi.fn(),
    onComplete: vi.fn(),
    onError: vi.fn(),
  };
}

// ─── Async generator helper ───────────────────────────────────────────────────

async function* makeResultsGen(
  customId: string,
  type: 'succeeded' | 'errored' | 'expired',
  content = 'Done.',
) {
  if (type === 'succeeded') {
    yield {
      custom_id: customId,
      result: {
        type: 'succeeded',
        message: {
          content: [{ type: 'text', text: content }],
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
    };
  } else if (type === 'errored') {
    yield {
      custom_id: customId,
      result: {
        type: 'errored',
        error: { type: 'server_error', message: 'Internal error' },
      },
    };
  } else {
    yield { custom_id: customId, result: { type: 'expired' } };
  }
}

// ─── Helper: run session + advance fake timers past the 30s poll interval ─────

async function runWithTimerAdvance(
  manifest: TaskManifest,
  callbacks: ReturnType<typeof makeCallbacks>,
  signal = new AbortController().signal,
): Promise<void> {
  const promise = runBatchSession(manifest, signal, callbacks);
  // Advance past POLL_INTERVAL_MS (30s) so the poll loop resolves
  await vi.advanceTimersByTimeAsync(31_000);
  await promise;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Sprint 12.0 — runBatchSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default: batch create succeeds; single poll returns 'ended'
    mockBatchCreate.mockResolvedValue({ id: 'batch-test-001' });
    mockBatchRetrieve.mockResolvedValue({
      id: 'batch-test-001',
      processing_status: 'ended',
      request_counts: { processing: 0 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates batch request with manifestId as custom_id', async () => {
    const manifest = makeManifest('manifest-abc');
    const callbacks = makeCallbacks();
    mockBatchResults.mockReturnValue(makeResultsGen('manifest-abc', 'succeeded'));

    await runWithTimerAdvance(manifest, callbacks);

    expect(mockBatchCreate).toHaveBeenCalledOnce();
    const call = mockBatchCreate.mock.calls[0]?.[0] as { requests: Array<{ custom_id: string }> };
    expect(call?.requests?.[0]?.custom_id).toBe('manifest-abc');
  });

  it('calls onComplete with "completed" on successful batch result', async () => {
    const manifest = makeManifest('manifest-success');
    const callbacks = makeCallbacks();
    mockBatchResults.mockReturnValue(makeResultsGen('manifest-success', 'succeeded', 'Analysis complete.'));

    await runWithTimerAdvance(manifest, callbacks);

    expect(callbacks.onComplete).toHaveBeenCalledWith('manifest-success', 'completed');
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('calls onError when batch result type is "errored"', async () => {
    const manifest = makeManifest('manifest-error');
    const callbacks = makeCallbacks();
    mockBatchResults.mockReturnValue(makeResultsGen('manifest-error', 'errored'));

    await runWithTimerAdvance(manifest, callbacks);

    expect(callbacks.onError).toHaveBeenCalledOnce();
    const err = callbacks.onError.mock.calls[0]?.[1] as Error | undefined;
    expect(err?.message).toContain('errored');
    expect(callbacks.onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete with "interrupted" when abort fires before batch create', async () => {
    const manifest = makeManifest('manifest-abort');
    const callbacks = makeCallbacks();

    const controller = new AbortController();
    controller.abort(); // pre-aborted signal — short-circuits before batch create

    await runBatchSession(manifest, controller.signal, callbacks);

    expect(mockBatchCreate).not.toHaveBeenCalled();
    expect(callbacks.onComplete).toHaveBeenCalledWith('manifest-abort', 'interrupted');
  });
});
