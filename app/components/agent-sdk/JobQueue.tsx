/**
 * JobQueue — Sprint 7F
 *
 * Right-panel control surface for all Phase 7 worker sessions.
 * Polls GET /api/agent-sdk/jobs every 2 seconds (no websockets — intentional).
 *
 * Sections:
 *   ACTIVE      — spawning / running / working / validating / blocked
 *   PENDING     — in scheduler queue, waiting for a slot
 *   INTERRUPTED — failed + interrupted, showing restart options
 *   RECENT      — completed, last 8
 *
 * Budget settings accessible via the DailyBurnBadge header click.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { JobCard } from './JobCard';
import { PendingSessionCard } from './PendingSessionCard';
import { InterruptedSessionCard } from './InterruptedSessionCard';
import { BudgetSettingsPanel } from './BudgetSettingsPanel';
import type { AgentJobView } from './types';
import { ACTIVE_STATUSES } from './types';

const POLL_MS = 2000;
const RECENT_LIMIT = 8;
const DEFAULT_SOFT_CAP = 2.0;
const DEFAULT_DAILY_CAP = 15.0;

export function JobQueue() {
  const [jobs, setJobs] = useState<AgentJobView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [dailyCap, setDailyCap] = useState(DEFAULT_DAILY_CAP);
  const [showBudget, setShowBudget] = useState(false);
  // Dismissed interrupted sessions (UI-only dismissal)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-sdk/jobs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { data: AgentJobView[] };
      setJobs(json.data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Poll failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDailyTotal = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-sdk/budget');
      if (!res.ok) return;
      const json = await res.json() as {
        data?: { daily_total_usd?: number; daily_hard_cap_usd?: number };
      };
      if (json.data?.daily_total_usd != null)  setDailyTotal(json.data.daily_total_usd);
      if (json.data?.daily_hard_cap_usd != null) setDailyCap(json.data.daily_hard_cap_usd);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchDailyTotal();
    intervalRef.current = setInterval(() => {
      fetchJobs();
      fetchDailyTotal();
    }, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchJobs, fetchDailyTotal]);

  // Sort helpers
  const activeJobs  = jobs.filter((j) => ACTIVE_STATUSES.has(j.status));
  const pendingJobs = jobs.filter((j) => j.status === 'pending')
    .sort((a, b) => (a.queuePosition ?? 99) - (b.queuePosition ?? 99));
  const interruptedJobs = jobs
    .filter((j) => (j.status === 'interrupted' || j.status === 'failed') && !dismissed.has(j.manifestId))
    .slice(0, 5);
  const completedJobs = jobs
    .filter((j) => j.status === 'completed')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RECENT_LIMIT);

  const totalActive = activeJobs.length + pendingJobs.length;
  const dailyPct = dailyCap > 0 ? Math.round((dailyTotal / dailyCap) * 100) : 0;

  return (
    <div
      style={{
        width: '25%',
        minWidth: '240px',
        maxWidth: '340px',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* ── Panel header ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 14px 8px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--frost)', letterSpacing: '0.08em' }}>
          WORKERS
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading && (
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'pulse 1s ease-in-out infinite',
              display: 'inline-block',
            }} />
          )}
          <span style={{ fontSize: '10px', color: 'var(--mist)' }}>
            {activeJobs.length}/8
          </span>
          {/* Daily burn badge — click to open budget settings */}
          <button
            onClick={() => setShowBudget((v) => !v)}
            title={`Daily spend: $${dailyTotal.toFixed(2)} / $${dailyCap.toFixed(2)} — click to configure`}
            style={{
              background: dailyPct >= 90 ? 'color-mix(in srgb, #ef4444 20%, var(--surface))'
                        : dailyPct >= 70 ? 'color-mix(in srgb, #f59e0b 20%, var(--surface))'
                        : 'var(--surface)',
              border: `1px solid ${dailyPct >= 90 ? '#ef4444' : dailyPct >= 70 ? '#f59e0b' : 'var(--border)'}`,
              borderRadius: '4px',
              color: dailyPct >= 90 ? '#ef4444' : dailyPct >= 70 ? '#f59e0b' : 'var(--mist)',
              cursor: 'pointer',
              fontSize: '9px',
              padding: '2px 6px',
              fontWeight: dailyPct >= 70 ? 600 : 400,
            }}
          >
            ${dailyTotal.toFixed(2)} / ${dailyCap.toFixed(2)}
          </button>
        </div>
      </div>

      {/* ── Budget settings flyout ────────────────────────────────────── */}
      {showBudget && (
        <div
          style={{
            position: 'absolute',
            top: '44px',
            right: '8px',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <BudgetSettingsPanel onClose={() => setShowBudget(false)} />
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '5px 14px',
          fontSize: '10px',
          color: '#ef4444',
          background: 'color-mix(in srgb, #ef4444 8%, transparent)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* ── Scrollable session list ───────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>

        {totalActive === 0 && interruptedJobs.length === 0 && completedJobs.length === 0 && (
          <div style={{ fontSize: '11px', color: 'var(--mist)', textAlign: 'center', marginTop: '32px', fontStyle: 'italic' }}>
            No worker sessions
          </div>
        )}

        {/* Active sessions */}
        {activeJobs.length > 0 && (
          <Section label="ACTIVE">
            {activeJobs.map((job) => (
              <JobCard
                key={job.manifestId}
                job={job}
                softCapUsd={DEFAULT_SOFT_CAP}
                onKilled={fetchJobs}
              />
            ))}
          </Section>
        )}

        {/* Pending queue */}
        {pendingJobs.length > 0 && (
          <Section label={`QUEUED (${pendingJobs.length})`}>
            {pendingJobs.map((job) => (
              <PendingSessionCard
                key={job.manifestId}
                job={job}
                totalPending={pendingJobs.length}
                onCancelled={fetchJobs}
              />
            ))}
          </Section>
        )}

        {/* Interrupted / failed */}
        {interruptedJobs.length > 0 && (
          <Section label="INTERRUPTED">
            {interruptedJobs.map((job) => (
              <InterruptedSessionCard
                key={job.manifestId}
                job={job}
                onDismiss={(id) => setDismissed((prev) => new Set([...prev, id]))}
                onRestarted={fetchJobs}
              />
            ))}
          </Section>
        )}

        {/* Recent completed */}
        {completedJobs.length > 0 && (
          <Section label="RECENT">
            {completedJobs.map((job) => (
              <JobCard
                key={job.manifestId}
                job={job}
                softCapUsd={DEFAULT_SOFT_CAP}
                onKilled={fetchJobs}
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

// ── Small section header ──────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{
        fontSize: '9px',
        color: 'var(--mist)',
        letterSpacing: '0.1em',
        marginBottom: '6px',
        paddingLeft: '2px',
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}
