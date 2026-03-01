'use client';

import { useState } from 'react';
import { useContextPanel } from '@/lib/context/context-provider';
import { ContextLibrary } from '@/components/cross-context/ContextLibrary';

/**
 * SuggestionSlot — suggestions count + Context Library trigger (Sprint 3F)
 *
 * Shows pending suggestion count (from context panel state).
 * "Library" button opens the ContextLibrary drawer to view and un-suppress
 * dismissed suggestions.
 */
export function SuggestionSlot() {
  const { state } = useContextPanel();
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <>
      <div
        className="px-4 py-2"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span className="text-[11px] text-[var(--mist)]">
          Suggestions:{' '}
          <span className="font-mono text-[var(--frost)]">
            [{state.pendingSuggestions}]
          </span>
        </span>
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

      {libraryOpen && <ContextLibrary onClose={() => setLibraryOpen(false)} />}
    </>
  );
}
