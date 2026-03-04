/**
 * failure-modes-shim-loop.test.ts — Sprint 11.1
 * Tests for the detectShimLoop() implementation.
 */

import { describe, it, expect } from 'vitest';
import { detectShimLoop } from '../failure-modes';

describe('detectShimLoop', () => {
  it('returns false when fewer than 3 calls exist', () => {
    expect(detectShimLoop([])).toBe(false);
    expect(detectShimLoop([{ file: 'a.ts', score: 50 }])).toBe(false);
    expect(detectShimLoop([
      { file: 'a.ts', score: 50 },
      { file: 'a.ts', score: 60 },
    ])).toBe(false);
  });

  it('returns false when scores are improving (no loop)', () => {
    const history = [
      { file: 'a.ts', score: 50 },
      { file: 'a.ts', score: 60 },
      { file: 'a.ts', score: 70 },
    ];
    expect(detectShimLoop(history)).toBe(false);
  });

  it('returns true when scores are flat (loop detected)', () => {
    const history = [
      { file: 'a.ts', score: 50 },
      { file: 'a.ts', score: 50 },
      { file: 'a.ts', score: 50 },
    ];
    expect(detectShimLoop(history)).toBe(true);
  });

  it('returns true when scores are declining (loop detected)', () => {
    const history = [
      { file: 'a.ts', score: 50 },
      { file: 'a.ts', score: 45 },
      { file: 'a.ts', score: 40 },
    ];
    expect(detectShimLoop(history)).toBe(true);
  });

  it('returns true when second step improves but third does not', () => {
    // score[1] > score[0] so NOT a loop (improvement occurred in first step)
    const history = [
      { file: 'a.ts', score: 50 },
      { file: 'a.ts', score: 60 },
      { file: 'a.ts', score: 58 }, // regression on last step — but first improved
    ];
    // b.score (60) > a.score (50) — first step improved, so detectShimLoop = false
    expect(detectShimLoop(history)).toBe(false);
  });

  it('returns true when first step flat and second step declines', () => {
    const history = [
      { file: 'a.ts', score: 50 },
      { file: 'a.ts', score: 50 }, // no improvement
      { file: 'a.ts', score: 48 }, // decline
    ];
    expect(detectShimLoop(history)).toBe(true);
  });

  it('mixed files: 3 improving calls on file A, 3 flat calls on file B → true (B triggers)', () => {
    const history = [
      { file: 'a.ts', score: 50 },
      { file: 'b.ts', score: 60 },
      { file: 'a.ts', score: 60 },
      { file: 'b.ts', score: 60 },
      { file: 'a.ts', score: 70 },
      { file: 'b.ts', score: 60 }, // 3rd call on b.ts — flat, loop detected
    ];
    // Most recent file is b.ts; last 3 b.ts calls: 60 → 60 → 60 → loop
    expect(detectShimLoop(history)).toBe(true);
  });

  it('mixed files: 3 improving calls on file A, 3 improving calls on file B → false', () => {
    const history = [
      { file: 'a.ts', score: 50 },
      { file: 'b.ts', score: 55 },
      { file: 'a.ts', score: 60 },
      { file: 'b.ts', score: 65 },
      { file: 'a.ts', score: 70 },
      { file: 'b.ts', score: 75 },
    ];
    expect(detectShimLoop(history)).toBe(false);
  });

  it('only considers the most recently seen file, not all files', () => {
    // b.ts has a loop, a.ts has improvement. Last call is a.ts (no loop for a.ts).
    const history = [
      { file: 'b.ts', score: 50 },
      { file: 'b.ts', score: 50 },
      { file: 'b.ts', score: 50 }, // b.ts loop
      { file: 'a.ts', score: 60 },
      { file: 'a.ts', score: 70 },
      { file: 'a.ts', score: 80 }, // a.ts improving — last file
    ];
    // Most recent file is a.ts; last 3 a.ts: 60 → 70 → 80 — no loop
    expect(detectShimLoop(history)).toBe(false);
  });
});
