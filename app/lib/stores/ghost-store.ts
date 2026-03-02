/**
 * Ghost Zustand Store — Sprint 6F / 6H
 *
 * Holds Ghost lifecycle state and surfaced suggestions for the frontend.
 * Hydrated by Tauri event listeners wired in GhostCardList useEffect
 * (ghost:status-changed, ghost:suggestion-ready).
 *
 * Sprint 6H adds ghostContextActive — tracks whether Tell me more context
 * has been injected into the active thread (used to show the indicator banner).
 *
 * useGhostStore() — access from any React component
 */

import { create } from 'zustand';
import type { GhostStatus } from '@/lib/ghost/status';
import type { GhostSuggestion } from '@/lib/ghost/scorer/types';

export interface GhostContextActive {
  /** Source label shown in the indicator (e.g. "File: /path/to/doc.md") */
  source: string;
  /** The KERNL thread the context was injected into */
  threadId: string;
}

interface GhostStore {
  ghostStatus: GhostStatus | null;
  ghostSuggestions: GhostSuggestion[];
  ghostContextActive: GhostContextActive | null;
  /** KERNL thread ID of the currently active strategic thread */
  activeThreadId: string | null;

  // Actions
  setGhostStatus: (status: GhostStatus) => void;
  addGhostSuggestion: (suggestion: GhostSuggestion) => void;
  dismissGhostSuggestion: (id: string) => void;
  clearGhostSuggestions: () => void;
  setGhostContextActive: (ctx: GhostContextActive) => void;
  clearGhostContextActive: () => void;
  setActiveThreadId: (id: string | null) => void;
}

export const useGhostStore = create<GhostStore>((set) => ({
  ghostStatus: null,
  ghostSuggestions: [],
  ghostContextActive: null,
  activeThreadId: null,

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

  setGhostContextActive: (ctx) => set({ ghostContextActive: ctx }),

  clearGhostContextActive: () => set({ ghostContextActive: null }),

  setActiveThreadId: (id) => set({ activeThreadId: id }),
}));
