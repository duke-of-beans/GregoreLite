'use client';
import { apiFetch } from '@/lib/api-client';
/**
 * KernlTab (Memory) — S9-14
 * Memory database stats: file size, total threads, total chunks, last indexer run.
 */


import { useState, useEffect } from 'react';

interface KernlStats {
  dbSizeMB: number;
  totalTables: number;
  totalThreads: number;
  totalMessages: number;
  totalDecisions: number;
  totalChunks: number;
  lastIndexerRun: number | null;
  lastBackup: number | null;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

export function KernlTab() {
  const [stats, setStats] = useState<KernlStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch('/api/kernl/stats');
        if (res.ok) {
          const body = await res.json() as { data: KernlStats };
          setStats(body.data);
        }
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--frost)', padding: 12 }}>Loading memory stats…</div>;
  }

  if (!stats) {
    return <div style={{ fontSize: 12, color: 'var(--error)', padding: 12 }}>Couldn't load memory stats. Check Settings.</div>;
  }

  const rows = [
    { label: 'Database Size', value: `${stats.dbSizeMB} MB` },
    { label: 'Total Tables', value: String(stats.totalTables) },
    { label: 'Total Threads', value: stats.totalThreads.toLocaleString() },
    { label: 'Total Messages', value: stats.totalMessages.toLocaleString() },
    { label: 'Total Decisions', value: stats.totalDecisions.toLocaleString() },
    { label: 'Chunks Indexed', value: stats.totalChunks.toLocaleString() },
    { label: 'Last Indexer Run', value: stats.lastIndexerRun ? relativeTime(stats.lastIndexerRun) : 'Never' },
    { label: 'Last Backup', value: stats.lastBackup ? relativeTime(stats.lastBackup) : 'Never' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        Memory Database
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface)', borderRadius: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--frost)' }}>{r.label}</span>
            <span style={{ fontSize: 12, color: 'var(--ice-white)', fontWeight: 600 }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}