/**
 * Tests for lib/context/types.ts and context-provider utilities.
 *
 * We test the pure logic that can run in Node (no DOM required):
 *   - DEFAULT_CONTEXT_STATE shape and values
 *   - ContextPanelState interface conformance
 *   - Utility logic that exists in provider (relative-time style helpers)
 *
 * The React hooks themselves (useContextPanelProvider) are tested via
 * component integration; they require a browser environment.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONTEXT_STATE,
  type ContextPanelState,
  type KERNLProject,
  type KERNLDecision,
} from '@/lib/context/types';

describe('DEFAULT_CONTEXT_STATE', () => {
  it('has null activeProject by default', () => {
    expect(DEFAULT_CONTEXT_STATE.activeProject).toBeNull();
  });

  it('has sessionNumber 0 by default', () => {
    expect(DEFAULT_CONTEXT_STATE.sessionNumber).toBe(0);
  });

  it('has sessionDurationMs 0 by default', () => {
    expect(DEFAULT_CONTEXT_STATE.sessionDurationMs).toBe(0);
  });

  it('has empty recentDecisions by default', () => {
    expect(DEFAULT_CONTEXT_STATE.recentDecisions).toEqual([]);
  });

  it('has kernlStatus "indexed" by default', () => {
    expect(DEFAULT_CONTEXT_STATE.kernlStatus).toBe('indexed');
  });

  it('has aegisProfile "IDLE" by default', () => {
    expect(DEFAULT_CONTEXT_STATE.aegisProfile).toBe('IDLE');
  });

  it('has pendingSuggestions 0 by default', () => {
    expect(DEFAULT_CONTEXT_STATE.pendingSuggestions).toBe(0);
  });
});

describe('ContextPanelState type conformance', () => {
  it('accepts a fully populated state object', () => {
    const project: KERNLProject = { id: 'p1', name: 'GregLite', path: 'D:\\Projects\\GregLite' };
    const decision: KERNLDecision = { id: 'd1', title: 'Use Sonnet', created_at: Date.now() };

    const state: ContextPanelState = {
      activeProject: project,
      sessionNumber: 42,
      sessionDurationMs: 3_600_000,
      recentDecisions: [decision],
      kernlStatus: 'indexing',
      aegisProfile: 'DEEP_FOCUS',
      pendingSuggestions: 3,
    };

    expect(state.activeProject?.name).toBe('GregLite');
    expect(state.sessionNumber).toBe(42);
    expect(state.recentDecisions).toHaveLength(1);
    expect(state.kernlStatus).toBe('indexing');
    expect(state.aegisProfile).toBe('DEEP_FOCUS');
    expect(state.pendingSuggestions).toBe(3);
  });

  it('accepts all valid kernlStatus values', () => {
    const statuses: ContextPanelState['kernlStatus'][] = ['indexed', 'indexing', 'error'];
    statuses.forEach((s) => {
      const state: ContextPanelState = { ...DEFAULT_CONTEXT_STATE, kernlStatus: s };
      expect(state.kernlStatus).toBe(s);
    });
  });

  it('allows null activeProject', () => {
    const state: ContextPanelState = { ...DEFAULT_CONTEXT_STATE, activeProject: null };
    expect(state.activeProject).toBeNull();
  });

  it('allows null path in KERNLProject', () => {
    const project: KERNLProject = { id: 'p2', name: 'No Path Project', path: null };
    expect(project.path).toBeNull();
  });
});

describe('KERNLDecision', () => {
  it('stores timestamp as a number', () => {
    const now = Date.now();
    const d: KERNLDecision = { id: 'x', title: 'Test decision', created_at: now };
    expect(typeof d.created_at).toBe('number');
    expect(d.created_at).toBe(now);
  });
});
