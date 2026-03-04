/**
 * sprint-12-cache-control.test.ts
 *
 * Sprint 12.0 — Prompt Caching
 *
 * Tests:
 *   1. buildSystemPromptBlocks() produces at least one block with cache_control: ephemeral
 *   2. The stable block contains the base identity text
 *   3. Dynamic KERNL context appears in a separate un-cached block
 *   4. CostTracker.recordUsage() accumulates cacheCreationInputTokens and cacheReadInputTokens
 *   5. calculateCacheSavingsUsd() returns 90% of normal input cost for cache reads
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock fs for pricing YAML ─────────────────────────────────────────────────

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn((filePath: unknown) => {
      if (typeof filePath === 'string' && filePath.endsWith('pricing.yaml')) {
        return PRICING_YAML_FIXTURE;
      }
      return actual.readFileSync(filePath as string);
    }),
    watch: vi.fn(),
    existsSync: actual.existsSync,
  };
});

const PRICING_YAML_FIXTURE = `
models:
  claude-sonnet-4-5:
    input_per_million: 3.00
    output_per_million: 15.00
  claude-haiku-4-5-20251001:
    input_per_million: 0.80
    output_per_million: 4.00
`;

// ─── Mock DB (cost-tracker loads it) ─────────────────────────────────────────

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockPrepare = vi.fn(() => ({ run: mockRun, get: mockGet }));
vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => ({ prepare: mockPrepare })),
}));

// ─── Mock KERNL dependencies for context-builder ──────────────────────────────

vi.mock('@/lib/kernl/session-manager', () => ({
  listThreads: vi.fn(() => []),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { buildSystemPromptBlocks } from '@/lib/bootstrap/context-builder';
import { CostTracker, calculateCacheSavingsUsd } from '../cost-tracker';
import type { KERNLContext, DevProtocols } from '@/lib/bootstrap/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_KERNL: KERNLContext = {
  activeProjects: [],
  recentDecisions: [],
  lastSessionSummary: null,
  activeSession: null,
};

const KERNL_WITH_CONTEXT: KERNLContext = {
  activeProjects: [{ id: 'p1', name: 'GregLite', path: 'D:/Projects/GregLite', description: '', status: 'active' }],
  recentDecisions: [{ id: 'd1', category: 'architectural', decision: 'Use Haiku for classification', rationale: 'Cost', timestamp: Date.now() }],
  lastSessionSummary: 'Last session: "Sprint planning" (1/1/2026)',
  activeSession: 'thread-123',
};

const EMPTY_PROTOCOLS: DevProtocols = {
  technicalStandards: null,
  claudeInstructions: null,
  loadErrors: [],
};

const FULL_PROTOCOLS: DevProtocols = {
  technicalStandards: 'Use TypeScript. No any.',
  claudeInstructions: 'Zero technical debt.',
  loadErrors: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Sprint 12.0 — buildSystemPromptBlocks', () => {
  it('returns at least one block with cache_control: ephemeral', () => {
    const blocks = buildSystemPromptBlocks(EMPTY_KERNL, EMPTY_PROTOCOLS);
    const cached = blocks.find((b) => b.cache_control?.type === 'ephemeral');
    expect(cached).toBeDefined();
  });

  it('stable block contains base identity text', () => {
    const blocks = buildSystemPromptBlocks(EMPTY_KERNL, EMPTY_PROTOCOLS);
    const stableBlock = blocks.find((b) => b.cache_control?.type === 'ephemeral');
    expect(stableBlock?.text).toContain('GregLite');
    expect(stableBlock?.text).toContain('COO');
  });

  it('includes dev protocols in the stable block when present', () => {
    const blocks = buildSystemPromptBlocks(EMPTY_KERNL, FULL_PROTOCOLS);
    const stableBlock = blocks.find((b) => b.cache_control?.type === 'ephemeral');
    expect(stableBlock?.text).toContain('TECHNICAL STANDARDS');
    expect(stableBlock?.text).toContain('Use TypeScript');
    expect(stableBlock?.text).toContain('OPERATING INSTRUCTIONS');
    expect(stableBlock?.text).toContain('Zero technical debt');
  });

  it('KERNL context appears in a second un-cached block', () => {
    const blocks = buildSystemPromptBlocks(KERNL_WITH_CONTEXT, EMPTY_PROTOCOLS);
    expect(blocks.length).toBe(2);
    const dynamicBlock = blocks[1];
    expect(dynamicBlock?.cache_control).toBeUndefined();
    expect(dynamicBlock?.text).toContain('LAST SESSION');
    expect(dynamicBlock?.text).toContain('ACTIVE PROJECTS');
    expect(dynamicBlock?.text).toContain('GregLite');
  });

  it('returns only the stable block when KERNL context is empty', () => {
    const blocks = buildSystemPromptBlocks(EMPTY_KERNL, EMPTY_PROTOCOLS);
    expect(blocks.length).toBe(1);
  });
});

describe('Sprint 12.0 — CostTracker cache token accumulation', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it('starts a session with cache token counts at zero', () => {
    const sessionId = tracker.startSession('claude-sonnet-4-5');
    const state = tracker.getSessionState(sessionId);
    expect(state?.cacheCreationInputTokens).toBe(0);
    expect(state?.cacheReadInputTokens).toBe(0);
  });

  it('accumulates cacheCreationInputTokens across recordUsage calls', () => {
    const sessionId = tracker.startSession('claude-sonnet-4-5');
    tracker.recordUsage(sessionId, { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 200, cacheReadInputTokens: 0 });
    tracker.recordUsage(sessionId, { inputTokens: 50, outputTokens: 25, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 });
    const state = tracker.getSessionState(sessionId);
    expect(state?.cacheCreationInputTokens).toBe(200);
  });

  it('accumulates cacheReadInputTokens across recordUsage calls', () => {
    const sessionId = tracker.startSession('claude-sonnet-4-5');
    tracker.recordUsage(sessionId, { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 1500 });
    tracker.recordUsage(sessionId, { inputTokens: 50, outputTokens: 25, cacheCreationInputTokens: 0, cacheReadInputTokens: 800 });
    const state = tracker.getSessionState(sessionId);
    expect(state?.cacheReadInputTokens).toBe(2300);
  });

  it('handles missing optional cache fields gracefully (defaults to 0)', () => {
    const sessionId = tracker.startSession('claude-sonnet-4-5');
    tracker.recordUsage(sessionId, { inputTokens: 100, outputTokens: 50 });
    const state = tracker.getSessionState(sessionId);
    expect(state?.cacheCreationInputTokens).toBe(0);
    expect(state?.cacheReadInputTokens).toBe(0);
  });
});

describe('Sprint 12.0 — calculateCacheSavingsUsd', () => {
  it('returns 0 when cacheReadInputTokens is 0', () => {
    expect(calculateCacheSavingsUsd(0, 'claude-sonnet-4-5')).toBe(0);
  });

  it('returns ~90% of normal input cost for Sonnet', () => {
    // 1M Sonnet input tokens = $3.00; 90% saving = $2.70
    const savings = calculateCacheSavingsUsd(1_000_000, 'claude-sonnet-4-5');
    expect(savings).toBeCloseTo(2.70, 2);
  });

  it('returns ~90% of normal input cost for Haiku', () => {
    // 1M Haiku input tokens = $0.80; 90% saving = $0.72
    const savings = calculateCacheSavingsUsd(1_000_000, 'claude-haiku-4-5-20251001');
    expect(savings).toBeCloseTo(0.72, 2);
  });

  it('never returns a negative value', () => {
    expect(calculateCacheSavingsUsd(-100, 'claude-sonnet-4-5')).toBeGreaterThanOrEqual(0);
  });
});
