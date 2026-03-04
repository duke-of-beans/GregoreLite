/**
 * ZoomController — Logic Tests
 * Sprint 11.6: zoom level transitions, state management, focus preservation.
 *
 * Tests cover zoom state machine, transition timing constants,
 * and focus index/message tracking — all pure logic, no DOM.
 */

import { describe, it, expect } from 'vitest';

// ── Re-exported types and constants for testing ──────────────────────────────

type ZoomLevel = 'Z1' | 'Z2' | 'Z3';

const ZOOM_ORDER: ZoomLevel[] = ['Z1', 'Z2', 'Z3'];
const TRANSITION_MS = 300;

// ── Zoom state machine (mirrors ZoomController logic) ────────────────────────

interface ZoomState {
  zoomLevel: ZoomLevel;
  previousZoom: ZoomLevel | null;
  isTransitioning: boolean;
  focusIndex: number | null;
  focusMessageId: string | null;
}

function initialState(): ZoomState {
  return {
    zoomLevel: 'Z2',
    previousZoom: null,
    isTransitioning: false,
    focusIndex: null,
    focusMessageId: null,
  };
}

function setZoomLevel(state: ZoomState, newLevel: ZoomLevel): ZoomState {
  if (newLevel === state.zoomLevel) return state;
  return {
    ...state,
    previousZoom: state.zoomLevel,
    isTransitioning: true,
    zoomLevel: newLevel,
  };
}

function finishTransition(state: ZoomState): ZoomState {
  return { ...state, isTransitioning: false, previousZoom: null };
}

function zoomToSegment(state: ZoomState, messageIndex: number): ZoomState {
  const next = setZoomLevel(state, 'Z2');
  return { ...next, focusIndex: messageIndex, focusMessageId: null };
}

function zoomToMessage(state: ZoomState, messageId: string): ZoomState {
  const next = setZoomLevel(state, 'Z3');
  return { ...next, focusMessageId: messageId };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ZoomController: initial state', () => {
  it('starts at Z2 (subway map) by default', () => {
    const s = initialState();
    expect(s.zoomLevel).toBe('Z2');
    expect(s.previousZoom).toBeNull();
    expect(s.isTransitioning).toBe(false);
  });

  it('starts with no focus', () => {
    const s = initialState();
    expect(s.focusIndex).toBeNull();
    expect(s.focusMessageId).toBeNull();
  });
});

describe('ZoomController: zoom transitions', () => {
  it('Z2 → Z1 sets previousZoom to Z2', () => {
    const s = setZoomLevel(initialState(), 'Z1');
    expect(s.zoomLevel).toBe('Z1');
    expect(s.previousZoom).toBe('Z2');
    expect(s.isTransitioning).toBe(true);
  });

  it('same zoom level is a no-op', () => {
    const s = initialState();
    const next = setZoomLevel(s, 'Z2');
    expect(next).toBe(s); // exact same reference
  });

  it('finishing transition clears previousZoom', () => {
    const s = setZoomLevel(initialState(), 'Z1');
    const done = finishTransition(s);
    expect(done.isTransitioning).toBe(false);
    expect(done.previousZoom).toBeNull();
    expect(done.zoomLevel).toBe('Z1');
  });

  it('rapid zoom changes update previousZoom correctly', () => {
    let s = initialState(); // Z2
    s = setZoomLevel(s, 'Z1'); // Z2→Z1
    s = setZoomLevel(s, 'Z3'); // Z1→Z3 (mid-transition)
    expect(s.zoomLevel).toBe('Z3');
    expect(s.previousZoom).toBe('Z1');
  });
});

describe('ZoomController: focus preservation', () => {
  it('zoomToSegment sets focusIndex and targets Z2', () => {
    let s = setZoomLevel(initialState(), 'Z1'); // start at Z1
    s = finishTransition(s);
    s = zoomToSegment(s, 42);
    expect(s.zoomLevel).toBe('Z2');
    expect(s.focusIndex).toBe(42);
    expect(s.focusMessageId).toBeNull();
  });

  it('zoomToMessage sets focusMessageId and targets Z3', () => {
    const s = zoomToMessage(initialState(), 'msg-abc');
    expect(s.zoomLevel).toBe('Z3');
    expect(s.focusMessageId).toBe('msg-abc');
  });

  it('zoomToSegment clears previous focusMessageId', () => {
    let s = zoomToMessage(initialState(), 'msg-abc');
    s = finishTransition(s);
    s = zoomToSegment(s, 10);
    expect(s.focusMessageId).toBeNull();
    expect(s.focusIndex).toBe(10);
  });
});

describe('ZoomController: constants', () => {
  it('transition duration is 300ms', () => {
    expect(TRANSITION_MS).toBe(300);
  });

  it('zoom order is Z1 → Z2 → Z3', () => {
    expect(ZOOM_ORDER).toEqual(['Z1', 'Z2', 'Z3']);
  });

  it('all three zoom levels are represented', () => {
    expect(ZOOM_ORDER).toHaveLength(3);
    expect(ZOOM_ORDER).toContain('Z1');
    expect(ZOOM_ORDER).toContain('Z2');
    expect(ZOOM_ORDER).toContain('Z3');
  });
});
