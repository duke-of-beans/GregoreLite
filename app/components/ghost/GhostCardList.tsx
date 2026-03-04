'use client';

/**
 * GhostCardList — Sprint 6H
 *
 * Renders the "From Ghost" section in the Context Panel.
 * - Listens to ghost:suggestion-ready Tauri events and feeds suggestions
 *   into the Zustand ghostSuggestions array.
 * - On every render, filters out suggestions where Date.now() > expiresAt
 *   (no setTimeout — render-time check per spec §6H auto-expire).
 * - Enforces max 2 visible cards (scorer caps at 2/24h, but UI double-enforces).
 * - Section header only shown when at least one active, non-expired card exists.
 * - Reads activeThreadId from ghost store (written by ChatInterface on thread set).
 */

import { useEffect } from 'react';
import type { GhostSuggestion } from '@/lib/ghost/scorer/types';
import { useGhostStore } from '@/lib/stores/ghost-store';
import { GhostCard } from './GhostCard';

export function GhostCardList() {
  const ghostSuggestions = useGhostStore((s) => s.ghostSuggestions);
  const addGhostSuggestion = useGhostStore((s) => s.addGhostSuggestion);
  const dismissGhostSuggestion = useGhostStore((s) => s.dismissGhostSuggestion);
  const activeThreadId = useGhostStore((s) => s.activeThreadId);

  // ── Tauri event listener for ghost:suggestion-ready ───────────────────────
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    async function subscribe() {
      try {
        const eventMod = await import('@tauri-apps/api/event').catch(() => null);
        if (!eventMod) return; // Running in browser dev mode — no-op

        const fn = await eventMod.listen<GhostSuggestion>(
          'ghost:suggestion-ready',
          (event) => {
            addGhostSuggestion(event.payload);
          }
        );
        unlisten = fn;
      } catch {
        // Tauri not available — store populated via direct writes in dev/tests
      }
    }

    void subscribe();

    return () => {
      unlisten?.();
    };
  }, [addGhostSuggestion]);

  // ── Auto-expire: filter on render (no setTimeout) ─────────────────────────
  const now = Date.now();
  const active = ghostSuggestions
    .filter((s) => s.expiresAt > now)
    .slice(0, 2); // UI-level max-2 cap

  // Prune expired entries from the store as a side effect
  useEffect(() => {
    const expired = ghostSuggestions.filter((s) => s.expiresAt <= now);
    for (const s of expired) {
      dismissGhostSuggestion(s.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostSuggestions.length]);

  // No active cards → render nothing (no empty state per spec)
  if (active.length === 0) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '0 0 4px 0' }}>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 16px 4px',
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 20 20"
          fill="currentColor"
          style={{ color: 'var(--teal-400, #2dd4bf)', flexShrink: 0 }}
          aria-hidden
        >
          <path d="M10 3C5 3 1.73 7.11 1.05 9.78a1 1 0 000 .44C1.73 12.89 5 17 10 17s8.27-4.11 8.95-6.78a1 1 0 000-.44C18.27 7.11 15 3 10 3zm0 11a4 4 0 110-8 4 4 0 010 8zm0-6a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            color: 'var(--mist, #888)',
          }}
        >
          From Ghost
        </span>
      </div>

      {/* Cards */}
      <div style={{ padding: '0 12px' }}>
        {active.map((suggestion) => (
          <GhostCard
            key={suggestion.id}
            suggestion={suggestion}
            threadId={activeThreadId}
          />
        ))}
      </div>
    </div>
  );
}
