/**
 * Tests for app/lib/agent-sdk/ — Sprint 2A
 *
 * Coverage:
 *   - TASK_PRIORITY values and relative ordering
 *   - AGENT_COST_CONFIG boundary invariants
 *   - buildManifest() structure, defaults, exactOptionalPropertyTypes
 *   - buildAgentSystemPrompt() BLUEPRINT §4.3.1 format
 *   - validateManifest() happy path + ZodError on bad input
 *   - CostTracker: session lifecycle, cap thresholds, daily reset
 *   - job-tracker: insertManifest, transitionState, markStaleJobsInterrupted
 *   - Public API: spawn, kill, status, list (in-memory queue logic)
 *
 * @/lib/kernl/database is mocked — no real SQLite dependency.
 * @/lib/agent-sdk/executor is mocked — no real Anthropic API calls.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── DB mock (must be declared before imports) ─────────────────────────────────
const { mockRun, mockGet, mockAll, mockPrepare } = vi.hoisted(() => {
  const mockRun  = vi.fn().mockReturnValue({ changes: 1 });
  const mockGet  = vi.fn().mockReturnValue(null);
  const mockAll  = vi.fn().mockReturnValue([]);
  const mockStmt = { run: mockRun, get: mockGet, all: mockAll };
  const mockPrepare = vi.fn().mockReturnValue(mockStmt);
  return { mockRun, mockGet, mockAll, mockPrepare };
});

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: () => ({ prepare: mockPrepare }),
}));

// ── Executor mock ─────────────────────────────────────────────────────────────
const { mockRunSession } = vi.hoisted(() => ({
  mockRunSession: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/agent-sdk/executor', () => ({
  runSession: mockRunSession,
}));

// ── Imports (after vi.mock declarations) ──────────────────────────────────────
import { TASK_PRIORITY }     from '@/lib/agent-sdk/types';
import { AGENT_COST_CONFIG } from '@/lib/agent-sdk/config';
import {
  buildManifest,
  buildAgentSystemPrompt,
  validateManifest,
} from '@/lib/agent-sdk/manifest';
import { CostTracker }       from '@/lib/agent-sdk/cost-tracker';
import {
  insertManifest,
  transitionState,
  markStaleJobsInterrupted,
  getManifestRow,
} from '@/lib/agent-sdk/job-tracker';
import { spawn, kill, status, list } from '@/lib/agent-sdk/index';

// ─── Shared test manifest factory ────────────────────────────────────────────

function makeManifestOpts(overrides: Record<string, unknown> = {}) {
  return {
    threadId:           'thread-test-1',
    strategicThreadId:  'strat-1',
    taskType:           'code' as const,
    title:              'Test task',
    description:        'Write tests',
    successCriteria:    ['All tests pass'],
    projectPath:        '/proj',
    ...overrides,
  };
}

// ─── TASK_PRIORITY ────────────────────────────────────────────────────────────

describe('TASK_PRIORITY', () => {
  it('self_evolution has the highest priority', () => {
    const values = Object.values(TASK_PRIORITY);
    expect(TASK_PRIORITY.self_evolution).toBe(Math.max(...values));
  });

  it('self_evolution = 90', () => {
    expect(TASK_PRIORITY.self_evolution).toBe(90);
  });

  it('code and test are tied at 70', () => {
    expect(TASK_PRIORITY.code).toBe(70);
    expect(TASK_PRIORITY.test).toBe(70);
  });

  it('deploy = 60', () => {
    expect(TASK_PRIORITY.deploy).toBe(60);
  });

  it('docs and research are tied at lowest (40)', () => {
    expect(TASK_PRIORITY.docs).toBe(40);
    expect(TASK_PRIORITY.research).toBe(40);
  });
});

// ─── AGENT_COST_CONFIG ────────────────────────────────────────────────────────

describe('AGENT_COST_CONFIG', () => {
  it('warnAt < softCap < hardCap (boundary ordering)', () => {
    expect(AGENT_COST_CONFIG.perSessionWarnAtUsd)
      .toBeLessThan(AGENT_COST_CONFIG.perSessionSoftCapUsd);
    expect(AGENT_COST_CONFIG.perSessionSoftCapUsd)
      .toBeLessThan(AGENT_COST_CONFIG.dailyHardCapUsd);
  });

  it('maxConcurrentSessions = 8', () => {
    expect(AGENT_COST_CONFIG.maxConcurrentSessions).toBe(8);
  });

  it('perSessionWarnAt = $1.60', () => {
    expect(AGENT_COST_CONFIG.perSessionWarnAtUsd).toBe(1.60);
  });

  it('perSessionSoftCap = $2.00', () => {
    expect(AGENT_COST_CONFIG.perSessionSoftCapUsd).toBe(2.00);
  });

  it('dailyHardCap = $15.00', () => {
    expect(AGENT_COST_CONFIG.dailyHardCapUsd).toBe(15.00);
  });
});

// ─── buildManifest ────────────────────────────────────────────────────────────

describe('buildManifest', () => {
  it('returns a manifest with correct structural shape', () => {
    const m = buildManifest(makeManifestOpts());
    expect(m.manifest_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.version).toBe('1.0');
    expect(m.task.type).toBe('code');
    expect(m.task.title).toBe('Test task');
    expect(m.task.success_criteria).toEqual(['All tests pass']);
    expect(m.spawned_by.thread_id).toBe('thread-test-1');
  });

  it('defaults is_self_evolution to false', () => {
    const m = buildManifest(makeManifestOpts());
    expect(m.is_self_evolution).toBe(false);
  });

  it('sets is_self_evolution and branch when provided', () => {
    const m = buildManifest(makeManifestOpts({
      isSelfEvolution: true,
      selfEvolutionBranch: 'feature/self-evo',
    }));
    expect(m.is_self_evolution).toBe(true);
    expect(m.self_evolution_branch).toBe('feature/self-evo');
  });

  it('does NOT set self_evolution_branch key when not provided (exactOptionalPropertyTypes)', () => {
    const m = buildManifest(makeManifestOpts());
    expect(Object.prototype.hasOwnProperty.call(m, 'self_evolution_branch')).toBe(false);
  });

  it('does NOT set dependency_graph_notes when not provided', () => {
    const m = buildManifest(makeManifestOpts());
    expect(Object.prototype.hasOwnProperty.call(m.context, 'dependency_graph_notes')).toBe(false);
  });

  it('sets dependency_graph_notes when provided', () => {
    const m = buildManifest(makeManifestOpts({ dependencyGraphNotes: 'uses zod' }));
    expect(m.context.dependency_graph_notes).toBe('uses zod');
  });

  it('throws ZodError when taskType is invalid', () => {
    expect(() =>
      buildManifest(makeManifestOpts({ taskType: 'invalid_type' as never }))
    ).toThrow();
  });
});

// ─── buildAgentSystemPrompt ───────────────────────────────────────────────────

describe('buildAgentSystemPrompt', () => {
  it('contains SYSTEM CONTRACT marker (BLUEPRINT §4.3.1)', () => {
    const m = buildManifest(makeManifestOpts());
    const prompt = buildAgentSystemPrompt(m);
    expect(prompt).toContain('SYSTEM CONTRACT');
  });

  it('embeds the manifest JSON between delimiters', () => {
    const m = buildManifest(makeManifestOpts());
    const prompt = buildAgentSystemPrompt(m);
    expect(prompt).toContain('--- BEGIN SYSTEM MANIFEST (JSON) ---');
    expect(prompt).toContain('--- END SYSTEM MANIFEST ---');
    expect(prompt).toContain(m.manifest_id);
  });

  it('references the configured model', () => {
    const m = buildManifest(makeManifestOpts());
    const prompt = buildAgentSystemPrompt(m);
    expect(prompt).toContain(AGENT_COST_CONFIG.defaultModel);
  });
});

// ─── validateManifest ─────────────────────────────────────────────────────────

describe('validateManifest', () => {
  it('returns the manifest unchanged on valid input', () => {
    const m = buildManifest(makeManifestOpts());
    const validated = validateManifest(m as unknown);
    expect(validated.manifest_id).toBe(m.manifest_id);
  });

  it('throws ZodError on missing required field', () => {
    expect(() => validateManifest({ version: '1.0' })).toThrow();
  });

  it('throws ZodError on wrong task_type value', () => {
    const m = buildManifest(makeManifestOpts());
    expect(() =>
      validateManifest({ ...m, task: { ...m.task, type: 'unknown' } })
    ).toThrow();
  });
});

// ─── CostTracker ─────────────────────────────────────────────────────────────

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it('startSession returns a non-empty sessionId', () => {
    const id = tracker.startSession('claude-sonnet-4-5-20250929');
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('getSessionState returns zero cost before any usage', () => {
    const id = tracker.startSession('claude-sonnet-4-5-20250929');
    const state = tracker.getSessionState(id);
    expect(state?.totalCostUsd).toBe(0);
    expect(state?.inputTokens).toBe(0);
  });

  it('recordUsage accumulates tokens and cost', () => {
    const id = tracker.startSession('claude-sonnet-4-5-20250929');
    tracker.recordUsage(id, { inputTokens: 1000, outputTokens: 500 });
    tracker.recordUsage(id, { inputTokens: 500,  outputTokens: 250 });
    const state = tracker.getSessionState(id);
    expect(state?.inputTokens).toBe(1500);
    expect(state?.outputTokens).toBe(750);
    expect(state?.totalCostUsd).toBeGreaterThan(0);
  });

  it('getCostCapStatus returns ok when cost is zero', () => {
    const id = tracker.startSession('claude-sonnet-4-5-20250929');
    expect(tracker.getCostCapStatus(id)).toBe('ok');
  });

  it('isDailyCapReached returns false with zero usage', () => {
    expect(tracker.isDailyCapReached()).toBe(false);
  });

  it('endSession returns final state and marks session ended', () => {
    const id = tracker.startSession('claude-sonnet-4-5-20250929');
    tracker.recordUsage(id, { inputTokens: 100, outputTokens: 50 });
    const final = tracker.endSession(id);
    expect(final).not.toBeNull();
    expect(final?.totalCostUsd).toBeGreaterThan(0);
    // After ending, session state should be gone
    expect(tracker.getSessionState(id)).toBeNull();
  });

  it('resetDailyTotal sets daily total back to zero', () => {
    const id = tracker.startSession('claude-sonnet-4-5-20250929');
    tracker.recordUsage(id, { inputTokens: 100000, outputTokens: 50000 });
    tracker.endSession(id);
    tracker.resetDailyTotal();
    expect(tracker.getDailyTotalUsd()).toBe(0);
  });
});

// ─── job-tracker ──────────────────────────────────────────────────────────────

describe('job-tracker', () => {
  beforeEach(() => {
    mockRun.mockClear();
    mockGet.mockClear();
    mockAll.mockClear();
    mockPrepare.mockClear();
  });

  it('insertManifest calls prepare().run() with manifest_id in params', () => {
    const m = buildManifest(makeManifestOpts());
    insertManifest(m);
    expect(mockPrepare).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalled();
    // run() is called with a named-param object; id should equal manifest_id
    const params = mockRun.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params['id']).toBe(m.manifest_id);
    expect(params['status']).toBe('spawning');
  });

  it('transitionState calls prepare().run() with lowercased status', () => {
    transitionState('manifest-abc', 'RUNNING');
    expect(mockRun).toHaveBeenCalled();
    const params = mockRun.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params['status']).toBe('running');
    expect(params['id']).toBe('manifest-abc');
  });

  it('markStaleJobsInterrupted calls prepare().run() and returns a number', () => {
    mockRun.mockReturnValueOnce({ changes: 3 });
    const count = markStaleJobsInterrupted();
    expect(typeof count).toBe('number');
    expect(count).toBe(3);
  });

  it('getManifestRow returns null when DB returns undefined', () => {
    mockGet.mockReturnValueOnce(undefined);
    const row = getManifestRow('nonexistent-id');
    expect(row).toBeNull();
  });
});

// ─── Agent SDK public API (spawn / kill / status / list) ─────────────────────

describe('Agent SDK public API', () => {
  const spawnedIds: string[] = [];

  afterEach(() => {
    // Clean up any jobs created during tests
    for (const id of spawnedIds) {
      kill(id);
    }
    spawnedIds.length = 0;
    mockRunSession.mockClear();
  });

  it('spawn returns a jobId and queued=false for the first job', () => {
    const m = buildManifest(makeManifestOpts());
    const result = spawn(m);
    spawnedIds.push(result.jobId);
    expect(result.jobId).toBeTruthy();
    expect(result.queued).toBe(false);
  });

  it('status returns a JobRecord immediately after spawn', () => {
    const m = buildManifest(makeManifestOpts());
    const { jobId } = spawn(m);
    spawnedIds.push(jobId);
    const record = status(jobId);
    expect(record).not.toBeNull();
    expect(record?.jobId).toBe(jobId);
  });

  it('status returns null for an unknown jobId', () => {
    expect(status('does-not-exist')).toBeNull();
  });

  it('list includes the spawned job', () => {
    const m = buildManifest(makeManifestOpts());
    const { jobId } = spawn(m);
    spawnedIds.push(jobId);
    const jobs = list();
    expect(jobs.some((j) => j.jobId === jobId)).toBe(true);
  });

  it('kill returns true and removes the job from list', () => {
    const m = buildManifest(makeManifestOpts());
    const { jobId } = spawn(m);
    const removed = kill(jobId);
    expect(removed).toBe(true);
    expect(status(jobId)).toBeNull();
    // Don't push to spawnedIds — already killed
  });

  it('kill returns false for an unknown jobId', () => {
    expect(kill('ghost-id')).toBe(false);
  });
});
