/**
 * Suggestion Store — Zustand (Sprint 3G)
 *
 * Holds the active proactive suggestions shown in the context panel.
 * Max 2 at a time. Each suggestion auto-expires after 4 hours via setTimeout.
 *
 * Populated fire-and-forget from the chat route after every user message.
 * Consumed by SuggestionPanel and SuggestionSlot.
 *
 * @module lib/stores/suggestion-store
 */

import { create } from 'zustand';
import type { Suggestion } from '@/lib/cross-context/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SUGGESTIONS = 2;
const EXPIRE_MS = 4 * 60 * 60 * 1000; // 4 hours

// ── Store types ───────────────────────────────────────────────────────────────

interface SuggestionStoreState {
  suggestions: Suggestion[];
}

interface SuggestionStoreActions {
  /**
   * Replace current suggestions with incoming list (capped at MAX_SUGGESTIONS).
   * Each suggestion is scheduled for auto-expiry after EXPIRE_MS.
   */
  setSuggestions: (suggestions: Suggestion[]) => void;
  /** Remove a single suggestion by id (called on dismiss or expire). */
  removeSuggestion: (id: string) => void;
  /** Clear all active suggestions. */
  clearSuggestions: () => void;
}

export type SuggestionStore = SuggestionStoreState & SuggestionStoreActions;

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSuggestionStore = create<SuggestionStore>((set, get) => ({
  suggestions: [],

  setSuggestions: (incoming: Suggestion[]) => {
    const limited = incoming.slice(0, MAX_SUGGESTIONS);
    set({ suggestions: limited });

    // Schedule auto-expiry for each suggestion
    for (const suggestion of limited) {
      setTimeout(() => {
        get().removeSuggestion(suggestion.id);
      }, EXPIRE_MS);
    }
  },

  removeSuggestion: (id: string) => {
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== id),
    }));
  },

  clearSuggestions: () => {
    set({ suggestions: [] });
  },
}));

// ── Selectors ─────────────────────────────────────────────────────────────────

/** Returns the current suggestion count (0–2). */
export const selectSuggestionCount = (state: SuggestionStore) =>
  state.suggestions.length;

/** Returns all active suggestions. */
export const selectSuggestions = (state: SuggestionStore) =>
  state.suggestions;
