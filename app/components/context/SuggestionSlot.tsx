'use client';

/**
 * SuggestionSlot — live suggestion counter + Context Library trigger (Sprint 3F + 3G)
 *
 * Sprint 3F: LIBRARY button opens ContextLibrary drawer (suppressed suggestions).
 * Sprint 3G: Counter now reads from the Zustand suggestion store (real-time,
 *            populated fire-and-forget by the chat route). SuggestionPanel
 *            renders the active cards directly below the counter row.
 */

import { useState } from 'react';
import { useSuggestionStore, selectSuggestionCount } from '@/lib/stores/suggestion-store';
import { ContextLibrary } from '@/components/cross-context/ContextLibrary';
import { SuggestionPanel } from '@/components/cross-context/SuggestionPanel';

export function SuggestionSlot() {
  const count = useSuggestionStore(selectSuggestionCount);
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <>
      {/* Counter row */}
      <div
        className="px-4 py-2"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        {count > 0 ? (
          <span className="text-[11px] text-[var(--mist)]">
            Suggestions:{' '}
            <span className="font-mono text-[var(--frost)]">[{count}]</span>
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--mist)', opacity: 0.5 }}>
            No suggestions
          </span>
        )}

        <button
          onClick={() => setLibraryOpen(true)}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            color: 'var(--mist)',
            cursor: 'pointer',
            fontSize: '9px',
            letterSpacing: '0.06em',
            padding: '2px 6px',
          }}
        >
          LIBRARY
        </button>
      </div>

      {/* Active suggestion cards (max 2) */}
      <SuggestionPanel />

      {/* Suppressed suggestions drawer */}
      {libraryOpen && <ContextLibrary onClose={() => setLibraryOpen(false)} />}
    </>
  );
}
