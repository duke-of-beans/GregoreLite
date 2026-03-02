/**
 * Ghost IPC — Event types and emitters
 * Sprint 6F
 *
 * All Ghost events flow through this module. On the server (Node.js) side,
 * events are dispatched via a Node.js EventEmitter. On the Tauri side,
 * emit_all() broadcasts to all WebView windows so the frontend Zustand
 * store can react.
 *
 * Event catalogue:
 *   ghost:status-changed   — GhostStatus snapshot after every state transition
 *   ghost:suggestion-ready — a new scored suggestion is ready for the UI
 *   ghost:ingest-progress  — queue depth + processed count (debounced by caller)
 *   ghost:error            — a component error that does not stop the Ghost
 */

import { EventEmitter } from 'events';
import type { GhostStatus } from './status';
import type { GhostSuggestion } from './scorer/types';

// ── Canonical event names ─────────────────────────────────────────────────────

export const GHOST_EVENTS = {
  STATUS_CHANGED:   'ghost:status-changed',
  SUGGESTION_READY: 'ghost:suggestion-ready',
  INGEST_PROGRESS:  'ghost:ingest-progress',
  ERROR:            'ghost:error',
} as const;

export type GhostEventName = (typeof GHOST_EVENTS)[keyof typeof GHOST_EVENTS];

// ── Payload types ─────────────────────────────────────────────────────────────

export interface GhostIngestProgressPayload {
  queued: number;
  processed: number;
}

export interface GhostErrorPayload {
  component: string;
  message: string;
}

// ── Server-side EventEmitter (Node.js process) ────────────────────────────────

/** Module-level emitter. Singleton within the Next.js server process. */
const _emitter = new EventEmitter();
_emitter.setMaxListeners(20); // Ghost has several internal listeners

export function getGhostEmitter(): EventEmitter {
  return _emitter;
}

// ── Emit helpers ──────────────────────────────────────────────────────────────

/**
 * Emit a Ghost event on the server-side EventEmitter AND attempt a Tauri
 * emit_all() so the WebView frontend receives it. Tauri emit is best-effort —
 * it is silently skipped in non-Tauri environments (tests, plain Next.js dev).
 */
async function emit(event: GhostEventName, payload: unknown): Promise<void> {
  // 1. Node.js server-side listeners
  _emitter.emit(event, payload);

  // 2. Tauri WebView broadcast (best-effort)
  try {
    // Dynamic import keeps the Tauri import out of non-Tauri environments
    const tauri = await import('@tauri-apps/api/event').catch(() => null);
    if (tauri) {
      await tauri.emit(event, payload);
    }
  } catch {
    // Tauri not available — no-op
  }
}

export function emitGhostStatus(status: GhostStatus): void {
  void emit(GHOST_EVENTS.STATUS_CHANGED, status);
}

export function emitGhostSuggestion(suggestion: GhostSuggestion): void {
  void emit(GHOST_EVENTS.SUGGESTION_READY, suggestion);
}

export function emitIngestProgress(payload: GhostIngestProgressPayload): void {
  void emit(GHOST_EVENTS.INGEST_PROGRESS, payload);
}

export function emitGhostError(component: string, message: string): void {
  void emit(GHOST_EVENTS.ERROR, { component, message } satisfies GhostErrorPayload);
}
