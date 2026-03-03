'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GhostStatus } from '@/lib/ghost/status';
import { ExclusionLog } from './ExclusionLog';
import { ExclusionRules } from './ExclusionRules';
import { GhostStatusBadge } from './GhostStatusBadge';
import { IndexedItemsList } from './IndexedItemsList';
import { PreferencesPanel } from './PreferencesPanel';
import { PurgeAllDialog } from './PurgeAllDialog';
import { WatchPaths } from './WatchPaths';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'indexed' | 'exclusions' | 'preferences' | 'watch-paths' | 'activity-log';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'indexed',      label: 'Indexed items'     },
  { id: 'exclusions',   label: 'Exclusion rules'   },
  { id: 'preferences',  label: 'Preferences'       },
  { id: 'watch-paths',  label: 'Watch paths'       },
  { id: 'activity-log', label: 'Activity log'      },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface PrivacyDashboardProps {
  /** Allow parent to control open/close if embedded in a sheet/panel */
  onClose?: () => void;
}

export function PrivacyDashboard({ onClose }: PrivacyDashboardProps) {
  const [activeTab,        setActiveTab]        = useState<TabId>('indexed');
  const [purgeDialogOpen,  setPurgeDialogOpen]  = useState(false);
  const [purgeSuccessMsg,  setPurgeSuccessMsg]  = useState<string | null>(null);
  const [ghostStatus,      setGhostStatus]      = useState<GhostStatus | null>(null);

  // Key to force-remount child lists after purge
  const [refreshKey, setRefreshKey] = useState(0);

  // Poll Ghost status every 5s
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/ghost/status');
        if (!cancelled && res.ok) {
          const data = await res.json();
          setGhostStatus(data);
        }
      } catch { /* best effort */ }
    }
    void poll();
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handlePurgeSuccess = useCallback(() => {
    setPurgeSuccessMsg('All Ghost data has been purged. Ghost is restarting…');
    setRefreshKey(k => k + 1);
    setTimeout(() => setPurgeSuccessMsg(null), 6000);
  }, []);

  // Auto-dismiss success banner
  useEffect(() => {
    if (!purgeSuccessMsg) return;
    const t = setTimeout(() => setPurgeSuccessMsg(null), 6000);
    return () => clearTimeout(t);
  }, [purgeSuccessMsg]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          {/* Eye icon */}
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800">
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ghost Privacy</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Control what Ghost indexes and learns from</p>
          </div>
        </div>

        {/* Right side: status badge + close */}
        <div className="flex items-center gap-3">
          <GhostStatusBadge status={ghostStatus} />
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Success banner ──────────────────────────────────────────────────── */}
      {purgeSuccessMsg && (
        <div className="mx-5 mt-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-green-700 dark:text-green-400">{purgeSuccessMsg}</span>
          <button onClick={() => setPurgeSuccessMsg(null)} className="ml-4 text-green-500 hover:text-green-700">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-800 px-5 pt-3">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`mr-1 px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4">

        {activeTab === 'indexed' && (
          <IndexedItemsList key={refreshKey} />
        )}

        {activeTab === 'exclusions' && (
          <ExclusionRules />
        )}

        {activeTab === 'preferences' && (
          <PreferencesPanel key={refreshKey} />
        )}

        {activeTab === 'watch-paths' && (
          <WatchPaths />
        )}

        {activeTab === 'activity-log' && (
          <ExclusionLog key={refreshKey} />
        )}
      </div>

      {/* ── Footer: Purge all ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          All data stays on your device and is never sent to external servers.
        </p>
        <button
          onClick={() => setPurgeDialogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Purge all Ghost data
        </button>
      </div>

      {/* ── Purge dialog ───────────────────────────────────────────────────── */}
      <PurgeAllDialog
        open={purgeDialogOpen}
        onClose={() => setPurgeDialogOpen(false)}
        onSuccess={handlePurgeSuccess}
      />
    </div>
  );
}
