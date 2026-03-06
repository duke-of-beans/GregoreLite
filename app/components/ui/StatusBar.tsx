/**
 * StatusBar — Sprint S9-04
 *
 * Thin 32px bottom chrome strip showing live system data:
 * cost today, active jobs, system profile, memory status.
 * Each item is clickable for drill-down navigation.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useJobStore } from '@/lib/stores/job-store';
import { useContextPanel } from '@/lib/context/context-provider';
import { CostBreakdown } from '../agent-sdk/CostBreakdown';
import { getAttentionTooltip } from '@/lib/focus/attention-budget';

const COST_POLL_MS = 60_000;

export function StatusBar() {
  const [costToday, setCostToday] = useState<number>(0);
  const [costBreakdownOpen, setCostBreakdownOpen] = useState(false);
  // Sprint 19.0 — Law 10: attention budget display, polled every 10s
  const [attentionText, setAttentionText] = useState(() => getAttentionTooltip());
  const jobs = useJobStore((s) => s.jobs);
  const { state: ctx } = useContextPanel();

  // Poll /api/costs/today every 60s
  const fetchCost = useCallback(async () => {
    try {
      const res = await fetch('/api/costs/today');
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

  useEffect(() => {
    const handle = setInterval(() => setAttentionText(getAttentionTooltip()), 10_000);
    return () => clearInterval(handle);
  }, []);

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

  return (
    <div className="flex h-8 w-full shrink-0 items-center justify-between border-t border-[var(--shadow)] bg-[var(--deep-space)] px-4 text-[11px]">
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

        {/* System Monitor (AEGIS) */}
        <button
          onClick={handleAegisClick}
          className="flex items-center gap-1.5 text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
          title="System resource profile — powered by AEGIS"
        >
          <span className="text-[var(--mist)]">SYSTEM:</span>
          <span className="font-mono font-medium uppercase">{ctx.aegisProfile}</span>
        </button>

        {/* Separator */}
        <span className="text-[var(--shadow)]">│</span>

        {/* Memory (KERNL) */}
        <button
          onClick={handleKernlClick}
          className="flex items-center gap-1.5 text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
          title="Memory index status — powered by KERNL"
        >
          <span className="text-[var(--mist)]">MEMORY:</span>
          <span className={`font-mono font-medium ${kernlColor}`}>
            {kernlDot} {ctx.kernlStatus === 'indexed' ? 'Ready' : ctx.kernlStatus === 'indexing' ? 'Syncing' : 'Offline'}
          </span>
        </button>

        {/* Separator */}
        <span className="text-[var(--shadow)]">│</span>

        {/* Attention Budget — Law 10 */}
        <div
          className="flex items-center gap-1.5 text-[var(--frost)]"
          title={attentionText}
        >
          <span className="text-[var(--mist)]">ATTN:</span>
          <span className="font-mono font-medium">
            {attentionText.replace('Attention: ', '').replace(' remaining', '')}
          </span>
        </div>
      </div>

      {/* Right side — Code Quality score if available */}
      {ctx.eosSummary && (
        <div className="flex items-center gap-1.5 text-[var(--frost)]" title="Code quality score — powered by Eye of Sauron">
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

      {/* Cost Breakdown Modal (S9-10) */}
      {costBreakdownOpen && (
        <CostBreakdown onClose={() => setCostBreakdownOpen(false)} />
      )}
    </div>
  );
}