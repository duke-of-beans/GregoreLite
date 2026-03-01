'use client';

import { useContextPanel } from '@/lib/context/context-provider';

/**
 * SuggestionSlot — Phase 3 placeholder.
 * Displays pending suggestion count stub. Cross-Context engine activates this
 * in Phase 3. Zero functional logic here — display only.
 */
export function SuggestionSlot() {
  const { state } = useContextPanel();

  return (
    <div className="px-4 py-2">
      <span className="text-[11px] text-[var(--mist)]">
        Suggestions:{' '}
        <span className="font-mono text-[var(--frost)]">
          [{state.pendingSuggestions}]
        </span>
      </span>
    </div>
  );
}
