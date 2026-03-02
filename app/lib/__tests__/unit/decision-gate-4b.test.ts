/**
 * Decision Gate — Sprint 4B Tests
 *
 * Coverage:
 *   - inferStructuredTriggers: happy path, fail-open on bad JSON, fail-open on API error
 *   - logGateApproval: calls logDecision with correct schema, calls releaseLock
 *   - decision-gate-store: expanded shape (dismissCount, setDismissCount)
 *   - analyze() integration: infers structured triggers via mocked inference
 *   - 423 enforcement: getLockState integration with lock state machine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockCreate = vi.hoisted(() => vi.fn());
const mockLogDecision = vi.hoisted(() => vi.fn());
const mockReleaseLock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

vi.mock('@/lib/kernl/decision-store', () => ({
  logDecision: mockLogDecision,
}));

// We mock only releaseLock from lock.ts for kernl-logger tests;
// the lock state machine itself is tested in decision-gate.test.ts.
vi.mock('@/lib/decision-gate/lock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/decision-gate/lock')>();
  return {
    ...actual,
    releaseLock: mockReleaseLock,
  };
});

// Suppress vector calls in analyze() integration tests
vi.mock('@/lib/vector', () => ({
  findSimilarChunks: vi.fn().mockResolvedValue([]),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { inferStructuredTriggers } from '@/lib/decision-gate/inference';
import { logGateApproval } from '@/lib/decision-gate/kernl-logger';
import { useDecisionGateStore } from '@/lib/stores/decision-gate-store';
import { analyze, getDecisionLock } from '@/lib/decision-gate';
import { _resetLockState, acquireLock } from '@/lib/decision-gate/lock';
import type { GateMessage } from '@/lib/decision-gate';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTextResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
  };
}

function userMsg(content: string): GateMessage {
  return { role: 'user', content };
}

function assistantMsg(content: string): GateMessage {
  return { role: 'assistant', content };
}

// ─── inferStructuredTriggers ──────────────────────────────────────────────────

describe('inferStructuredTriggers', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('parses clean JSON from Haiku and returns correct booleans', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse('{"highTradeoff": true, "multiProject": false, "largeEstimate": false}'),
    );

    const result = await inferStructuredTriggers([userMsg('should we use Redis or SQLite?')]);
    expect(result.highTradeoff).toBe(true);
    expect(result.multiProject).toBe(false);
    expect(result.largeEstimate).toBe(false);
  });

  it('parses JSON wrapped in markdown code fences', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse('```json\n{"highTradeoff": false, "multiProject": true, "largeEstimate": false}\n```'),
    );

    const result = await inferStructuredTriggers([userMsg('affects GregLite and KERNL MCP')]);
    expect(result.multiProject).toBe(true);
  });

  it('fails open (all false) when JSON is malformed', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('not valid json at all'));

    const result = await inferStructuredTriggers([userMsg('some message')]);
    expect(result).toEqual({ highTradeoff: false, multiProject: false, largeEstimate: false });
  });

  it('fails open when Anthropic API throws', async () => {
    mockCreate.mockRejectedValue(new Error('API unavailable'));

    const result = await inferStructuredTriggers([userMsg('some message')]);
    expect(result).toEqual({ highTradeoff: false, multiProject: false, largeEstimate: false });
  });

  it('returns all false for empty messages array', async () => {
    const result = await inferStructuredTriggers([]);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toEqual({ highTradeoff: false, multiProject: false, largeEstimate: false });
  });

  it('only sends last 5 messages to Haiku', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse('{"highTradeoff": false, "multiProject": false, "largeEstimate": false}'),
    );

    const messages: GateMessage[] = Array.from({ length: 10 }, (_, i) =>
      userMsg(`message ${i}`),
    );

    await inferStructuredTriggers(messages);

    expect(mockCreate).toHaveBeenCalledOnce();
    const callBody = mockCreate.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
    const userContent = callBody.messages[0]?.content ?? '';
    // Should contain "message 5" through "message 9" but not "message 0"
    expect(userContent).toContain('message 9');
    expect(userContent).not.toContain('message 0');
  });
});

// ─── logGateApproval ──────────────────────────────────────────────────────────

describe('logGateApproval', () => {
  beforeEach(() => {
    mockLogDecision.mockReset();
    mockReleaseLock.mockReset();
  });

  it('calls logDecision with correct schema fields for approved action', () => {
    logGateApproval('thread-abc', 'sacred_principle_risk', 'approved');

    expect(mockLogDecision).toHaveBeenCalledOnce();
    const arg = mockLogDecision.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.thread_id).toBe('thread-abc');
    expect(arg.category).toBe('decision-gate');
    expect(arg.title).toBe('Decision Gate approved: sacred_principle_risk');
    expect(arg.impact).toBe('high');
    expect(typeof arg.rationale).toBe('string');
  });

  it('uses provided rationale when given', () => {
    logGateApproval('thread-xyz', 'irreversible_action', 'overridden', 'I know what I am doing here');

    const arg = mockLogDecision.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.rationale).toBe('I know what I am doing here');
    expect(arg.title).toBe('Decision Gate overridden: irreversible_action');
  });

  it('falls back to default rationale when none provided', () => {
    logGateApproval('thread-xyz', 'low_confidence', 'approved');

    const arg = mockLogDecision.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.rationale).toContain('approved');
  });

  it('calls releaseLock after writing to KERNL', () => {
    logGateApproval('thread-abc', 'repeated_question', 'approved');

    expect(mockReleaseLock).toHaveBeenCalledOnce();
    // releaseLock must be called AFTER logDecision (KERNL write first)
    const logOrder = mockLogDecision.mock.invocationCallOrder[0]!;
    const releaseOrder = mockReleaseLock.mock.invocationCallOrder[0]!;
    expect(releaseOrder).toBeGreaterThan(logOrder);
  });
});

// ─── decision-gate-store expanded shape ──────────────────────────────────────

describe('useDecisionGateStore — Sprint 4B shape', () => {
  beforeEach(() => {
    useDecisionGateStore.getState().clearTrigger();
  });

  it('initialises with dismissCount = 0', () => {
    expect(useDecisionGateStore.getState().dismissCount).toBe(0);
  });

  it('setTrigger stores trigger and optional dismissCount', () => {
    const result = { triggered: true as const, trigger: 'low_confidence' as const, reason: 'test' };
    useDecisionGateStore.getState().setTrigger(result, 2);

    const state = useDecisionGateStore.getState();
    expect(state.trigger).toEqual(result);
    expect(state.dismissCount).toBe(2);
  });

  it('setTrigger defaults dismissCount to 0 when not provided', () => {
    const result = { triggered: true as const, trigger: 'low_confidence' as const, reason: 'test' };
    useDecisionGateStore.getState().setTrigger(result);

    expect(useDecisionGateStore.getState().dismissCount).toBe(0);
  });

  it('setDismissCount updates only the count', () => {
    const result = { triggered: true as const, trigger: 'repeated_question' as const, reason: 'r' };
    useDecisionGateStore.getState().setTrigger(result, 1);
    useDecisionGateStore.getState().setDismissCount(2);

    expect(useDecisionGateStore.getState().dismissCount).toBe(2);
    expect(useDecisionGateStore.getState().trigger).toEqual(result);
  });

  it('clearTrigger resets both trigger and dismissCount', () => {
    const result = { triggered: true as const, trigger: 'repeated_question' as const, reason: 'r' };
    useDecisionGateStore.getState().setTrigger(result, 2);
    useDecisionGateStore.getState().clearTrigger();

    expect(useDecisionGateStore.getState().trigger).toBeNull();
    expect(useDecisionGateStore.getState().dismissCount).toBe(0);
  });
});

// ─── 423 enforcement via lock state ──────────────────────────────────────────

describe('423 lock enforcement — getLockState integration', () => {
  beforeEach(() => {
    _resetLockState();
  });

  it('getLockState returns unlocked by default', () => {
    const state = getDecisionLock();
    expect(state.locked).toBe(false);
    expect(state.trigger).toBeNull();
  });

  it('getLockState returns locked after acquireLock', () => {
    acquireLock('sacred_principle_risk', 'test reason');
    const state = getDecisionLock();
    expect(state.locked).toBe(true);
    expect(state.trigger).toBe('sacred_principle_risk');
    expect(state.reason).toBe('test reason');
  });

  it('lock state is the signal that chat route uses to return 423', () => {
    // This mirrors the exact check in POST /api/chat:
    //   const lock = getDecisionLock();
    //   if (lock.locked) return 423
    acquireLock('irreversible_action', 'drop table detected');
    const lock = getDecisionLock();
    // If this is true, the route returns 423 — correct behaviour
    expect(lock.locked).toBe(true);
    expect(lock.trigger).toBe('irreversible_action');
  });
});

// ─── analyze() — Haiku stubs now live ────────────────────────────────────────

describe('analyze() — structured triggers via mocked inference', () => {
  beforeEach(() => {
    _resetLockState();
    mockCreate.mockReset();
  });

  it('triggers high_tradeoff_count when Haiku returns highTradeoff: true', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse('{"highTradeoff": true, "multiProject": false, "largeEstimate": false}'),
    );

    const messages: GateMessage[] = [
      assistantMsg('We need to weigh Redis vs SQLite vs Postgres vs in-memory vs file-based'),
    ];

    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('high_tradeoff_count');
  });

  it('triggers multi_project_touch when Haiku returns multiProject: true', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse('{"highTradeoff": false, "multiProject": true, "largeEstimate": false}'),
    );

    const messages: GateMessage[] = [
      userMsg('this would affect GregLite and the KERNL MCP server'),
    ];

    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('multi_project_touch');
  });

  it('triggers large_build_estimate when Haiku returns largeEstimate: true', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse('{"highTradeoff": false, "multiProject": false, "largeEstimate": true}'),
    );

    const messages: GateMessage[] = [
      userMsg('this refactor will probably take 4 or 5 sessions'),
    ];

    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('large_build_estimate');
  });

  it('does not trigger when all Haiku flags are false and no sync trigger fires', async () => {
    mockCreate.mockResolvedValue(
      makeTextResponse('{"highTradeoff": false, "multiProject": false, "largeEstimate": false}'),
    );

    const messages: GateMessage[] = [
      userMsg('what is the capital of France?'),
      assistantMsg('Paris.'),
    ];

    const result = await analyze(messages);
    expect(result.triggered).toBe(false);
  });

  it('sync triggers take precedence — Haiku not called when repeated_question fires', async () => {
    // 3 identical messages → repeated_question fires before inference
    const messages: GateMessage[] = [
      userMsg('how should we structure the database schema for authentication?'),
      userMsg('going back to the database schema for authentication question'),
      userMsg('still thinking about the database schema for authentication approach'),
    ];

    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('repeated_question');
    // Haiku should not be called — sync trigger short-circuits
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
