/**
 * Bootstrap module — orchestrates full startup sequence.
 *
 * Sequence (from BLUEPRINT_FINAL.md §2.1):
 * 1. Load KERNL context (active projects, recent decisions, last session)
 * 2. Load dev protocols from disk
 * 3. Build context injection package
 * 4. Send AEGIS STARTUP signal (stub)
 * 5. Cache result (refresh every 30 minutes)
 *
 * Context package is module-level cached — chat route reads it synchronously.
 */

import { loadDevProtocols } from './dev-protocols';
import { buildContextPackage, DEFAULT_SYSTEM_PROMPT } from './context-builder';
import { initAEGIS } from '../aegis';
import { warmAll } from '../vector/cold-start';
import type { BootstrapResult, ContextPackage } from './types';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

let _cachedPackage: ContextPackage | null = null;
let _cacheExpiresAt = 0;
let _bootstrapRunning = false;

/**
 * Run the full bootstrap sequence.
 * Idempotent — if called concurrently, second call returns cached result.
 */
export async function runBootstrap(): Promise<BootstrapResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Return cache if still valid
  if (_cachedPackage && Date.now() < _cacheExpiresAt) {
    return { success: true, package: _cachedPackage, errors: [] };
  }

  // Prevent concurrent bootstrap runs
  if (_bootstrapRunning) {
    // Return stale cache if available, or default
    if (_cachedPackage) {
      return { success: true, package: _cachedPackage, errors: [] };
    }
    return {
      success: false,
      package: buildDefaultPackage(startTime),
      errors: ['Bootstrap already running'],
    };
  }

  _bootstrapRunning = true;

  try {
    console.log('[bootstrap] Starting bootstrap sequence...');

    // Step 1+2: Load dev protocols (KERNL context loaded inside buildContextPackage)
    const devProtocols = loadDevProtocols();
    errors.push(...devProtocols.loadErrors);

    // Step 3: Build full context package (queries KERNL internally)
    const pkg = buildContextPackage(devProtocols, startTime);

    // Step 4: AEGIS — health check, STARTUP signal, governor start
    const aegisOnline = await initAEGIS();
    if (!aegisOnline) {
      errors.push('AEGIS offline — workload signaling inactive until AEGIS starts');
    }

    // Non-blocking cache warming — all three tiers load in the background
    warmAll().catch((err: unknown) => console.warn('[cold-start] warm failed', { err }));

    // Cache the result
    _cachedPackage = pkg;
    _cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    console.log(`[bootstrap] Complete in ${pkg.coldStartMs}ms`);
    if (pkg.coldStartMs > 60000) {
      console.warn(`[bootstrap] Cold start exceeded 60s target: ${pkg.coldStartMs}ms`);
    }

    return { success: true, package: pkg, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Bootstrap failed: ${msg}`);
    console.error('[bootstrap] Fatal error:', err);

    const fallback = buildDefaultPackage(startTime);
    return { success: false, package: fallback, errors };
  } finally {
    _bootstrapRunning = false;
  }
}

/**
 * Get the current cached context package system prompt.
 * Returns default system prompt if bootstrap hasn't run yet.
 * Used by chat route for synchronous access.
 */
export function getBootstrapSystemPrompt(): string {
  return _cachedPackage?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
}

/**
 * Get the full cached context package (may be null before first bootstrap).
 */
export function getBootstrapContext(): ContextPackage | null {
  return _cachedPackage;
}

/**
 * Force a cache refresh on the next call to runBootstrap.
 */
export function invalidateBootstrapCache(): void {
  _cacheExpiresAt = 0;
}

function buildDefaultPackage(startTime: number): ContextPackage {
  return {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    kernlContext: {
      activeProjects: [],
      recentDecisions: [],
      lastSessionSummary: null,
      activeSession: null,
    },
    devProtocols: {
      technicalStandards: null,
      claudeInstructions: null,
      loadErrors: [],
    },
    bootstrapTimestamp: Date.now(),
    coldStartMs: Date.now() - startTime,
  };
}

export type { BootstrapResult, ContextPackage } from './types';
