/**
 * Ghost Thread — Public API
 * Sprint 6F
 *
 * Entry point for all Ghost Thread functionality.
 * Re-exports the lifecycle management functions and status type.
 *
 * Lifecycle:
 *   startGhost()     — sequential 7-step startup (call on app open)
 *   stopGhost()      — reverse shutdown with 5s timeout (call on app close)
 *   pauseGhost()     — pause all components on AEGIS profile change
 *   resumeGhost()    — resume all components when AEGIS returns to normal
 *   isGhostRunning() — whether the Ghost is currently active
 *   isGhostPaused()  — whether the Ghost is currently paused
 *
 * Status:
 *   getGhostStatus() — current GhostStatus snapshot
 *
 * IPC:
 *   getGhostEmitter()        — Node.js EventEmitter for server-side listeners
 *   emitGhostSuggestion()    — surface a new suggestion via IPC
 *   emitIngestProgress()     — emit queue depth update
 *   GHOST_EVENTS             — canonical event name constants
 */

export {
  startGhost,
  stopGhost,
  pauseGhost,
  resumeGhost,
  restartComponent,
  isGhostRunning,
  isGhostPaused,
} from './lifecycle';

export { getGhostStatus } from './status';
export type { GhostStatus } from './status';

export {
  getGhostEmitter,
  emitGhostSuggestion,
  emitIngestProgress,
  emitGhostError,
  GHOST_EVENTS,
} from './ipc';
export type { GhostEventName, GhostIngestProgressPayload, GhostErrorPayload } from './ipc';
