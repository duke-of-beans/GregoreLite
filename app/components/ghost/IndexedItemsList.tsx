'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IndexedItemRow } from './IndexedItemRow';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'file' | 'email';
type FilterTime  = 'all' | 'today' | 'week';

interface IndexedItem {
  id: string;
  source_type: string;
  source_path: string;
  source_account: string | null;
  chunk_count: number;
  indexed_at: number;
  deleted: number;
  deleted_at: number | null;
  critical: number;
}

interface SummaryCounts {
  total: number;
  file: number;
  email: number;
}

interface ItemsResponse {
  items: IndexedItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: SummaryCounts;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUrl(
  typeFilter: FilterType,
  timeFilter: FilterTime,
  search: string,
  page: number,
): string {
  const params = new URLSearchParams({ page: String(page) });

  if (typeFilter !== 'all') params.set('type', typeFilter);

  if (search.trim()) params.set('search', search.trim());

  if (timeFilter !== 'all') {
    const now = Date.now();
    const cutoff =
      timeFilter === 'today'
        ? now - 86_400_000
        : now - 7 * 86_400_000;
    params.set('since', String(cutoff));
  }

  return `/api/ghost/items?${params.toString()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IndexedItemsList() {
  const [items,       setItems]       = useState<IndexedItem[]>([]);
  const [summary,     setSummary]     = useState<SummaryCounts>({ total: 0, file: 0, email: 0 });
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [typeFilter,  setTypeFilter]  = useState<FilterType>('all');
  const [timeFilter,  setTimeFilter]  = useState<FilterTime>('all');
  const [search,      setSearch]      = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Debounce search input 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [typeFilter, timeFilter]);

  // Fetch items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildUrl(typeFilter, timeFilter, debouncedSearch, page);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ItemsResponse = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load indexed items');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, timeFilter, debouncedSearch, page]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Delete handler — removes optimistically then re-fetches
  const handleDelete = useCallback(async (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    const res = await fetch(`/api/ghost/items?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) await fetchItems(); // rollback on failure
    else await fetchItems();         // refresh summary counts
  }, [fetchItems]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span>{summary.total.toLocaleString()} total</span>
        <span className="text-blue-500">{summary.file.toLocaleString()} files</span>
        <span className="text-purple-500">{summary.email.toLocaleString()} emails</span>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type filter */}
        <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 text-xs font-medium">
          {(['all', 'file', 'email'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1.5 transition-colors ${
                typeFilter === f
                  ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              {f === 'all' ? 'All' : f === 'file' ? 'Files' : 'Emails'}
            </button>
          ))}
        </div>

        {/* Time filter */}
        <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 text-xs font-medium">
          {([['all', 'All time'], ['today', 'Today'], ['week', 'This week']] as [FilterTime, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`px-3 py-1.5 transition-colors ${
                timeFilter === f
                  ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search paths or subjects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* Refresh button */}
        <button
          onClick={fetchItems}
          disabled={loading}
          title="Refresh"
          className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-40 transition-colors"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="py-2 px-3 w-8" />
              <th className="py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Source</th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Indexed</th>
              <th className="py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-right">Chunks</th>
              <th className="py-2 px-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-xs text-gray-400 dark:text-gray-500">
                  No indexed items match the current filters.
                </td>
              </tr>
            )}

            {items.map(item => (
              <IndexedItemRow
                key={item.id}
                item={{
                  id: item.id,
                  source_type: item.source_type,
                  source_path: item.source_path,
                  source_account: item.source_account,
                  chunk_count: item.chunk_count,
                  indexed_at: item.indexed_at,
                }}
                onDelete={handleDelete}
              />
            ))}

            {loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-xs text-gray-400 dark:text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
