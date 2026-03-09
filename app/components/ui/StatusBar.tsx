'use client';
import { apiFetch } from '@/lib/api-client';
/**
 * StatusBar — Sprint 30.0
 *
 * Thin 32px bottom chrome strip showing live system data:
 * cost today, active jobs, system profile, memory status.
 * Each item is clickable for drill-down navigation.
 * Collapse toggle: chevron on right collapses to 2px strip; strip click expands.
 * Collapsed state persisted via ui-store.
 */


import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useJobStore } from '@/lib/stores/job-store';
import { useContextPanel } from '@/lib/context/context-provider';
import { useGhostStore } from '@/lib/stores/ghost-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { NAV, IMPORT } from '@/lib/voice/copy-templates';
import { CostBreakdown } from '../agent-sdk/CostBreakdown';
import type { GhostStatus } from '@/lib/ghost/status';

const COST_POLL_MS = 60_000;
const MEM_POLL_MS  = 5 * 60_000; // 5 minutes

interface MemSyncStatus {
  daysSinceSync: number | null;
  shouldShowReminder: boolean;
  reminderUrl: string;
}

// ── Ghost status helpers (Sprint 20.0) ────────────────────────────────────────

function ghostLabel(status: GhostStatus | null): string {
  if (!status || status.state === 'stopped' || status.state === 'error') return 'Off';
  if (status.state === 'running') return 'Active';
  if (status.state === 'degraded') return 'Partial';
  if (status.state === 'paused') return 'Paused';
  if (status.state === 'starting') return 'Starting';
  return 'Off';
}

function ghostColor(status: GhostStatus | null): string {
  if (!status || status.state === 'stopped' || status.state === 'error') return 'text-[var(--mist)]';
  if (status.state === 'running') return 'text-green-400';
  return 'text-amber-400'; // starting, degraded, paused
}

function ghostTooltip(status: GhostStatus | null): string {
  if (!status || status.state === 'stopped') return 'Background Assistant not running';
  if (status.state === 'running') return 'Monitoring filesystem and email for relevant context';
  if (status.state === 'degraded') {
    const failed = status.errors.map((e) => e.component).join(', ');
    return `Partial: ${failed || 'some components'} failed — email + scoring still active`;
  }
  if (status.state === 'paused') return 'Paused due to high system load';
  if (status.state === 'starting') return 'Background Assistant starting up…';
  return 'Background Assistant not running';
}

export function StatusBar() {
  const [costToday, setCostToday] = useState<number>(0);
  const [costBreakdownOpen, setCostBreakdownOpen] = useState(false);
  const [memSync, setMemSync] = useState<MemSyncStatus | null>(null);
  const jobs = useJobStore((s) => s.jobs);
  const { state: ctx } = useContextPanel();
  const ghostStatus = useGhostStore((s) => s.ghostStatus);
  const statusBarCollapsed = useUIStore((s) => s.statusBarCollapsed);
  const toggleStatusBar = useUIStore((s) => s.toggleStatusBar);

  // Poll /api/import/sync-status every 5 min (MEM chip)
  const fetchMemSync = useCallback(async () => {
    try {
      const res = await apiFetch('/api/import/sync-status');
      if (res.ok) setMemSync(await res.json() as MemSyncStatus);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    void fetchMemSync();
    const handle = setInterval(fetchMemSync, MEM_POLL_MS);
    return () => clearInterval(handle);
  }, [fetchMemSync]);

  // Poll /api/costs/today every 60s
  const fetchCost = useCallback(async () => {
    try {
      const res = await apiFetch('/api/costs/today');
      if (res.ok) {
        const body = await res.json();
        setCostToday(body.data?.totalUsd ?? 0);
      }
    } catch {
      // Non-critical — stale cost is acceptable
    }
  }, []);

  useEffect(() => {
    fetchCost();
    const handle = setInterval(fetchCost, COST_POLL_MS);
    return () => clearInterval(handle);
  }, [fetchCost]);

  // Derive job counts (JobRecord.state is uppercase JobState)
  const activeJobs = jobs.filter(
    (j) => j.state === 'RUNNING' || j.state === 'WORKING' || j.state === 'VALIDATING'
  ).length;
  const pendingJobs = jobs.filter(
    (j) => j.state === 'SPAWNING'
  ).length;

  // Memory indicator (KERNL)
  const kernlColor =
    ctx.kernlStatus === 'indexed'
      ? 'text-green-400'
      : ctx.kernlStatus === 'indexing'
        ? 'text-amber-400'
        : 'text-red-400';
  const kernlDot =
    ctx.kernlStatus === 'indexed' ? '●' : ctx.kernlStatus === 'indexing' ? '◐' : '✕';

  // Click handlers — navigate to relevant panels
  const handleCostClick = () => {
    setCostBreakdownOpen(true);
  };

  const handleJobsClick = () => {
    window.dispatchEvent(new CustomEvent('greglite:switch-tab', { detail: { tab: 'workers' } }));
  };

  const handleAegisClick = () => {
    // Opens context panel which shows System Monitor override dialog (Sprint 10.9 Task 11)
    window.dispatchEvent(new CustomEvent('greglite:open-context-panel'));
  };

  const handleKernlClick = () => {
    // Opens context panel which shows Memory status (Sprint 10.9 Task 11)
    window.dispatchEvent(new CustomEvent('greglite:open-context-panel'));
  };

  const handleGhostClick = () => {
    // Navigate to Settings > Ghost section (Sprint 20.0)
    window.dispatchEvent(new CustomEvent('greglite:open-settings', { detail: { section: 'ghost' } }));
  };

  const handleMemClick = () => {
    // Open Settings > Memory section (Sprint 34.0)
    window.dispatchEvent(new CustomEvent('greglite:open-settings', { detail: { section: 'memory' } }));
  };

  // Collapsed: 20px bar — left label (non-interactive) + right ChevronUp matching expanded ChevronDown position
  if (statusBarCollapsed) {
    return (
      <div
        onClick={toggleStatusBar}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleStatusBar(); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: 20,
          flexShrink: 0,
          cursor: 'pointer',
          borderTop: '1px solid var(--shadow)',
          background: 'var(--deep-space)',
          paddingLeft: 16,
          paddingRight: 16,
          boxSizing: 'border-box',
        }}
        aria-label={NAV.statusbar_expand}
        title={NAV.statusbar_expand}
      >
        {/* Left: faint non-interactive label */}
        <span
          style={{
            fontSize: 10,
            color: 'var(--mist)',
            letterSpacing: '0.06em',
            userSelect: 'none',
            pointerEvents: 'none',
            opacity: 0.5,
          }}
        >
          SYSTEM STATUS
        </span>

        {/* Right: ChevronUp — same size/position as expanded ChevronDown */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ChevronUp
            style={{ width: 12, height: 12, color: 'var(--mist)' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div data-tour="status-bar" className="flex h-8 w-full shrink-0 items-center justify-between border-t border-[var(--shadow)] bg-[var(--deep-space)] px-4 text-[11px]">
      <div className="flex items-center gap-4">
        {/* Cost */}
        <button
          onClick={handleCostClick}
          className="flex items-center gap-1.5 text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
          title="Daily cost — click for breakdown"
        >
          <span className="text-[var(--mist)]">COST TODAY:</span>
          <span className="font-mono font-medium">${costToday.toFixed(4)}</span>
        </button>

        {/* Separator */}
        <span className="text-[var(--shadow)]">│</span>

        {/* Jobs */}
        <button
          onClick={handleJobsClick}
          className="flex items-center gap-1.5 text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
          title="Job status — click to view Workers"
        >
          <span className="text-[var(--mist)]">JOBS:</span>
          <span className="font-mono font-medium">
            {activeJobs} active{pendingJobs > 0 ? `, ${pendingJobs} pending` : ''}
          </span>
        </button>

        {/* Separator */}
        <span className="text-[var(--shadow)]">│</span>

        {/* System Monitor */}
        <button
          onClick={handleAegisClick}
          className="status-metric-secondary flex items-center gap-1.5 text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
          title="System resource profile — CPU and memory load. Click to view details."
        >
          <span className="text-[var(--mist)]">SYSTEM:</span>
          <span className="font-mono font-medium uppercase">{ctx.aegisProfile}</span>
        </button>

        {/* Separator */}
        <span className="text-[var(--shadow)]">│</span>

        {/* Memory (KERNL) */}
        <button
          onClick={handleKernlClick}
          className="status-metric-secondary flex items-center gap-1.5 text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
          title="Memory index status — Greg's persistent knowledge from past conversations"
        >
          <span className="text-[var(--mist)]">MEMORY:</span>
          <span className={`font-mono font-medium ${kernlColor}`}>
            {kernlDot} {ctx.kernlStatus === 'indexed' ? 'Ready' : ctx.kernlStatus === 'indexing' ? 'Syncing' : 'Offline'}
          </span>
        </button>

        {/* Separator */}
        <span className="text-[var(--shadow)]">│</span>

        {/* Background Assistant (Sprint 23.0: renamed from Ghost Thread) */}
        <button
          onClick={handleGhostClick}
          className="status-metric-secondary flex items-center gap-1.5 text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
          title={ghostTooltip(ghostStatus)}
        >
          <span className="text-[var(--mist)]">BACKGROUND:</span>
          <span className={`font-mono font-medium ${ghostColor(ghostStatus)}`}>
            {ghostLabel(ghostStatus)}
          </span>
        </button>

        {/* MEM chip — hidden until first import (Sprint 34.0) */}
        {memSync !== null && memSync.daysSinceSync !== null && (
          <>
            <span className="text-[var(--shadow)]">│</span>
            <button
              onClick={handleMemClick}
              className="status-metric-secondary flex items-center gap-1.5 text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
              title={
                memSync.shouldShowReminder
                  ? IMPORT.mem_chip_tooltip_overdue(memSync.daysSinceSync)
                  : IMPORT.mem_chip_tooltip_current(memSync.daysSinceSync)
              }
            >
              <span
                className={`font-mono font-medium ${
                  memSync.shouldShowReminder ? 'text-amber-400' : 'text-green-400'
                }`}
              >
                {memSync.shouldShowReminder
                  ? IMPORT.mem_chip_overdue(memSync.daysSinceSync)
                  : IMPORT.mem_chip_recent(memSync.daysSinceSync)}
              </span>
            </button>
          </>
        )}

      </div>

      {/* Right side — Quality score + collapse toggle */}
      <div className="flex items-center gap-2">
        {ctx.eosSummary && (
          <div className="status-metric-secondary flex items-center gap-1.5 text-[var(--frost)]" title="Code quality score — powered by Eye of Sauron">
            <span className="text-[var(--mist)]">QUALITY:</span>
            <span
              className={`font-mono font-medium ${
                ctx.eosSummary.healthScore >= 80
                  ? 'text-green-400'
                  : ctx.eosSummary.healthScore >= 60
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {ctx.eosSummary.healthScore}/100
            </span>
          </div>
        )}
        <button
          onClick={toggleStatusBar}
          className="text-[var(--mist)] transition-colors hover:text-[var(--ice-white)]"
          aria-label={NAV.statusbar_collapse}
          title={NAV.statusbar_collapse}
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Cost Breakdown Modal (S9-10) */}
      {costBreakdownOpen && (
        <CostBreakdown onClose={() => setCostBreakdownOpen(false)} />
      )}
    </div>
  );
}