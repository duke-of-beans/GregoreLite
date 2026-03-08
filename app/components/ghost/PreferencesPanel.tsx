'use client';
import { apiFetch } from '@/lib/api-client';

/**
 * PreferencesPanel — Sprint 9-06
 *
 * Lists all ghost_preferences rows in the Privacy Dashboard "Preferences" tab.
 * Each row shows topic_hint, source_type, boost_factor (editable slider),
 * use_count, and a delete button.
 */

import { useCallback, useEffect, useState } from 'react';

interface Preference {
  id: string;
  source_type: string | null;
  topic_hint: string;
  boost_factor: number;
  created_at: number;
  use_count: number;
}

export function PreferencesPanel() {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await apiFetch('/api/ghost/preferences');
      if (res.ok) {
        const data = (await res.json()) as { preferences: Preference[] };
        setPreferences(data.preferences);
      }
    } catch {
      /* best effort */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPreferences();
  }, [fetchPreferences]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ghost/preferences?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setPreferences((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      /* best effort */
    }
  }, []);

  const handleBoostChange = useCallback(async (id: string, boostFactor: number) => {
    try {
      await apiFetch('/api/ghost/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, boost_factor: boostFactor }),
      });
      setPreferences((prev) =>
        prev.map((p) => (p.id === id ? { ...p, boost_factor: boostFactor } : p))
      );
    } catch {
      /* best effort */
    }
  }, []);

  if (loading) {
    return <p className="text-xs text-gray-400">Loading preferences…</p>;
  }

  if (preferences.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">No preferences yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Use the &ldquo;Teach Ghost&rdquo; button on any Ghost card to boost similar content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Preferences boost Ghost&apos;s scoring for matching content. Exclusions always override preferences.
      </p>
      {preferences.map((pref) => (
        <div
          key={pref.id}
          className="flex items-start gap-3 p-3 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {pref.topic_hint}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 whitespace-nowrap">
                {pref.source_type ?? 'any'}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <label className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Boost: {pref.boost_factor.toFixed(1)}x
              </label>
              <input
                type="range"
                min={1.0}
                max={3.0}
                step={0.1}
                value={pref.boost_factor}
                onChange={(e) => void handleBoostChange(pref.id, parseFloat(e.target.value))}
                className="flex-1 h-1 accent-teal-500"
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              Fired {pref.use_count} time{pref.use_count !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => void handleDelete(pref.id)}
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
            title="Remove preference"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
