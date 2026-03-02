/**
 * Ghost Zustand Store — Sprint 6F
 *
 * Holds Ghost lifecycle state and surfaced suggestions for the frontend.
 * Hydrated by Tauri event listeners wired in a React useEffect
 * (ghost:status-changed, ghost:suggestion-ready).
 *
 * useGhostStore() — access from any React component
 */

import { create } from 'zustand';
import type { GhostStatus } from '@/lib/ghost/status';
import type { GhostSuggestion } from '@/lib/ghost/scorer/types';

interface GhostStore {
  ghostStatus: GhostStatus | null;
  ghostSuggestions: GhostSuggestion[];

  // Actions
  setGhostStatus: (status: GhostStatus) => void;
  addGhostSuggestion: (suggestion: GhostSuggestion) => void;
  dismissGhostSuggestion: (id: string) => void;
  clearGhostSuggestions: () => void;
}

export const useGhostStore = create<GhostStore>((set) => ({
  ghostStatus: null,
  ghostSuggestions: [],

  setGhostStatus: (status) => set({ ghostStatus: status }),

  addGhostSuggestion: (suggestion) =>
    set((state) => ({
      ghostSuggestions: [
        suggestion,
        ...state.ghostSuggestions.filter((s) => s.id !== suggestion.id),
      ],
    })),

  dismissGhostSuggestion: (id) =>
    set((state) => ({
      ghostSuggestions: state.ghostSuggestions.filter((s) => s.id !== id),
    })),

  clearGhostSuggestions: () => set({ ghostSuggestions: [] }),
}));
