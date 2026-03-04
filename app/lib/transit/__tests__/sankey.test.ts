/**
 * sankey.ts — Unit Tests
 * Sprint 11.6: pure logic, no DOM.
 *
 * Tests cover buildSankeyGraph(), getQualityColor(), and scaleLinkWidth().
 */

import { describe, it, expect } from 'vitest';
import {
  buildSankeyGraph,
  getQualityColor,
} from '../sankey';
// SankeyGraph type available if needed for future typed assertions
import { scaleLinkWidth } from '@/components/transit/SankeyLink';
import type { EnrichedEvent, Station } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(
  overrides: Partial<EnrichedEvent> & { id: string },
): EnrichedEvent {
  return {
    id: overrides.id,
    conversation_id: 'conv-1',
    message_id: overrides.message_id ?? `msg-${overrides.id}`,
    event_type: overrides.event_type ?? 'flow.message',
    category: overrides.category ?? 'flow',
    payload: overrides.payload ?? {},
    created_at: overrides.created_at ?? Date.now(),
    config: overrides.config ?? null,
    message_index: overrides.message_index ?? 0,
    total_messages: overrides.total_messages ?? 10,
  };
}

function makeStation(overrides: Partial<Station> & { id: string }): Station {
  return {
    id: overrides.id,
    eventId: overrides.eventId ?? overrides.id,
    messageId: overrides.messageId ?? null,
    messageIndex: overrides.messageIndex ?? 0,
    name: overrides.name ?? 'Station',
    icon: overrides.icon ?? '📍',
    source: overrides.source ?? 'auto',
  };
}

function makeFlowMessage(id: string, index: number, tokenCount: number, model = 'sonnet'): EnrichedEvent {
  return makeEvent({
    id,
    event_type: 'flow.message',
    category: 'flow',
    message_index: index,
    payload: { token_count: tokenCount, model, role: 'assistant' },
  });
}

// ── getQualityColor ───────────────────────────────────────────────────────────

describe('getQualityColor', () => {
  it('returns green for positive', () => {
    expect(getQualityColor('positive')).toBe('var(--green-400)');
  });

  it('returns frost for neutral', () => {
    expect(getQualityColor('neutral')).toBe('var(--frost)');
  });

  it('returns amber for attention', () => {
    expect(getQualityColor('attention')).toBe('var(--amber-400)');
  });

  it('returns red for negative', () => {
    expect(getQualityColor('negative')).toBe('var(--red-400)');
  });
});

// ── scaleLinkWidth ────────────────────────────────────────────────────────────

describe('scaleLinkWidth', () => {
  it('returns min width for 0 tokens', () => {
    expect(scaleLinkWidth(0, 1000)).toBe(2);
  });

  it('returns max width for max tokens', () => {
    expect(scaleLinkWidth(1000, 1000)).toBe(40);
  });

  it('returns min width when maxTokenVolume is 0', () => {
    expect(scaleLinkWidth(500, 0)).toBe(2);
  });

  it('scales linearly for mid-range values', () => {
    const half = scaleLinkWidth(500, 1000);
    expect(half).toBeCloseTo(21, 0);
  });
});

// ── buildSankeyGraph ──────────────────────────────────────────────────────────

describe('buildSankeyGraph', () => {
  it('returns single empty segment for empty conversation', () => {
    const graph = buildSankeyGraph([], [], 0);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]!.id).toBe('seg-empty');
    expect(graph.links).toHaveLength(0);
    expect(graph.totalTokens).toBe(0);
    expect(graph.totalMessages).toBe(0);
  });

  it('builds correct segments from 3 stations → 4 segments', () => {
    const events = [
      makeFlowMessage('m0', 0, 100),
      makeFlowMessage('m3', 3, 200),
      makeFlowMessage('m5', 5, 150),
      makeFlowMessage('m8', 8, 300),
      makeFlowMessage('m9', 9, 100),
    ];
    const stations = [
      makeStation({ id: 's1', messageIndex: 3, name: 'Topic A' }),
      makeStation({ id: 's2', messageIndex: 5, name: 'Topic B' }),
      makeStation({ id: 's3', messageIndex: 8, name: 'Topic C' }),
    ];

    const graph = buildSankeyGraph(events, stations, 10);

    // Boundaries: [0, 3, 5, 8, 9] → 4 segments: 0-3, 3-5, 5-8, 8-9
    const trunkNodes = graph.nodes.filter((n) => n.branchId === null);
    expect(trunkNodes.length).toBe(4);
    expect(trunkNodes[0]!.messageIndexStart).toBe(0);
    expect(trunkNodes[0]!.messageIndexEnd).toBe(3);
    expect(trunkNodes[1]!.label).toBe('Topic A');
    expect(trunkNodes[2]!.label).toBe('Topic B');
    expect(trunkNodes[3]!.label).toBe('Topic C');
  });

  it('aggregates token counts correctly per segment', () => {
    const events = [
      makeFlowMessage('m0', 0, 100),
      makeFlowMessage('m1', 1, 200),
      makeFlowMessage('m4', 4, 300),
    ];
    const stations = [
      makeStation({ id: 's1', messageIndex: 3, name: 'Split' }),
    ];

    const graph = buildSankeyGraph(events, stations, 5);
    const trunkNodes = graph.nodes.filter((n) => n.branchId === null);

    // Seg 0-3: m0 (100) + m1 (200) = 300
    expect(trunkNodes[0]!.tokenCount).toBe(300);
    // Seg 3-4: m4 (300) = 300
    expect(trunkNodes[1]!.tokenCount).toBe(300);
    expect(graph.totalTokens).toBe(600);
  });

  it('quality signal reflects worst quality event in segment', () => {
    const events = [
      makeFlowMessage('m0', 0, 100),
      makeEvent({
        id: 'q1',
        event_type: 'quality.copy_event',
        category: 'quality',
        message_index: 1,
      }),
      makeEvent({
        id: 'q2',
        event_type: 'quality.interruption',
        category: 'quality',
        message_index: 2,
      }),
    ];

    const graph = buildSankeyGraph(events, [], 5);
    const trunk = graph.nodes.filter((n) => n.branchId === null);
    // Interruption is worst (severity 3 → negative), overrides copy_event positive
    expect(trunk[0]!.qualitySignal).toBe('negative');
  });

  it('positive quality signal from copy_event when no negative events', () => {
    const events = [
      makeFlowMessage('m0', 0, 100),
      makeEvent({
        id: 'q1',
        event_type: 'quality.copy_event',
        category: 'quality',
        message_index: 1,
      }),
    ];

    const graph = buildSankeyGraph(events, [], 5);
    expect(graph.nodes[0]!.qualitySignal).toBe('positive');
  });

  it('branch fork creates parallel segments', () => {
    const events = [
      makeFlowMessage('m0', 0, 100),
      makeFlowMessage('m3', 3, 200),
      makeEvent({
        id: 'fork-1',
        event_type: 'flow.branch_fork',
        category: 'flow',
        message_index: 3,
        payload: { branch_type: 'regen', is_active: false },
      }),
    ];

    const graph = buildSankeyGraph(events, [], 10);
    const branchNodes = graph.nodes.filter((n) => n.branchId !== null);
    expect(branchNodes).toHaveLength(1);
    expect(branchNodes[0]!.label).toBe('Fork: regen');
    expect(branchNodes[0]!.qualitySignal).toBe('negative'); // abandoned
  });

  it('no stations → one big segment spanning full conversation', () => {
    const events = [
      makeFlowMessage('m0', 0, 100),
      makeFlowMessage('m4', 4, 200),
    ];

    const graph = buildSankeyGraph(events, [], 5);
    const trunk = graph.nodes.filter((n) => n.branchId === null);
    expect(trunk).toHaveLength(1);
    expect(trunk[0]!.messageIndexStart).toBe(0);
    expect(trunk[0]!.messageIndexEnd).toBe(4);
    expect(trunk[0]!.tokenCount).toBe(300);
  });

  it('pure function: same inputs always produce same outputs', () => {
    const events = [
      makeFlowMessage('m0', 0, 100),
      makeFlowMessage('m3', 3, 200),
    ];
    const stations = [makeStation({ id: 's1', messageIndex: 3, name: 'A' })];

    const g1 = buildSankeyGraph(events, stations, 5);
    const g2 = buildSankeyGraph(events, stations, 5);

    expect(g1.nodes.length).toBe(g2.nodes.length);
    expect(g1.links.length).toBe(g2.links.length);
    expect(g1.totalTokens).toBe(g2.totalTokens);
    for (let i = 0; i < g1.nodes.length; i++) {
      expect(g1.nodes[i]!.id).toBe(g2.nodes[i]!.id);
      expect(g1.nodes[i]!.tokenCount).toBe(g2.nodes[i]!.tokenCount);
    }
  });

  it('builds links between consecutive trunk nodes', () => {
    const events = [
      makeFlowMessage('m0', 0, 100),
      makeFlowMessage('m5', 5, 200),
      makeFlowMessage('m9', 9, 300),
    ];
    const stations = [
      makeStation({ id: 's1', messageIndex: 5, name: 'Mid' }),
    ];

    const graph = buildSankeyGraph(events, stations, 10);
    const trunkLinks = graph.links.filter((l) =>
      !l.sourceId.startsWith('branch') && !l.targetId.startsWith('branch'),
    );
    expect(trunkLinks.length).toBeGreaterThanOrEqual(1);
    expect(trunkLinks[0]!.sourceId).toBe('seg-0');
    expect(trunkLinks[0]!.targetId).toBe('seg-1');
  });

  it('link qualityColor matches source node quality signal color', () => {
    const events = [
      makeFlowMessage('m0', 0, 100),
      makeEvent({
        id: 'q1',
        event_type: 'quality.regeneration',
        category: 'quality',
        message_index: 1,
      }),
      makeFlowMessage('m5', 5, 200),
    ];
    const stations = [makeStation({ id: 's1', messageIndex: 5, name: 'After' })];

    const graph = buildSankeyGraph(events, stations, 10);
    // First segment has regeneration → attention → amber
    expect(graph.links[0]!.qualityColor).toBe('var(--amber-400)');
  });
});
