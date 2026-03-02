'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExclusionRule {
  id: number;
  type: string;
  pattern: string;
  created_at: number;
  note: string | null;
}

const VALID_TYPES = ['path', 'email', 'domain', 'keyword'] as const;
type RuleType = (typeof VALID_TYPES)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  path:    'Path prefix',
  email:   'Email address',
  domain:  'Email domain',
  keyword: 'Keyword',
};

const TYPE_PLACEHOLDER: Record<string, string> = {
  path:    '/Users/me/Private/',
  email:   'boss@company.com',
  domain:  '@company.com',
  keyword: 'confidential',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ExclusionRules() {
  const [rules,   setRules]   = useState<ExclusionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // New rule form state
  const [newType,    setNewType]    = useState<RuleType>('path');
  const [newPattern, setNewPattern] = useState('');
  const [newNote,    setNewNote]    = useState('');
  const [adding,     setAdding]     = useState(false);
  const [addError,   setAddError]   = useState<string | null>(null);

  // Fetch rules
  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ghost/exclusions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRules(data.rules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exclusion rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // Add rule
  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch('/api/ghost/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newType,
          pattern: newPattern.trim(),
          note: newNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setNewPattern('');
      setNewNote('');
      await fetchRules();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add rule');
    } finally {
      setAdding(false);
    }
  }, [newType, newPattern, newNote, fetchRules]);

  // Delete rule
  const handleDelete = useCallback(async (id: number) => {
    setRules(prev => prev.filter(r => r.id !== id));
    const res = await fetch(`/api/ghost/exclusions?id=${id}`, { method: 'DELETE' });
    if (!res.ok) await fetchRules(); // rollback
  }, [fetchRules]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Layer 3 read-only callout */}
      <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2.5">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Layer 3 — Context exclusions (automatic)</p>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Ghost automatically skips low-value content: system files, binaries, lock files, temp
          directories, and content under 30 characters. These rules cannot be edited.
        </p>
      </div>

      {/* Layer 4 heading */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-0.5">
          Layer 4 — User exclusion rules
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Ghost will never index paths, email addresses, domains, or content matching these rules.
          Changes take effect immediately on the next ingest cycle.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Existing rules table */}
      <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="grid grid-cols-[6rem_1fr_8rem_2.5rem] gap-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
          <span>Type</span>
          <span>Pattern</span>
          <span>Added</span>
          <span />
        </div>

        {!loading && rules.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
            No exclusion rules yet.
          </div>
        )}

        {loading && (
          <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
            Loading…
          </div>
        )}

        {rules.map(rule => (
          <div
            key={rule.id}
            className="group grid grid-cols-[6rem_1fr_8rem_2.5rem] gap-0 items-center px-3 py-2 border-b border-gray-100 dark:border-gray-750 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            {/* Type badge */}
            <span className="inline-flex items-center">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {TYPE_LABELS[rule.type] ?? rule.type}
              </span>
            </span>

            {/* Pattern + optional note */}
            <div className="min-w-0">
              <span className="block font-mono text-xs text-gray-800 dark:text-gray-200 truncate">
                {rule.pattern}
              </span>
              {rule.note && (
                <span className="block text-[10px] text-gray-400 dark:text-gray-500 truncate">
                  {rule.note}
                </span>
              )}
            </div>

            {/* Created date */}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(rule.created_at).toLocaleDateString()}
            </span>

            {/* Delete */}
            <button
              onClick={() => handleDelete(rule.id)}
              title="Remove rule"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add rule form */}
      <div className="rounded-md border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Add exclusion rule</h4>

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            {/* Type select */}
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as RuleType)}
              className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {VALID_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>

            {/* Pattern input */}
            <input
              type="text"
              value={newPattern}
              onChange={e => setNewPattern(e.target.value)}
              placeholder={TYPE_PLACEHOLDER[newType]}
              required
              className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-mono text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Optional note */}
          <input
            type="text"
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Optional note (e.g. 'Medical records')"
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {addError && (
            <div className="text-xs text-red-600 dark:text-red-400">{addError}</div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={adding || !newPattern.trim()}
              className="px-3 py-1.5 rounded-md bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs font-medium disabled:opacity-40 hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors"
            >
              {adding ? 'Adding…' : 'Add rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
