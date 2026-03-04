/**
 * Transit Map — Registry Unit Tests
 *
 * Tests for lib/transit/registry.ts:
 *   - All 25+ event types are present in the registry
 *   - Map-based lookup: getEventType() returns correct definition
 *   - getEventTypesByCategory() returns correct filtered list
 *   - getAllEventTypes() returns all definitions
 *   - All definitions satisfy required structural constraints
 *   - Scrollbar landmark events have correct entries (§3.4)
 */

import { describe, it, expect } from 'vitest';
import {
  getEventType,
  getAllEventTypes,
  getEventTypesByCategory,
  EVENT_REGISTRY,
} from '../registry';

// ── Structural constraints ────────────────────────────────────────────────────

describe('EVENT_REGISTRY', () => {
  it('has at least 25 event type definitions', () => {
    expect(EVENT_REGISTRY.length).toBeGreaterThanOrEqual(25);
  });

  it('every definition has required fields: id, category, name, learnable, marker', () => {
    for (const def of EVENT_REGISTRY) {
      expect(def.id, `${def.id}: missing id`).toBeTruthy();
      expect(def.category, `${def.id}: missing category`).toBeTruthy();
      expect(def.name, `${def.id}: missing name`).toBeTruthy();
      expect(typeof def.learnable, `${def.id}: learnable must be boolean`).toBe('boolean');
      expect(def.marker, `${def.id}: missing marker`).toBeDefined();
      expect(def.marker.shape, `${def.id}: missing marker.shape`).toBeTruthy();
      expect(def.marker.color, `${def.id}: missing marker.color`).toBeTruthy();
      expect(def.marker.size, `${def.id}: missing marker.size`).toBeTruthy();
    }
  });

  it('every category is one of the 5 valid values', () => {
    const validCategories = new Set(['flow', 'quality', 'system', 'context', 'cognitive']);
    for (const def of EVENT_REGISTRY) {
      expect(validCategories.has(def.category), `${def.id}: invalid category "${def.category}"`).toBe(true);
    }
  });

  it('every marker shape matches the expected shape for its category', () => {
    const categoryShapeMap: Record<string, string> = {
      flow: 'circle',
      quality: 'diamond',
      system: 'square',
      context: 'triangle',
      cognitive: 'hexagon',
    };
    for (const def of EVENT_REGISTRY) {
      expect(
        def.marker.shape,
        `${def.id}: shape should be "${categoryShapeMap[def.category]}" for category "${def.category}"`,
      ).toBe(categoryShapeMap[def.category]);
    }
  });

  it('every marker size is one of: small | medium | large | landmark', () => {
    const validSizes = new Set(['small', 'medium', 'large', 'landmark']);
    for (const def of EVENT_REGISTRY) {
      expect(validSizes.has(def.marker.size), `${def.id}: invalid size "${def.marker.size}"`).toBe(true);
    }
  });

  it('no duplicate event type IDs', () => {
    const ids = EVENT_REGISTRY.map((d) => d.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });
});

// ── All 5 categories are represented ─────────────────────────────────────────

describe('category coverage', () => {
  it('has at least 1 flow event type', () => {
    expect(getEventTypesByCategory('flow').length).toBeGreaterThanOrEqual(1);
  });
  it('has at least 1 quality event type', () => {
    expect(getEventTypesByCategory('quality').length).toBeGreaterThanOrEqual(1);
  });
  it('has at least 1 system event type', () => {
    expect(getEventTypesByCategory('system').length).toBeGreaterThanOrEqual(1);
  });
  it('has at least 1 context event type', () => {
    expect(getEventTypesByCategory('context').length).toBeGreaterThanOrEqual(1);
  });
  it('has at least 1 cognitive event type', () => {
    expect(getEventTypesByCategory('cognitive').length).toBeGreaterThanOrEqual(1);
  });
});

// ── Lookup functions ──────────────────────────────────────────────────────────

describe('getEventType()', () => {
  it('returns the correct definition for a known event type', () => {
    const def = getEventType('quality.interruption');
    expect(def).toBeDefined();
    expect(def?.id).toBe('quality.interruption');
    expect(def?.category).toBe('quality');
    expect(def?.learnable).toBe(true);
    expect(def?.marker.shape).toBe('diamond');
    expect(def?.marker.color).toBe('var(--red-400)');
    expect(def?.marker.size).toBe('large');
  });

  it('returns undefined for an unknown event type', () => {
    expect(getEventType('unknown.event')).toBeUndefined();
  });

  it('returns the correct definition for flow.message', () => {
    const def = getEventType('flow.message');
    expect(def).toBeDefined();
    expect(def?.learnable).toBe(false);
    expect(def?.marker.shape).toBe('circle');
  });
});

describe('getAllEventTypes()', () => {
  it('returns the full registry array', () => {
    const all = getAllEventTypes();
    expect(all.length).toBe(EVENT_REGISTRY.length);
  });
});

describe('getEventTypesByCategory()', () => {
  it('returns only definitions for the requested category', () => {
    const qualityEvents = getEventTypesByCategory('quality');
    for (const def of qualityEvents) {
      expect(def.category).toBe('quality');
    }
  });

  it('returns empty array for an unknown category value', () => {
    // @ts-expect-error — testing runtime safety with invalid input
    const result = getEventTypesByCategory('nonexistent');
    expect(result).toEqual([]);
  });
});

// ── Scrollbar landmark events (§3.4) ─────────────────────────────────────────

describe('scrollbar landmark entries', () => {
  const scrollbarEventIds = [
    'flow.topic_shift',
    'cognitive.artifact_generated',
    'quality.interruption',
    'system.gate_trigger',
    'flow.branch_fork',
    'flow.message',
  ];

  it.each(scrollbarEventIds)('%s has a scrollbar definition', (id) => {
    const def = getEventType(id);
    expect(def, `${id} not found in registry`).toBeDefined();
    expect(def?.scrollbar, `${id} missing scrollbar definition`).toBeDefined();
    expect(def?.scrollbar?.color).toBeTruthy();
    expect(def?.scrollbar?.height).toBeGreaterThan(0);
    expect(def?.scrollbar?.opacity).toBeGreaterThan(0);
  });

  it('flow.message scrollbar has a user-only filter', () => {
    const def = getEventType('flow.message');
    expect(def?.scrollbar?.filter).toBeDefined();
    expect(def?.scrollbar?.filter).toContain("'user'");
  });
});
