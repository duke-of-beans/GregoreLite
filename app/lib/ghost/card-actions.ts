/**
 * Ghost Card Actions — Sprint 6H
 *
 * handleTellMeMore(suggestion, threadId)
 *   1. POST /api/ghost/inject — adds chunk as [GHOST CONTEXT - UNTRUSTED CONTENT]
 *      system message to the active KERNL thread
 *   2. POST /api/ghost/suggestions/{id}/feedback { action: 'expanded' }
 *   3. Dismiss card from Zustand store
 *   4. Set ghostContextActive in Zustand (shows indicator banner in ChatInterface)
 *
 * handleNoted(suggestion)
 *   1. POST /api/ghost/suggestions/{id}/feedback { action: 'noted' }
 *   2. Dismiss card from Zustand store
 *
 * Both are fire-and-forget from the UI — errors are swallowed (non-blocking).
 */

import type { GhostSuggestion } from '@/lib/ghost/scorer/types';
import { useGhostStore } from '@/lib/stores/ghost-store';

// ─── handleTellMeMore ─────────────────────────────────────────────────────────

export async function handleTellMeMore(
  suggestion: GhostSuggestion,
  threadId: string | null,
): Promise<void> {
  const { dismissGhostSuggestion, setGhostContextActive } = useGhostStore.getState();

  // Dismiss the card immediately (optimistic)
  dismissGhostSuggestion(suggestion.id);

  // Inject chunk content into thread context
  if (threadId) {
    try {
      await fetch('/api/ghost/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkId: suggestion.chunkId,
          source: suggestion.source,
          threadId,
        }),
      });
    } catch {
      // Non-blocking — injection failure should not surface to user
    }
  }

  // Record 'expanded' feedback
  try {
    await fetch(`/api/ghost/suggestions/${suggestion.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'expanded' }),
    });
  } catch {
    // Non-blocking
  }

  // Show "Ghost context active" indicator in ChatInterface
  if (threadId) {
    setGhostContextActive({ source: suggestion.source, threadId });
  }
}

// ─── handleNoted ─────────────────────────────────────────────────────────────

export async function handleNoted(suggestion: GhostSuggestion): Promise<void> {
  const { dismissGhostSuggestion } = useGhostStore.getState();

  // Dismiss card immediately (optimistic)
  dismissGhostSuggestion(suggestion.id);

  // Record 'noted' feedback + mark dismissed_at on ghost_surfaced
  try {
    await fetch(`/api/ghost/suggestions/${suggestion.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'noted' }),
    });
  } catch {
    // Non-blocking
  }
}
