/**
 * stations.ts — Unit Tests
 * Sprint 11.5: pure logic, no DOM.
 *
 * Tests cover generateStations() and resolveTemplate().
 * Station eligibility is registry-driven — no hardcoded event type checks.
 */

import { describe, it, expect } from 'vitest';
import { generateStations, resolveTemplate } from '../stations';
import type { EnrichedEvent } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(
  overrides: Partial<EnrichedEvent> & { id: string },
): EnrichedEvent {
  return {
    id: overrides.id,
    conversation_id: 'conv-1',
    message_id: overrides.message_id ?? `msg-${overrides.id}`,
    event_type: overrides.event_type ?? 'flow.topic_shift',
    category: overrides.category ?? 'flow',
    payload: overrides.payload ?? {},
    created_at: overrides.created_at ?? Date.now(),
    config: overrides.config ?? null,
    message_index: overrides.message_index ?? 0,
    total_messages: overrides.total_messages ?? 10,
  };
}

const TOPIC_SHIFT_CONFIG = {
  id: 'flow.topic_shift',
  category: 'flow' as const,
  name: 'Topic Boundary',
  learnable: true,
  experimental: true,
  marker: { shape: 'circle' as const, color: 'var(--cyan)', size: 'landmark' as const },
  station: { enabled: true, nameTemplate: '{payload.inferred_topic_label}', icon: '📍' },
};

const ARTIFACT_CONFIG = {
  id: 'cognitive.artifact_generated',
  category: 'cognitive' as const,
  name: 'Artifact Produced',
  learnable: true,
  marker: { shape: 'hexagon' as const, color: 'var(--teal-400)', size: 'large' as const },
  station: { enabled: true, nameTemplate: 'Artifact: {payload.artifact_type}', icon: '📦' },
};

const NO_STATION_CONFIG = {
  id: 'quality.interruption',
  category: 'quality' as const,
  name: 'User Interrupted Generation',
  learnable: true,
  marker: { shape: 'diamond' as const, color: 'var(--red-400)', size: 'large' as const },
  // no station field
};

// ── resolveTemplate ───────────────────────────────────────────────────────────

describe('resolveTemplate', () => {
  it('replaces a single payload token', () => {
    const result = resolveTemplate(
      'Artifact: {payload.artifact_type}',
      { artifact_type: 'code' },
    );
    expect(result).toBe('Artifact: code');
  });

  it('replaces multiple payload tokens', () => {
    const result = resolveTemplate(
      '{payload.a} and {payload.b}',
      { a: 'foo', b: 'bar' },
    );
    expect(result).toBe('foo and bar');
  });

  it('falls back to the key name when payload field is absent', () => {
    const result = resolveTemplate(
      'Gate: {payload.gate_type}',
      {},
    );
    expect(result).toBe('Gate: gate_type');
  });

  it('returns static template unchanged when no tokens present', () => {
    const result = resolveTemplate('Session Start/End', {});
    expect(result).toBe('Session Start/End');
  });

  it('handles numeric payload values', () => {
    const result = resolveTemplate('Turn {payload.turn}', { turn: 42 });
    expect(result).toBe('Turn 42');
  });
});

// ── generateStations ──────────────────────────────────────────────────────────

describe('generateStations', () => {
  it('generates a station from a topic_shift event with station config', () => {
    const event = makeEvent({
      id: 'evt-1',
      event_type: 'flow.topic_shift',
      category: 'flow',
      message_index: 3,
      payload: { inferred_topic_label: 'Architecture Discussion' },
      config: TOPIC_SHIFT_CONFIG,
    });

    const stations = generateStations([event]);

    expect(stations).toHaveLength(1);
    expect(stations[0]!.name).toBe('Architecture Discussion');
    expect(stations[0]!.icon).toBe('📍');
    expect(stations[0]!.messageIndex).toBe(3);
    expect(stations[0]!.source).toBe('auto');
  });

  it('generates a station from an artifact_generated event', () => {
    const event = makeEvent({
      id: 'evt-2',
      event_type: 'cognitive.artifact_generated',
      category: 'cognitive',
      message_index: 7,
      payload: { artifact_type: 'typescript' },
      config: ARTIFACT_CONFIG,
    });

    const stations = generateStations([event]);

    expect(stations).toHaveLength(1);
    expect(stations[0]!.name).toBe('Artifact: typescript');
    expect(stations[0]!.icon).toBe('📦');
  });

  it('skips events with no station config in the registry entry', () => {
    const event = makeEvent({
      id: 'evt-3',
      event_type: 'quality.interruption',
      category: 'quality',
      message_index: 2,
      payload: {},
      config: NO_STATION_CONFIG,
    });

    const stations = generateStations([event]);
    expect(stations).toHaveLength(0);
  });

  it('skips events with null config (unknown event type)', () => {
    const event = makeEvent({
      id: 'evt-4',
      event_type: 'unknown.type',
      message_index: 5,
      payload: {},
      config: null,
    });

    const stations = generateStations([event]);
    expect(stations).toHaveLength(0);
  });

  it('returns stations sorted ascending by messageIndex', () => {
    const events = [
      makeEvent({ id: 'e-c', event_type: 'flow.topic_shift', message_index: 9, payload: { inferred_topic_label: 'C' }, config: TOPIC_SHIFT_CONFIG }),
      makeEvent({ id: 'e-a', event_type: 'flow.topic_shift', message_index: 1, payload: { inferred_topic_label: 'A' }, config: TOPIC_SHIFT_CONFIG }),
      makeEvent({ id: 'e-b', event_type: 'flow.topic_shift', message_index: 5, payload: { inferred_topic_label: 'B' }, config: TOPIC_SHIFT_CONFIG }),
    ];

    const stations = generateStations(events);

    expect(stations).toHaveLength(3);
    expect(stations[0]!.name).toBe('A');
    expect(stations[1]!.name).toBe('B');
    expect(stations[2]!.name).toBe('C');
  });

  it('marks transit.manual_station events as manual source', () => {
    const manualConfig = {
      ...TOPIC_SHIFT_CONFIG,
      id: 'transit.manual_station',
      station: { enabled: true, nameTemplate: '{payload.name}', icon: '⭐' },
    };
    const event = makeEvent({
      id: 'evt-5',
      event_type: 'transit.manual_station',
      message_index: 4,
      payload: { name: 'My Landmark' },
      config: manualConfig,
    });

    const stations = generateStations([event]);

    expect(stations).toHaveLength(1);
    expect(stations[0]!.source).toBe('manual');
    expect(stations[0]!.name).toBe('My Landmark');
  });

  it('returns empty array for empty event list', () => {
    expect(generateStations([])).toHaveLength(0);
  });

  it('mixes auto and manual stations in correct index order', () => {
    const autoEvent = makeEvent({
      id: 'auto-1',
      event_type: 'cognitive.artifact_generated',
      message_index: 2,
      payload: { artifact_type: 'code' },
      config: ARTIFACT_CONFIG,
    });
    const manualConfig = {
      ...ARTIFACT_CONFIG,
      id: 'transit.manual_station',
      station: { enabled: true, nameTemplate: '{payload.name}', icon: '⭐' },
    };
    const manualEvent = makeEvent({
      id: 'manual-1',
      event_type: 'transit.manual_station',
      message_index: 6,
      payload: { name: 'Key Decision' },
      config: manualConfig,
    });

    const stations = generateStations([manualEvent, autoEvent]);

    expect(stations).toHaveLength(2);
    expect(stations[0]!.source).toBe('auto');
    expect(stations[0]!.messageIndex).toBe(2);
    expect(stations[1]!.source).toBe('manual');
    expect(stations[1]!.messageIndex).toBe(6);
  });
});
