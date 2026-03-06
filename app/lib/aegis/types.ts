/**
 * AEGIS type definitions — Sprint 16.0
 *
 * WorkloadProfile: core enum driving CPU/memory governor decisions.
 * IPC response types: match Rust structs in src-tauri/src/aegis/types.rs.
 * AEGIS_PROFILE_MAP: translates WorkloadProfile → AEGIS native profile name.
 */

// ── WorkloadProfile (GregLite internal) ───────────────────────────────────────

export type WorkloadProfile =
  | 'IDLE'
  | 'DEEP_FOCUS'
  | 'CODE_GEN'
  | 'COWORK_BATCH'
  | 'RESEARCH'
  | 'BUILD'
  | 'PARALLEL_BUILD'
  | 'COUNCIL'
  | 'STARTUP'
  | 'SUSPEND';

export interface AEGISState {
  profile: WorkloadProfile;
  online: boolean;
  lastUpdated: number;
}

/**
 * Maps every WorkloadProfile to the native AEGIS profile name.
 * Used when calling aegis_switch_profile via IPC.
 */
export const AEGIS_PROFILE_MAP: Record<WorkloadProfile, string> = {
  STARTUP:        'idle',
  IDLE:           'idle',
  SUSPEND:        'idle',
  DEEP_FOCUS:     'deep-research',
  CODE_GEN:       'performance',
  COWORK_BATCH:   'build-mode',
  RESEARCH:       'deep-research',
  BUILD:          'performance',
  PARALLEL_BUILD: 'wartime',
  COUNCIL:        'deep-research',
};

// ── IPC response types (match Rust structs) ───────────────────────────────────

export interface SystemMetrics {
  timestamp: string;
  cpu_percent: number;
  memory_percent: number;
  memory_mb_used: number;
  memory_mb_available: number;
  power_plan: string;
}

export interface TimerState {
  active: boolean;
  target_profile: string | null;
  return_profile: string | null;
  started_at: string | null;
  duration_min: number | null;
  expires_at: string | null;
}

export interface ProfileSummary {
  name: string;
  display_name: string;
  color: string;
  description: string;
  is_active: boolean;
}

export interface AegisStatus {
  active_profile: string;
  active_profile_display: string;
  active_profile_color: string;
  profiles: ProfileSummary[];
  timer: TimerState;
  metrics: SystemMetrics;
  version: string;
}
