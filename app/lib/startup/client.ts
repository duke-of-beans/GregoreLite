/**
 * startup/client.ts — Sprint 31.0
 *
 * TypeScript IPC bridge for OS startup registration.
 * Wraps three Tauri commands exposed by src-tauri/src/startup.rs.
 *
 * Dev-mode safety: when running in a browser (no Tauri runtime),
 * all functions degrade gracefully:
 *   isStartupRegistered  → returns false
 *   registerStartup      → no-op
 *   unregisterStartup    → no-op
 * This keeps the Settings UI functional in Next.js dev mode.
 */

/** Returns true if the app is running inside a Tauri window. */
function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in window
  );
}

/**
 * Lazy-load the Tauri invoke function to avoid a hard import error
 * in non-Tauri environments (browser dev mode, tests).
 */
async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  // Dynamic import so Next.js doesn't try to bundle @tauri-apps/api
  // in contexts where it's unavailable.
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check whether GregLite is registered to launch on OS startup.
 * Reads the actual OS state (registry on Windows, plist on macOS).
 * Never throws — returns false on any error or in dev mode.
 */
export async function isStartupRegistered(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await tauriInvoke<boolean>('startup_is_registered');
  } catch {
    return false;
  }
}

/**
 * Register GregLite to launch on OS startup.
 * Windows: writes HKCU\...\Run registry value.
 * macOS:   creates ~/Library/LaunchAgents plist.
 * Throws a descriptive string on failure (e.g. permissions error).
 * No-op in dev mode (no Tauri runtime).
 */
export async function registerStartup(): Promise<void> {
  if (!isTauri()) return;
  await tauriInvoke<void>('startup_register');
}

/**
 * Remove the OS startup entry for GregLite.
 * Throws a descriptive string on failure.
 * No-op in dev mode (no Tauri runtime).
 */
export async function unregisterStartup(): Promise<void> {
  if (!isTauri()) return;
  await tauriInvoke<void>('startup_unregister');
}
