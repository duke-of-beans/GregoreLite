/**
 * JobQueue
 *
 * Right panel, 25% width. Shows all active + queued jobs via polling.
 * Starts polling on mount, stops on unmount.
 *
 * BLUEPRINT §4.3 (Job Queue UI layout)
 */

'use client';

import { useEffect } from 'react';
import { useJobStore } from '@/lib/stores/job-store';
import { JobCard } from './JobCard';
import { QuickSpawnTemplates } from './QuickSpawnTemplates';

export function JobQueue() {
  const { jobs, loading, error, startPolling, stopPolling } = useJobStore();

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const activeJobs = jobs.filter(
    (j) => !['COMPLETED', 'FAILED', 'INTERRUPTED'].includes(j.state)
  );
  const doneJobs = jobs
    .filter((j) => ['COMPLETED', 'FAILED', 'INTERRUPTED'].includes(j.state))
    .slice(0, 5); // show last 5 completed

  return (
    <div
      style={{
        width: '25%',
        minWidth: '220px',
        maxWidth: '320px',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
        flexShrink: 0,
      }}
    >
      {/* ── Panel header ───────────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 14px 8px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--frost)', letterSpacing: '0.08em' }}>
          WORKERS
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {loading && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'pulse 1s ease-in-out infinite',
                display: 'inline-block',
              }}
            />
          )}
          <span style={{ fontSize: '10px', color: 'var(--mist)' }}>
            {activeJobs.length}/{8} active
          </span>
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            padding: '6px 14px',
            fontSize: '10px',
            color: 'var(--error)',
            background: 'color-mix(in srgb, var(--error) 8%, transparent)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Quick spawn from templates (Sprint 9-07) ─────────────────── */}
      <QuickSpawnTemplates />

      {/* ── Scrollable job list ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {activeJobs.length === 0 && doneJobs.length === 0 && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--mist)',
              textAlign: 'center',
              marginTop: '32px',
              fontStyle: 'italic',
            }}
          >
            No worker sessions
          </div>
        )}

        {/* Active + queued */}
        {activeJobs.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            {activeJobs.map((job) => (
              <JobCard key={job.jobId} job={job} />
            ))}
          </div>
        )}

        {/* Completed / failed */}
        {doneJobs.length > 0 && (
          <div>
            <div
              style={{
                fontSize: '9px',
                color: 'var(--mist)',
                letterSpacing: '0.1em',
                marginBottom: '6px',
                paddingLeft: '2px',
              }}
            >
              RECENT
            </div>
            {doneJobs.map((job) => (
              <JobCard key={job.jobId} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
