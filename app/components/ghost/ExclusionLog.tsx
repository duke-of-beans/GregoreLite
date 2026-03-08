'use client';
import { apiFetch } from '@/lib/api-client';

/**
 * ExclusionLog — Sprint 6G
 *
 * Read-only table showing the last 100 exclusion log entries.
 * Columns: timestamp, source, layer, reason, pattern that triggered.
 */

import { useEffect, useState } from 'react';

interface LogEntry {
  id: string;
  source_type: string;
  source_path: string;
  layer: number;
  reason: string;
  pattern: string | null;
  logged_at: number;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

const LAYER_LABELS: Record<number, string> = {
  1: 'L1 Hard',
  2: 'L2 PII',
  3: 'L3 Context',
  4: 'L4 Rules',
};

export function ExclusionLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/ghost/exclusion-log')
      .then((r) => r.json())
      .then((data: { entries: LogEntry[] }) => setEntries(data.entries))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-gray-200">Exclusion Log</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Items filtered before indexing. No content from these sources was stored.
        </p>
      </div>

      {loading && <p className="text-xs text-gray-500">Loading…</p>}

      {!loading && entries.length === 0 && (
        <p className="text-xs text-gray-500">No exclusions logged yet.</p>
      )}

      {!loading && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b border-white/10">
                <th className="pb-2 pr-3 font-normal">Time</th>
                <th className="pb-2 pr-3 font-normal">Source</th>
                <th className="pb-2 pr-3 font-normal">Layer</th>
                <th className="pb-2 pr-3 font-normal">Reason</th>
                <th className="pb-2 font-normal">Pattern</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-white/5">
                  <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">
                    {formatDate(entry.logged_at)}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-300 font-mono max-w-[180px] truncate" title={entry.source_path}>
                    {truncate(entry.source_path, 40)}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-400">
                    {LAYER_LABELS[entry.layer] ?? `L${entry.layer}`}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-400">
                    {entry.reason}
                  </td>
                  <td className="py-1.5 text-gray-500 font-mono">
                    {entry.pattern ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
