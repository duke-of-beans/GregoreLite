/**
 * EventMarkers — Unit Tests
 * Sprint 11.4: pure logic functions, no DOM (consistent with project test pattern)
 *
 * Tests cover the two exported pure functions:
 *   - markerSizePx: size enum → pixel count mapping
 *   - renderMarkerShape: shape routing → correct React element with props
 */

import { describe, it, expect } from 'vitest';
import { markerSizePx, renderMarkerShape } from '../EventMarkers';

// ── markerSizePx ──────────────────────────────────────────────────────────────

describe('markerSizePx', () => {
  it('maps "small" to 8px', () => {
    expect(markerSizePx('small')).toBe(8);
  });

  it('maps "medium" to 12px', () => {
    expect(markerSizePx('medium')).toBe(12);
  });

  it('maps "large" to 16px', () => {
    expect(markerSizePx('large')).toBe(16);
  });

  it('maps "landmark" to 20px', () => {
    expect(markerSizePx('landmark')).toBe(20);
  });

  it('produces strictly increasing sizes across the hierarchy', () => {
    const sizes = [
      markerSizePx('small'),
      markerSizePx('medium'),
      markerSizePx('large'),
      markerSizePx('landmark'),
    ];
    for (let i = 1; i < sizes.length; i++) {
      // Non-null assertion safe: indices 0–3 always exist in this fixed array
      expect(sizes[i]!).toBeGreaterThan(sizes[i - 1]!);
    }
  });
});

// ── renderMarkerShape ─────────────────────────────────────────────────────────

describe('renderMarkerShape', () => {
  const SIZE = 12;
  const COLOR = '#3b82f6';

  it('returns a non-null element for "circle" shape', () => {
    const el = renderMarkerShape('circle', SIZE, COLOR);
    expect(el).not.toBeNull();
    expect(el).toBeDefined();
  });

  it('passes size and color props through for "circle"', () => {
    const el = renderMarkerShape('circle', SIZE, COLOR);
    expect(el.props.size).toBe(SIZE);
    expect(el.props.color).toBe(COLOR);
  });

  it('returns a non-null element for "diamond" shape', () => {
    const el = renderMarkerShape('diamond', SIZE, COLOR);
    expect(el).not.toBeNull();
    expect(el.props.size).toBe(SIZE);
    expect(el.props.color).toBe(COLOR);
  });

  it('returns a non-null element for "square" shape', () => {
    const el = renderMarkerShape('square', SIZE, COLOR);
    expect(el).not.toBeNull();
    expect(el.props.size).toBe(SIZE);
    expect(el.props.color).toBe(COLOR);
  });

  it('returns a non-null element for "triangle" shape', () => {
    const el = renderMarkerShape('triangle', SIZE, COLOR);
    expect(el).not.toBeNull();
    expect(el.props.size).toBe(SIZE);
    expect(el.props.color).toBe(COLOR);
  });

  it('returns a non-null element for "hexagon" shape', () => {
    const el = renderMarkerShape('hexagon', SIZE, COLOR);
    expect(el).not.toBeNull();
    expect(el.props.size).toBe(SIZE);
    expect(el.props.color).toBe(COLOR);
  });

  it('each shape returns a distinct element type', () => {
    const shapes = ['circle', 'diamond', 'square', 'triangle', 'hexagon'] as const;
    const types = shapes.map((s) => renderMarkerShape(s, SIZE, COLOR).type);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(shapes.length);
  });

  it('correctly passes different colors per shape', () => {
    const red = renderMarkerShape('circle', SIZE, '#ef4444');
    const blue = renderMarkerShape('diamond', SIZE, '#3b82f6');
    expect(red.props.color).toBe('#ef4444');
    expect(blue.props.color).toBe('#3b82f6');
  });

  it('correctly passes different sizes', () => {
    const small = renderMarkerShape('circle', markerSizePx('small'), COLOR);
    const landmark = renderMarkerShape('circle', markerSizePx('landmark'), COLOR);
    expect(small.props.size).toBe(8);
    expect(landmark.props.size).toBe(20);
  });
});
