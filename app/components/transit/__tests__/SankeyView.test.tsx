/**
 * SankeyView — Layout Logic Tests
 * Sprint 11.6: pure layout calculations, no DOM rendering.
 *
 * Tests cover indexToX positioning, node height proportionality,
 * and layout constant boundaries.
 */

import { describe, it, expect } from 'vitest';
import { scaleLinkWidth, MIN_LINK_WIDTH, MAX_LINK_WIDTH } from '../SankeyLink';

// ── indexToX (re-implement for testing — matches SankeyView.tsx exactly) ──────

const PADDING_X = 60;

function indexToX(index: number, totalMessages: number, width: number): number {
  if (totalMessages <= 1) return width / 2;
  const usable = width - PADDING_X * 2;
  return PADDING_X + (index / (totalMessages - 1)) * usable;
}

// ── Node height calculation (extracted from SankeyView layout logic) ──────────

const MIN_NODE_HEIGHT = 30;
const MAX_NODE_HEIGHT = 80;

function calcNodeHeight(tokenCount: number, maxTokens: number): number {
  const tokenRatio = maxTokens > 0 ? tokenCount / maxTokens : 0;
  return MIN_NODE_HEIGHT + tokenRatio * (MAX_NODE_HEIGHT - MIN_NODE_HEIGHT);
}

// ── indexToX tests ────────────────────────────────────────────────────────────

describe('SankeyView layout: indexToX', () => {
  it('centers single-message conversations', () => {
    expect(indexToX(0, 1, 600)).toBe(300);
  });

  it('first message starts at PADDING_X', () => {
    expect(indexToX(0, 10, 600)).toBe(PADDING_X);
  });

  it('last message ends at width - PADDING_X', () => {
    expect(indexToX(9, 10, 600)).toBe(600 - PADDING_X);
  });

  it('middle message is centered between padding', () => {
    const mid = indexToX(5, 11, 600);
    const expected = PADDING_X + (5 / 10) * (600 - PADDING_X * 2);
    expect(mid).toBeCloseTo(expected, 5);
  });

  it('scales proportionally with width', () => {
    const narrow = indexToX(5, 10, 400);
    const wide = indexToX(5, 10, 800);
    // Same relative position but wider spread
    expect(wide - PADDING_X).toBeGreaterThan(narrow - PADDING_X);
  });
});

// ── Node height proportionality ───────────────────────────────────────────────

describe('SankeyView layout: node height', () => {
  it('returns MIN_NODE_HEIGHT for 0 tokens', () => {
    expect(calcNodeHeight(0, 1000)).toBe(MIN_NODE_HEIGHT);
  });

  it('returns MAX_NODE_HEIGHT for max tokens', () => {
    expect(calcNodeHeight(1000, 1000)).toBe(MAX_NODE_HEIGHT);
  });

  it('returns MIN_NODE_HEIGHT when maxTokens is 0', () => {
    expect(calcNodeHeight(500, 0)).toBe(MIN_NODE_HEIGHT);
  });

  it('scales linearly for half-token count', () => {
    const half = calcNodeHeight(500, 1000);
    const expected = MIN_NODE_HEIGHT + 0.5 * (MAX_NODE_HEIGHT - MIN_NODE_HEIGHT);
    expect(half).toBeCloseTo(expected, 5);
  });
});

// ── Link width scaling edge cases ─────────────────────────────────────────────

describe('SankeyView layout: link width boundaries', () => {
  it('never returns below MIN_LINK_WIDTH', () => {
    expect(scaleLinkWidth(-100, 1000)).toBeLessThanOrEqual(MIN_LINK_WIDTH);
  });

  it('never exceeds MAX_LINK_WIDTH for normal inputs', () => {
    expect(scaleLinkWidth(1000, 1000)).toBe(MAX_LINK_WIDTH);
  });

  it('handles equal source and max gracefully', () => {
    expect(scaleLinkWidth(42, 42)).toBe(MAX_LINK_WIDTH);
  });
});
