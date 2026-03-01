/**
 * AEGIS type definitions — Sprint 2C.
 *
 * WorkloadProfile is the core enum driving CPU/memory governor decisions.
 * STARTUP and SUSPEND are lifecycle-only signals.
 *
 * AEGIS_PROFILE_MAP translates internal WorkloadProfile values to the
 * native profile names understood by the AEGIS HTTP governor API.
 */

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
 * Maps every WorkloadProfile to the native AEGIS HTTP governor profile name.
 * Used when POSTing /setprofile to the AEGIS process.
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
