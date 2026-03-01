'use client';

/**
 * SuggestionPanel — max-2 suggestion card container (Sprint 3G)
 *
 * Renders up to 2 SuggestionCard components from the Zustand suggestion store.
 * Returns null when there are no active suggestions (no-op render).
 *
 * @module components/cross-context/SuggestionPanel
 */

import { useSuggestionStore } from '@/lib/stores/suggestion-store';
import { SuggestionCard } from './SuggestionCard';

export function SuggestionPanel() {
  const suggestions = useSuggestionStore((s) => s.suggestions);
  const removeSuggestion = useSuggestionStore((s) => s.removeSuggestion);

  if (suggestions.length === 0) return null;

  return (
    <div
      className="suggestion-panel"
      style={{ padding: '4px 8px 0 8px' }}
    >
      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onDismiss={removeSuggestion}
        />
      ))}
    </div>
  );
}
