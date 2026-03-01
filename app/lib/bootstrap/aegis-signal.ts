/**
 * AEGIS Signal — stub for Phase 1.
 * Real implementation in Phase 2C when AEGIS integrates.
 * For now: log only, never throw.
 */

export type AegisSignalType = 'STARTUP' | 'SHUTDOWN' | 'BOOTSTRAP_COMPLETE' | 'CONTEXT_REFRESH';

export interface AegisSignal {
  type: AegisSignalType;
  timestamp: number;
  payload?: Record<string, unknown>;
}

export function sendAegisSignal(signal: AegisSignal): void {
  // Phase 1 stub — structured log only
  console.log(`[AEGIS:${signal.type}]`, {
    timestamp: new Date(signal.timestamp).toISOString(),
    ...(signal.payload ?? {}),
  });
}

export function sendStartupSignal(coldStartMs?: number): void {
  sendAegisSignal({
    type: 'STARTUP',
    timestamp: Date.now(),
    payload: { coldStartMs, phase: 1, stub: true },
  });
}
