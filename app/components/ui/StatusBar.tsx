/**
 * StatusBar — Sprint S9-04
 *
 * Thin 32px bottom chrome strip showing live system data:
 * cost today, active jobs, AEGIS profile, KERNL status.
 * Each item is clickable for drill-down navigation.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useJobStore } from '@/lib/stores/job-store';
import { useContextPanel } from '@/lib/context/context-provider';
import { CostBreakdown } from '../agent-sdk/CostBreakdown';

const COST_POLL_MS = 60_000;

export function StatusBar() {
  const [costToday, setCostToday] = useState<number>(0);
  const [costBreakdownOpen, setCostBreakdownOpen] = useState(false);
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

  // Derive job counts (JobRecord.state is uppercase JobState)
  const activeJobs = jobs.filter(
    (j) => j.state === 'RUNNING' || j.state === 'WORKING' || j.state === 'VALIDATING'
  ).length;
  const pendingJobs = jobs.filter(
    (j) => j.state === 'SPAWNING'
  ).length;

  // KERNL indicator
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
    document.querySelector<HTMLButtonElement>('[data-tab="workers"]')?.click();
  };

  const handleAegisClick = () => {
    // Will open Inspector (S9-14). For now, log.
    console.log('[StatusBar] AEGIS profile:', ctx.aegisProfile);
  };

  const handleKernlClick = () => {
    // Will open KERNL Health Panel (S9-18). For now, log.
    console.log('[StatusBar] KERNL status:', ctx.kernlStatus);
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

        {/* AEGIS */}
        <button
          onClick={handleAegisClick}
          className="flex items-center gap-1.5 text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
          title="AEGIS cognitive profile"
        >
          <span className="text-[var(--mist)]">AEGIS:</span>
          <span className="font-mono font-medium uppercase">{ctx.aegisProfile}</span>
        </button>

        {/* Separator */}
        <span className="text-[var(--shadow)]">│</span>

        {/* KERNL */}
        <button
          onClick={handleKernlClick}
          className="flex items-center gap-1.5 text-[var(--frost)] transition-colors hover:text-[var(--ice-white)]"
          title="KERNL index status"
        >
          <span className="text-[var(--mist)]">KERNL:</span>
          <span className={`font-mono font-medium ${kernlColor}`}>
            {kernlDot} {ctx.kernlStatus}
          </span>
        </button>
      </div>

      {/* Right side — EoS score if available */}
      {ctx.eosSummary && (
        <div className="flex items-center gap-1.5 text-[var(--frost)]">
          <span className="text-[var(--mist)]">EoS:</span>
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