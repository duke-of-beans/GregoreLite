// ContextPanel type definitions
// Consumed by: context-provider.ts, API route, all context components

export interface KERNLProject {
  id: string;
  name: string;
  path: string | null;
}

export interface KERNLDecision {
  id: string;
  title: string;
  created_at: number;
}

export interface ContextPanelState {
  activeProject: KERNLProject | null;
  /** Total thread count in KERNL — used as session number */
  sessionNumber: number;
  /** Milliseconds elapsed since most recent thread's created_at */
  sessionDurationMs: number;
  /** Last 3–5 decisions from KERNL decisions table */
  recentDecisions: KERNLDecision[];
  /** KERNL index status — 'indexing' while background pass runs, else 'indexed' */
  kernlStatus: 'indexed' | 'indexing' | 'error';
  /** Last profile from aegis_signals table; 'IDLE' if no rows exist */
  aegisProfile: string;
  /** True if AEGIS HTTP server responded to health check on last bootstrap (wired in Sprint 2C) */
  aegisOnline?: boolean;
  /** Always 0 until Phase 3 Cross-Context engine activates */
  pendingSuggestions: number;
}

export const DEFAULT_CONTEXT_STATE: ContextPanelState = {
  activeProject: null,
  sessionNumber: 0,
  sessionDurationMs: 0,
  recentDecisions: [],
  kernlStatus: 'indexed',
  aegisProfile: 'IDLE',
  aegisOnline: false,
  pendingSuggestions: 0,
};
