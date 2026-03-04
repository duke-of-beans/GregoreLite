/**
 * SubwayMap — Pure Logic Tests
 * Sprint 11.5: environment is 'node' (no jsdom), so only exported pure
 * functions are tested here. Component rendering is covered via manual
 * integration in the Transit tab.
 *
 * Tested exports:
 *   indexToX()             — proportional X coordinate calculation
 *   extractBranchSegments() — branch segment extraction from fork events
 */

import { describe, it, expect } from 'vitest';
import { indexToX, extractBranchSegments } from '../SubwayMap';
import type { EnrichedEvent } from '@/lib/transit/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeForkEvent(overrides: {
  id: string;
  message_index: number;
  is_active?: boolean;
  branch_type?: string;
}): EnrichedEvent {
  return {
    id: overrides.id,
    conversation_id: 'conv-1',
    message_id: `msg-${overrides.id}`,
    event_type: 'flow.branch_fork',
    category: 'flow',
    payload: {
      is_active: overrides.is_active ?? false,
      branch_type: overrides.branch_type ?? 'regeneration',
    },
    created_at: Date.now(),
    config: null,
    message_index: overrides.message_index,
    total_messages: 20,
  };
}

// ── indexToX ──────────────────────────────────────────────────────────────────

describe('indexToX', () => {
  it('maps index 0 to paddingX', () => {
    const x = indexToX(0, 10, 600, 40);
    expect(x).toBe(40);
  });

  it('maps last index to width - paddingX', () => {
    const x = indexToX(9, 10, 600, 40);
    expect(x).toBe(600 - 40);
  });

  it('maps middle index to the center of the usable range', () => {
    // With 11 messages (0..10), index 5 = midpoint
    const x = indexToX(5, 11, 600, 40);
    expect(x).toBe(300); // paddingX + 5/10 * 520 = 40 + 260 = 300
  });

  it('centers when totalMessages is 1 (single message edge case)', () => {
    const x = indexToX(0, 1, 600, 40);
    expect(x).toBe(300); // width / 2
  });

  it('is strictly monotone — higher index yields higher X', () => {
    const total = 20;
    const width = 800;
    const xs = Array.from({ length: total }, (_, i) => indexToX(i, total, width, 40));
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    }
  });

  it('uses SVG_PADDING_X default (40) when paddingX is omitted', () => {
    const withDefault = indexToX(0, 10, 600);
    const withExplicit = indexToX(0, 10, 600, 40);
    expect(withDefault).toBe(withExplicit);
  });
});

// ── extractBranchSegments ─────────────────────────────────────────────────────

describe('extractBranchSegments', () => {
  it('returns empty array when no fork events exist', () => {
    const events: EnrichedEvent[] = [
      { ...makeForkEvent({ id: 'e1', message_index: 5 }), event_type: 'flow.topic_shift' },
    ];
    const segments = extractBranchSegments(events, 20, 600, 50);
    expect(segments).toHaveLength(0);
  });

  it('produces one segment per fork event', () => {
    const events = [
      makeForkEvent({ id: 'fork-1', message_index: 4, is_active: true }),
      makeForkEvent({ id: 'fork-2', message_index: 12, is_active: false }),
    ];
    const segments = extractBranchSegments(events, 20, 600, 50);
    expect(segments).toHaveLength(2);
  });

  it('marks active fork as isActive = true', () => {
    const events = [makeForkEvent({ id: 'f1', message_index: 3, is_active: true })];
    const segments = extractBranchSegments(events, 20, 600, 50);
    expect(segments[0]!.isActive).toBe(true);
  });

  it('marks inactive fork as isActive = false', () => {
    const events = [makeForkEvent({ id: 'f2', message_index: 3, is_active: false })];
    const segments = extractBranchSegments(events, 20, 600, 50);
    expect(segments[0]!.isActive).toBe(false);
  });

  it('segment forkX < endX (forward direction)', () => {
    const events = [makeForkEvent({ id: 'f3', message_index: 2 })];
    const segments = extractBranchSegments(events, 20, 600, 50);
    expect(segments[0]!.forkX).toBeLessThan(segments[0]!.endX);
  });

  it('trunkY matches the trackY argument passed in', () => {
    const events = [makeForkEvent({ id: 'f4', message_index: 5 })];
    const segments = extractBranchSegments(events, 20, 600, 77);
    expect(segments[0]!.trunkY).toBe(77);
  });

  it('label matches payload branch_type', () => {
    const events = [makeForkEvent({ id: 'f5', message_index: 5, branch_type: 'edit' })];
    const segments = extractBranchSegments(events, 20, 600, 50);
    expect(segments[0]!.label).toBe('edit');
  });
});
