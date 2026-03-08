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
 * Detect whether we are running inside an installed Tauri app
 * AND the sidecar is expected to be running (i.e. production build).
 *
 * In `pnpm tauri dev`, Tauri injects __TAURI_INTERNALS__ into the WebView
 * BUT the WebView is pointed at http://localhost:3000 (Next.js dev server)
 * and the sidecar binary is NOT built/running. API calls must use relative
 * paths so Next.js handles them natively.
 *
 * In the installed Tauri build, the frontend is served from tauri://localhost
 * or a custom protocol — never http://localhost:3000 — so the sidecar check is safe.
 */
function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('__TAURI_INTERNALS__' in window)) return false;
  // In pnpm tauri dev, the WebView loads from http://localhost:3000.
  // Treat that as dev mode: use relative paths, not the sidecar.
  if (window.location.href.startsWith('http://localhost:')) return false;
  return true;
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
