/**
 * Artifact Zustand Store — Sprint 2D
 *
 * Owns the single active artifact visible in the ArtifactPanel.
 * ChatInterface writes to this store; ArtifactPanel reads from it.
 * Message code blocks also write to it via setArtifact (open-in-editor).
 */

import { create } from 'zustand';
import type { Artifact } from './types';

interface ArtifactState {
  /** The artifact currently open in the panel. null = panel closed. */
  activeArtifact: Artifact | null;

  /** Open the artifact panel with a given artifact. */
  setArtifact: (artifact: Artifact) => void;

  /** Close the artifact panel and clear state. */
  clearArtifact: () => void;
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  activeArtifact: null,

  setArtifact: (artifact) => set({ activeArtifact: artifact }),

  clearArtifact: () => set({ activeArtifact: null }),
}));
