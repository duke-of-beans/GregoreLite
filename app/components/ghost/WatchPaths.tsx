'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Component ────────────────────────────────────────────────────────────────

export function WatchPaths() {
  const [paths,    setPaths]    = useState<string[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [newPath,  setNewPath]  = useState('');
  const [adding,   setAdding]   = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch current watch paths
  const fetchPaths = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ghost/watch-paths');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPaths(data.paths ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watch paths');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPaths(); }, [fetchPaths]);

  // Add path via text input
  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPath.trim();
    if (!trimmed) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch('/api/ghost/watch-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setNewPath('');
      await fetchPaths();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add watch path');
    } finally {
      setAdding(false);
      inputRef.current?.focus();
    }
  }, [newPath, fetchPaths]);

  // Remove path
  const handleRemove = useCallback(async (path: string) => {
    setPaths(prev => prev.filter(p => p !== path));
    const res = await fetch(`/api/ghost/watch-paths?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
    if (!res.ok) await fetchPaths(); // rollback
  }, [fetchPaths]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-0.5">
          Watched directories
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Ghost monitors these directories for file changes. Subdirectories are included recursively.
          Changes take effect on the next watcher cycle.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Path list */}
      <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        {!loading && paths.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
            No directories being watched. Add one below.
          </div>
        )}

        {loading && (
          <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
            Loading…
          </div>
        )}

        {paths.map(path => (
          <div
            key={path}
            className="group flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-750 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            {/* Folder icon + path */}
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-4 h-4 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293L10.414 6.5H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">{path}</span>
            </div>

            {/* Remove button */}
            <button
              onClick={() => handleRemove(path)}
              title="Stop watching this directory"
              className="opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2 p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add path form */}
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
            placeholder="/Users/me/Documents  or  C:\Users\me\Documents"
            spellCheck={false}
            className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-mono text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={adding || !newPath.trim()}
            className="px-3 py-1.5 rounded-md bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-xs font-medium disabled:opacity-40 hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors whitespace-nowrap"
          >
            {adding ? 'Adding…' : 'Add path'}
          </button>
        </div>
        {addError && (
          <p className="text-xs text-red-600 dark:text-red-400">{addError}</p>
        )}
      </form>
    </div>
  );
}
