/**
 * Transit Map Learning Engine — Regeneration Detector Tests
 * Sprint 11.7 | TRANSIT_MAP_SPEC.md §6.2
 *
 * Covers:
 *   - classifyTaskType: keyword heuristic for all 6 task types
 *   - detectRegenerationPatterns: minimum sample gate
 *   - detectRegenerationPatterns: no-pattern case (spread / low count)
 *   - detectRegenerationPatterns: pattern detection via topic payload
 *   - detectRegenerationPatterns: resolves task type from flow event content
 *   - detectRegenerationPatterns: can detect multiple task types simultaneously
 *   - Output shape: all LearningInsight fields present and valid
 */

import { describe, it, expect } from 'vitest';
import { detectRegenerationPatterns, classifyTaskType } from '../regeneration';
import type { EventMetadata } from '@/lib/transit/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRegenEvent(overrides: Partial<EventMetadata> = {}): EventMetadata {
  return {
    id: `regen-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: 'conv-1',
    message_id: null,
    event_type: 'quality.regeneration',
    category: 'quality',
    payload: {},
    created_at: Date.now() - 1000,
    ...overrides,
  };
}

function makeFlowEvent(
  role: 'user' | 'assistant',
  content: string,
  messageId?: string,
): EventMetadata {
  return {
    id: `flow-${Math.random().toString(36).slice(2, 8)}`,
    conversation_id: 'conv-1',
    message_id: messageId ?? null,
    event_type: 'flow.message',
    category: 'flow',
    payload: { role, content },
    created_at: Date.now() - 1000,
  };
}

// ── classifyTaskType ──────────────────────────────────────────────────────────

describe('classifyTaskType', () => {
  it('returns "code" for code-related keywords', () => {
    expect(classifyTaskType('implement a function')).toBe('code');
    expect(classifyTaskType('refactor this TypeScript component')).toBe('code');
    expect(classifyTaskType('write a Python class')).toBe('code');
    expect(classifyTaskType('add a React component here')).toBe('code');
  });

  it('returns "writing" for composition keywords', () => {
    expect(classifyTaskType('write a blog post about AI')).toBe('writing');
    expect(classifyTaskType('draft an email for the team')).toBe('writing');
    expect(classifyTaskType('compose a project summary')).toBe('writing');
    expect(classifyTaskType('generate a README for this repo')).toBe('writing');
  });

  it('returns "explanation" for question/explanation keywords', () => {
    expect(classifyTaskType('explain how React hooks work')).toBe('explanation');
    expect(classifyTaskType('what is the difference between null and undefined')).toBe('explanation');
    expect(classifyTaskType('why does this cause a memory leak')).toBe('explanation');
    expect(classifyTaskType('describe the impact of this change')).toBe('explanation');
  });

  it('returns "review" for review/audit keywords', () => {
    expect(classifyTaskType('review this pull request')).toBe('review');
    expect(classifyTaskType('audit the security of this endpoint')).toBe('review');
    expect(classifyTaskType('check my logic in this algorithm')).toBe('review');
    expect(classifyTaskType('evaluate this approach')).toBe('review');
  });

  it('returns "debugging" for bug/fix keywords', () => {
    expect(classifyTaskType('fix this bug in the parser')).toBe('debugging');
    expect(classifyTaskType('this is broken, debug it')).toBe('debugging');
    expect(classifyTaskType('there is a crash when I click submit')).toBe('debugging');
    expect(classifyTaskType('the test is failing on CI')).toBe('debugging');
  });

  it('returns "general" for unmatched content', () => {
    expect(classifyTaskType('')).toBe('general');
    expect(classifyTaskType('hello')).toBe('general');
    expect(classifyTaskType('what time is it')).toBe('general');
    expect(classifyTaskType('thanks')).toBe('general');
  });

  it('is case-insensitive', () => {
    expect(classifyTaskType('IMPLEMENT A FUNCTION')).toBe('code');
    expect(classifyTaskType('EXPLAIN THIS CONCEPT')).toBe('explanation');
    expect(classifyTaskType('FIX THE BUG')).toBe('debugging');
  });
});

// ── Minimum sample gate ───────────────────────────────────────────────────────

describe('detectRegenerationPatterns — minimum sample gate', () => {
  it('returns [] when 0 regen events', () => {
    expect(detectRegenerationPatterns([], [])).toEqual([]);
  });

  it('returns [] when fewer than 10 regen events', () => {
    const events = Array.from({ length: 9 }, () => makeRegenEvent());
    expect(detectRegenerationPatterns(events, [])).toEqual([]);
  });
});

// ── No-pattern case ───────────────────────────────────────────────────────────

describe('detectRegenerationPatterns — no pattern detected', () => {
  it('returns [] when regen events are spread evenly (none exceed 30% threshold)', () => {
    // 2 events per task type × 5 types = 10 total; each = 20%
    const events = [
      ...Array.from({ length: 2 }, () => makeRegenEvent({ payload: { topic: 'implement a function' } })),
      ...Array.from({ length: 2 }, () => makeRegenEvent({ payload: { topic: 'write a blog post' } })),
      ...Array.from({ length: 2 }, () => makeRegenEvent({ payload: { topic: 'explain how it works' } })),
      ...Array.from({ length: 2 }, () => makeRegenEvent({ payload: { topic: 'review this PR' } })),
      ...Array.from({ length: 2 }, () => makeRegenEvent({ payload: { topic: 'fix this bug' } })),
    ];
    expect(detectRegenerationPatterns(events, [])).toEqual([]);
  });

  it('returns [] when a task type exceeds 30% but has fewer than 5 events', () => {
    // code: 4 events / 10 total = 40% > threshold, but count < 5 → skip
    const events = [
      ...Array.from({ length: 4 }, () => makeRegenEvent({ payload: { topic: 'implement a function' } })),
      ...Array.from({ length: 6 }, () => makeRegenEvent({ payload: {} })), // general
    ];
    // code: 4/10 = 40% but < 5 → no insight
    // general: 6/10 = 60% and >= 5 → insight for 'general' should appear
    const insights = detectRegenerationPatterns(events, []);
    // Only general qualifies (6 events, 60%)
    expect(insights.length).toBe(1);
    expect(insights[0]!.adjustment.target).toBe('task_type:general');
  });
});

// ── Pattern detection ─────────────────────────────────────────────────────────

describe('detectRegenerationPatterns — pattern detected', () => {
  it('detects a pattern when a task type has >30% of total regens', () => {
    // code: 8/12 = 67% — well above threshold
    const events = [
      ...Array.from({ length: 8 }, () => makeRegenEvent({ payload: { topic: 'implement a TypeScript function' } })),
      ...Array.from({ length: 4 }, () => makeRegenEvent({ payload: {} })),
    ];
    const insights = detectRegenerationPatterns(events, []);
    expect(insights.length).toBe(1);
    expect(insights[0]!.pattern_type).toBe('regeneration');
    expect(insights[0]!.adjustment.target).toBe('task_type:code');
    expect(insights[0]!.adjustment.type).toBe('system_prompt');
  });

  it('uses flow event content when original_message_id resolves to a user message', () => {
    const msgId = 'msg-001';
    // 8 regens reference the same message id
    const regenEvents = Array.from({ length: 8 }, () =>
      makeRegenEvent({ payload: { original_message_id: msgId } }),
    );
    // 4 regens with no context (classify as 'general')
    const extraRegens = Array.from({ length: 4 }, () => makeRegenEvent({ payload: {} }));
    const flowEvents = [makeFlowEvent('user', 'explain how React hooks work', msgId)];

    const insights = detectRegenerationPatterns([...regenEvents, ...extraRegens], flowEvents);
    // explanation: 8/12 = 67% → insight; general: 4/12 = 33% but may be < 5
    const explanationInsight = insights.find((i) => i.adjustment.target === 'task_type:explanation');
    expect(explanationInsight).toBeDefined();
  });

  it('falls back to topic payload when no original_message_id is present', () => {
    const events = Array.from({ length: 10 }, () =>
      makeRegenEvent({ payload: { topic: 'debug this failing test' } }),
    );
    const insights = detectRegenerationPatterns(events, []);
    expect(insights.length).toBe(1);
    expect(insights[0]!.adjustment.target).toBe('task_type:debugging');
  });

  it('can detect multiple task types simultaneously when both exceed threshold', () => {
    // code: 5/12 = 42%, debugging: 5/12 = 42%, general: 2/12 = 17%
    const events = [
      ...Array.from({ length: 5 }, () => makeRegenEvent({ payload: { topic: 'implement a function in TypeScript' } })),
      ...Array.from({ length: 5 }, () => makeRegenEvent({ payload: { topic: 'debug this failing build' } })),
      ...Array.from({ length: 2 }, () => makeRegenEvent({ payload: {} })),
    ];
    const insights = detectRegenerationPatterns(events, []);
    expect(insights.length).toBe(2);
    const targets = insights.map((i) => i.adjustment.target).sort();
    expect(targets).toContain('task_type:code');
    expect(targets).toContain('task_type:debugging');
  });

  it('ignores assistant flow events for task type classification', () => {
    const msgId = 'msg-002';
    // regen references a message, but only an assistant message exists in flow — should classify as general
    const regenEvents = Array.from({ length: 10 }, () =>
      makeRegenEvent({ payload: { original_message_id: msgId } }),
    );
    // assistant message only — should not be used for classification
    const flowEvents = [makeFlowEvent('assistant', 'Here is the implementation...', msgId)];
    const insights = detectRegenerationPatterns(regenEvents, flowEvents);
    // message_id won't match because we only store user messages in the map
    // All events classify as 'general' (empty content → 'general')
    expect(insights.length).toBe(1);
    expect(insights[0]!.adjustment.target).toBe('task_type:general');
  });
});

// ── Output shape ──────────────────────────────────────────────────────────────

describe('detectRegenerationPatterns — output shape', () => {
  it('produces an insight with all required LearningInsight fields', () => {
    const events = Array.from({ length: 10 }, () =>
      makeRegenEvent({ payload: { topic: 'implement a function' } }),
    );
    const insights = detectRegenerationPatterns(events, []);
    const insight = insights[0]!;

    expect(insight.id).toBeTruthy();
    expect(insight.pattern_type).toBe('regeneration');
    expect(insight.title).toContain('code');
    expect(insight.description).toContain('code');
    expect(insight.confidence).toBeGreaterThan(0);
    expect(insight.confidence).toBeLessThanOrEqual(95);
    expect(insight.sample_size).toBeGreaterThanOrEqual(5);
    expect(insight.status).toBe('proposed');
    expect(insight.after_state).toBeNull();
    expect(insight.applied_at).toBeNull();
    expect(insight.expires_at).toBeGreaterThan(insight.created_at);
  });

  it('before_state is valid JSON containing task_type and regen_rate', () => {
    const events = Array.from({ length: 10 }, () =>
      makeRegenEvent({ payload: { topic: 'write a blog post' } }),
    );
    const insights = detectRegenerationPatterns(events, []);
    const parsed = JSON.parse(insights[0]!.before_state) as Record<string, unknown>;
    expect(parsed.task_type).toBe('writing');
    expect(typeof parsed.regen_rate).toBe('number');
  });

  it('sets expires_at ~90 days from created_at', () => {
    const events = Array.from({ length: 10 }, () =>
      makeRegenEvent({ payload: { topic: 'implement a function' } }),
    );
    const insight = detectRegenerationPatterns(events, [])[0]!;
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const diff = insight.expires_at - insight.created_at;
    expect(diff).toBeGreaterThanOrEqual(ninetyDays - 5000);
    expect(diff).toBeLessThanOrEqual(ninetyDays + 5000);
  });
});
