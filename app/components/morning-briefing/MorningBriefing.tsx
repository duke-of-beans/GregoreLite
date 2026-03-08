import { apiFetch } from '@/lib/api-client';
/**
 * MorningBriefing — Sprint 30.0
 *
 * Full-width overlay shown on cold start before first message.
 * Slides down from header. X icon dismisses; "Don't show again today" marks shown.
 * Can be re-opened from command palette.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { BriefingData } from '@/lib/morning-briefing/types';
import { NAV } from '@/lib/voice/copy-templates';
import { BriefingSection } from './BriefingSection';

interface MorningBriefingProps {
  onDismiss: () => void;
}

export function MorningBriefing({ onDismiss }: MorningBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/morning-briefing')
      .then((res) => res.json())
      .then((body) => {
        setBriefing(body.data?.briefing ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDismiss = useCallback(() => {
    // Mark as shown for today
    void apiFetch('/api/morning-briefing', { method: 'POST' });
    onDismiss();
  }, [onDismiss]);

  if (loading) {
    return (
      <div className="border-b border-[var(--shadow)] bg-[var(--elevated)] px-6 py-8 text-center">
        <span className="text-sm text-[var(--mist)]">Preparing your briefing...</span>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="border-b border-[var(--shadow)] bg-[var(--elevated)] px-6 py-8 text-center">
        <span className="text-sm text-[var(--mist)]">No briefing data available.</span>
        <button
          onClick={handleDismiss}
          className="ml-4 text-sm text-[var(--cyan)] hover:text-[var(--ice-white)]"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const eosDelta =
    briefing.eosCurrent !== null && briefing.eosPrevious !== null
      ? briefing.eosCurrent - briefing.eosPrevious
      : null;

  return (
    <div className="border-b border-[var(--cyan)]/20 bg-[var(--elevated)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">☀️</span>
          <div>
            <h2 className="text-lg font-semibold text-[var(--ice-white)]">Morning Briefing</h2>
            <span className="text-xs text-[var(--mist)]">{briefing.forDate}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={onDismiss}
            className="text-[var(--mist)] transition-colors hover:text-[var(--ice-white)]"
            aria-label={NAV.briefing_dismiss}
            title={NAV.briefing_dismiss}
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={handleDismiss}
            className="text-xs text-[var(--mist)] transition-colors hover:text-[var(--cyan)]"
          >
            {NAV.briefing_skip_today}
          </button>
        </div>
      </div>

      {/* Grid of sections */}
      <div className="grid grid-cols-3 gap-3 px-6 pb-5">
        {/* Jobs */}
        <BriefingSection icon="🔧" title="Yesterday's Jobs">
          {briefing.completedJobs.length === 0 && briefing.failedJobs.length === 0 ? (
            <span className="text-[var(--mist)]">Nothing to report</span>
          ) : (
            <>
              {briefing.completedJobs.map((j, i) => (
                <div key={i} className="flex justify-between">
                  <span className="truncate text-green-400">✓ {j.title}</span>
                  <span className="shrink-0 font-mono text-xs text-[var(--mist)]">
                    ${j.costUsd.toFixed(2)}
                  </span>
                </div>
              ))}
              {briefing.failedJobs.map((j, i) => (
                <div key={i}>
                  <span className="text-red-400">✕ {j.title}</span>
                  {j.failureMode && (
                    <span className="ml-2 text-xs text-[var(--mist)]">— {j.failureMode}</span>
                  )}
                </div>
              ))}
            </>
          )}
        </BriefingSection>

        {/* Decisions */}
        <BriefingSection icon="⚖" title={`Decisions (${briefing.decisionsCount})`}>
          {briefing.recentDecisionTitles.length === 0 ? (
            <span className="text-[var(--mist)]">Nothing to report</span>
          ) : (
            briefing.recentDecisionTitles.map((t, i) => (
              <div key={i} className="truncate">
                • {t}
              </div>
            ))
          )}
        </BriefingSection>

        {/* Ghost */}
        <BriefingSection icon="👻" title="Ghost Surfaces">
          <span>
            {briefing.ghostItemsIndexed > 0
              ? `${briefing.ghostItemsIndexed} new items indexed`
              : 'Nothing to report'}
          </span>
        </BriefingSection>

        {/* Budget */}
        <BriefingSection icon="💰" title="Budget">
          <div className="flex justify-between">
            <span>Yesterday:</span>
            <span className="font-mono">${briefing.yesterdaySpendUsd.toFixed(2)} / ${briefing.dailyCapUsd.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>This week:</span>
            <span className="font-mono">${briefing.weekTotalUsd.toFixed(2)}</span>
          </div>
        </BriefingSection>

        {/* EoS */}
        <BriefingSection icon="📊" title="EoS Health">
          {briefing.eosCurrent !== null ? (
            <span className="font-mono">
              Score: {briefing.eosCurrent}
              {eosDelta !== null && eosDelta !== 0 && (
                <span className={eosDelta > 0 ? 'text-green-400' : 'text-red-400'}>
                  {' '}→ {briefing.eosCurrent} ({eosDelta > 0 ? '+' : ''}{eosDelta})
                </span>
              )}
              {eosDelta === 0 && <span className="text-[var(--mist)]"> (unchanged)</span>}
            </span>
          ) : (
            <span className="text-[var(--mist)]">No scan data</span>
          )}
        </BriefingSection>

        {/* PRs */}
        <BriefingSection icon="🔀" title="PRs Pending">
          <span>
            {briefing.prsPending > 0
              ? `${briefing.prsPending} PR${briefing.prsPending !== 1 ? 's' : ''} awaiting merge`
              : 'Nothing to report'}
          </span>
        </BriefingSection>
      </div>
    </div>
  );
}