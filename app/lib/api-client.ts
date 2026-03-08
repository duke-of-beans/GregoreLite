/**
 * API URL helper — Sprint 36.0
 *
 * In the installed Tauri build, Next.js API routes don't exist (static export).
 * All /api/* calls must go to the Node.js sidecar on localhost:3717.
 *
 * In dev mode (pnpm dev), Next.js handles /api/* natively so relative paths work.
 *
 * Usage:
 *   import { apiFetch, apiUrl } from '@/lib/api-client';
 *
 *   // Drop-in replacement for fetch('/api/threads'):
 *   const res = await apiFetch('/api/threads');
 *
 *   // Or get the URL for use with EventSource / manual fetch:
 *   const url = apiUrl('/api/chat');
 *
 * Rules:
 * - Only import this in CLIENT components and hooks.
 * - Server-side lib/ modules use direct function calls — they never fetch /api/*.
 */

/** Port the sidecar listens on. Must match sidecar/src/server.ts */
const SIDECAR_BASE = 'http://localhost:3717';

/**
 * Detect whether we are running inside an installed Tauri app.
 * `__TAURI_INTERNALS__` is injected by Tauri into the WebView window object.
 */
function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window
  );
}

/**
 * Returns the full URL for an API path.
 * - Tauri installed: `http://localhost:3717/api/...`
 * - Dev / SSR:       `/api/...`  (relative, Next.js handles it)
 */
export function apiUrl(path: string): string {
  if (isTauri()) {
    return SIDECAR_BASE + path;
  }
  return path;
}

/**
 * fetch() wrapper that prepends the sidecar base URL in Tauri builds.
 * Signature is identical to fetch() so it's a zero-friction drop-in.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
