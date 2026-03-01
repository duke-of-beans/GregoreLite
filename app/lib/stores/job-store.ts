/**
 * Job Store
 *
 * Client-side Zustand store that mirrors agent-sdk in-memory state
 * via polling /api/jobs every 2 seconds. Components read from here.
 *
 * Polling (not SSE) is correct for Phase 2 — simple, crash-safe,
 * zero server-side plumbing. SSE upgrade deferred to Phase 3 if needed.
 */

'use client';

import { create } from 'zustand';
import type { JobRecord } from '@/lib/agent-sdk/types';

const POLL_INTERVAL_MS = 2000;

interface JobStoreState {
  jobs: JobRecord[];
  loading: boolean;
  error: string | null;
  pollingHandle: ReturnType<typeof setInterval> | null;

  // Actions
  startPolling: () => void;
  stopPolling: () => void;
  fetchJobs: () => Promise<void>;
  spawnJob: (manifest: unknown) => Promise<{ jobId: string; queued: boolean; queuePosition?: number }>;
  killJob: (jobId: string) => Promise<void>;
}

export const useJobStore = create<JobStoreState>((set, get) => ({
  jobs: [],
  loading: false,
  error: null,
  pollingHandle: null,

  startPolling() {
    if (get().pollingHandle) return;
    get().fetchJobs();
    const handle = setInterval(() => get().fetchJobs(), POLL_INTERVAL_MS);
    set({ pollingHandle: handle });
  },

  stopPolling() {
    const { pollingHandle } = get();
    if (pollingHandle) {
      clearInterval(pollingHandle);
      set({ pollingHandle: null });
    }
  },

  async fetchJobs() {
    try {
      const res = await fetch('/api/jobs');
      if (!res.ok) throw new Error(`/api/jobs returned ${res.status}`);
      const body = await res.json();
      set({ jobs: body.data ?? [], error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch jobs' });
    }
  },

  async spawnJob(manifest) {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifest),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Spawn failed');
      await get().fetchJobs();
      return body.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Spawn failed';
      set({ error: message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  async killJob(jobId) {
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Kill failed');
      }
      await get().fetchJobs();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kill failed';
      set({ error: message });
      throw err;
    }
  },
}));
