/**
 * suggestion-store — unit tests (Sprint 3G)
 *
 * Tests: setSuggestions, removeSuggestion, clearSuggestions, auto-expire,
 * max-2 cap, selectors.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSuggestionStore, selectSuggestionCount, selectSuggestions } from '@/lib/stores/suggestion-store';
import type { Suggestion } from '@/lib/cross-context/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSuggestion(id: string, displayScore = 0.85): Suggestion {
  return {
    id,
    chunkId: `chunk-${id}`,
    content: `Content for suggestion ${id}`,
    sourceType: 'conversation',
    sourceId: `thread-${id}`,
    similarityScore: 0.9,
    displayScore,
    surfacedAt: Date.now(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSuggestionStore', () => {
  beforeEach(() => {
    useSuggestionStore.setState({ suggestions: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── setSuggestions ─────────────────────────────────────────────────────────

  it('stores suggestions returned by setSuggestions', () => {
    const suggestions = [makeSuggestion('a'), makeSuggestion('b')];
    useSuggestionStore.getState().setSuggestions(suggestions);
    expect(useSuggestionStore.getState().suggestions).toHaveLength(2);
  });

  it('caps at 2 suggestions even if more are passed', () => {
    const suggestions = [
      makeSuggestion('a'),
      makeSuggestion('b'),
      makeSuggestion('c'),
    ];
    useSuggestionStore.getState().setSuggestions(suggestions);
    expect(useSuggestionStore.getState().suggestions).toHaveLength(2);
    // First two are kept
    expect(useSuggestionStore.getState().suggestions[0]?.id).toBe('a');
    expect(useSuggestionStore.getState().suggestions[1]?.id).toBe('b');
  });

  it('replaces existing suggestions on subsequent setSuggestions', () => {
    useSuggestionStore.getState().setSuggestions([makeSuggestion('a')]);
    useSuggestionStore.getState().setSuggestions([makeSuggestion('b')]);
    const { suggestions } = useSuggestionStore.getState();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.id).toBe('b');
  });

  it('stores empty array when empty list passed', () => {
    useSuggestionStore.getState().setSuggestions([makeSuggestion('a')]);
    useSuggestionStore.getState().setSuggestions([]);
    expect(useSuggestionStore.getState().suggestions).toHaveLength(0);
  });

  // ── Auto-expire ────────────────────────────────────────────────────────────

  it('auto-expires suggestions after 4 hours', () => {
    useSuggestionStore.getState().setSuggestions([makeSuggestion('exp')]);
    expect(useSuggestionStore.getState().suggestions).toHaveLength(1);

    vi.advanceTimersByTime(4 * 60 * 60 * 1000);

    expect(useSuggestionStore.getState().suggestions).toHaveLength(0);
  });

  it('does not expire suggestions before 4 hours', () => {
    useSuggestionStore.getState().setSuggestions([makeSuggestion('keep')]);

    vi.advanceTimersByTime(4 * 60 * 60 * 1000 - 1000); // 1s before expiry

    expect(useSuggestionStore.getState().suggestions).toHaveLength(1);
  });

  // ── removeSuggestion ───────────────────────────────────────────────────────

  it('removes a suggestion by id', () => {
    useSuggestionStore.getState().setSuggestions([makeSuggestion('x'), makeSuggestion('y')]);
    useSuggestionStore.getState().removeSuggestion('x');
    const { suggestions } = useSuggestionStore.getState();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.id).toBe('y');
  });

  it('is a no-op when id does not exist', () => {
    useSuggestionStore.getState().setSuggestions([makeSuggestion('z')]);
    useSuggestionStore.getState().removeSuggestion('nonexistent');
    expect(useSuggestionStore.getState().suggestions).toHaveLength(1);
  });

  // ── clearSuggestions ───────────────────────────────────────────────────────

  it('clears all suggestions', () => {
    useSuggestionStore.getState().setSuggestions([makeSuggestion('a'), makeSuggestion('b')]);
    useSuggestionStore.getState().clearSuggestions();
    expect(useSuggestionStore.getState().suggestions).toHaveLength(0);
  });

  // ── Selectors ──────────────────────────────────────────────────────────────

  it('selectSuggestionCount returns correct count', () => {
    useSuggestionStore.getState().setSuggestions([makeSuggestion('a'), makeSuggestion('b')]);
    const state = useSuggestionStore.getState();
    expect(selectSuggestionCount(state)).toBe(2);
  });

  it('selectSuggestions returns full suggestion array', () => {
    const s = makeSuggestion('q');
    useSuggestionStore.getState().setSuggestions([s]);
    const state = useSuggestionStore.getState();
    expect(selectSuggestions(state)).toEqual([s]);
  });
});
