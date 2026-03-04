/**
 * cost-tracker.ts — Phase 7D (rewrite of Phase 2A, with full backward compat)
 *
 * ── New (Phase 7D) ─────────────────────────────────────────────────────────
 * DB-backed helpers used directly by query.ts:
 *   createSessionCost()    — INSERT row into session_costs on spawn
 *   updateSessionCost()    — UPDATE session_costs on every checkpoint
 *   finalizeSessionCost()  — SET completed_at on session end
 *   getSessionCostRow()    — read the current row
 *   getSessionCapStatus()  — 'ok' | 'warn' | 'soft_cap' from budget_config
 *
 * ── Legacy (Phase 2A, kept for executor.ts + agent-sdk.test.ts) ────────────
 * CostTracker class with in-memory session tracking:
 *   startSession(model)             → sessionId
 *   recordUsage(sessionId, usage)   → SessionCostState
 *   getSessionState(sessionId)      → SessionCostState | null
 *   getCostCapStatus(sessionId)     → CostCapStatus
 *   endSession(sessionId)           → SessionCostState | null (+ daily total)
 *   resetDailyTotal()               → void
 *   getDailyTotalUsd()              → number (in-memory)
 *   isDailyCapReached()             → boolean (checks DB + in-memory)
 *
 * BLUEPRINT §4.3.5
 */

import { nanoid } from 'nanoid';
import { getDatabase } from '../kernl/database';
import { calculateCost } from './cost-calculator';
import { AGENT_COST_CONFIG } from './config';
import { isDailyCapReached as dbIsDailyCapReached } from './budget-enforcer';
import type { TokenUsage } from './types';

// ─── Shared cap status type ───────────────────────────────────────────────────

export type CostCapStatus = 'ok' | 'warn' | 'soft_cap';

// ─── DB row type ──────────────────────────────────────────────────────────────

export interface SessionCostRow {
  manifest_id: string;
  session_type: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  project_id: string | null;
  started_at: number | null;
  completed_at: number | null;
  updated_at: number;
}

// ─── Phase 7D: DB-backed helpers (used by query.ts) ──────────────────────────

/**
 * Create the initial session_costs row when a session spawns.
 */
export function createSessionCost(
  manifestId: string,
  model: string,
  sessionType: string,
  projectId: string | null,
): void {
  const db = getDatabase();
  const now = Date.now();
  db.prepare(`
    INSERT OR IGNORE INTO session_costs
      (manifest_id, session_type, model, input_tokens, output_tokens,
       total_tokens, estimated_cost_usd, project_id, started_at, updated_at)
    VALUES (?, ?, ?, 0, 0, 0, 0.0, ?, ?, ?)
  `).run(manifestId, sessionType, model, projectId, now, now);
}

/**
 * Incrementally update session_costs. Accepts cumulative totals (not deltas).
 */
export function updateSessionCost(
  manifestId: string,
  inputTokens: number,
  outputTokens: number,
  model: string,
): void {
  const db = getDatabase();
  const cost = calculateCost(inputTokens, outputTokens, model);
  db.prepare(`
    UPDATE session_costs
    SET input_tokens = ?, output_tokens = ?, total_tokens = ?,
        estimated_cost_usd = ?, updated_at = ?
    WHERE manifest_id = ?
  `).run(inputTokens, outputTokens, inputTokens + outputTokens, cost, Date.now(), manifestId);
}

/**
 * Set completed_at when the session ends (any terminal state).
 */
export function finalizeSessionCost(manifestId: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE session_costs SET completed_at = ?, updated_at = ? WHERE manifest_id = ?
  `).run(Date.now(), Date.now(), manifestId);
}

/**
 * Read the current session_costs row.
 */
export function getSessionCostRow(manifestId: string): SessionCostRow | null {
  const db = getDatabase();
  return (db.prepare('SELECT * FROM session_costs WHERE manifest_id = ?').get(manifestId) as SessionCostRow) ?? null;
}

/**
 * Evaluate soft-cap status for a running session against budget_config.
 * Falls back to $2.00 soft cap if the DB row is absent.
 */
export function getSessionCapStatus(costUsd: number): CostCapStatus {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM budget_config WHERE key = ?').get('session_soft_cap_usd') as { value: string } | undefined;
    const softCap = row ? parseFloat(row.value) : 2.00;
    if (costUsd >= softCap) return 'soft_cap';
    if (costUsd >= softCap * 0.8) return 'warn';
    return 'ok';
  } catch {
    return 'ok';
  }
}

// ─── Phase 2A: Legacy in-memory CostTracker (backward compat) ────────────────
//
// executor.ts and agent-sdk.test.ts depend on this class.
// The in-memory session map is retained; isDailyCapReached() also checks the
// DB-backed budget-enforcer so Phase 7D sessions are accounted for.

export interface SessionCostState {
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  capStatus: CostCapStatus;
  /** Sprint 12.0: tokens that populated the prompt cache (billed at 125% normal) */
  cacheCreationInputTokens: number;
  /** Sprint 12.0: tokens read from the prompt cache (billed at 10% normal) */
  cacheReadInputTokens: number;
}

export class CostTracker {
  private sessions = new Map<string, SessionCostState>();
  private inMemoryDailyTotalUsd = 0;

  /** Register a new in-memory tracking session. Returns auto-generated sessionId. */
  startSession(model: string): string {
    const sessionId = nanoid();
    this.sessions.set(sessionId, {
      sessionId,
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalCostUsd: 0,
      capStatus: 'ok',
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    });
    return sessionId;
  }

  /** Accumulate token usage. Returns updated cost state. */
  recordUsage(sessionId: string, usage: TokenUsage): SessionCostState {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`CostTracker: unknown sessionId ${sessionId}`);
    }
    session.inputTokens += usage.inputTokens;
    session.outputTokens += usage.outputTokens;
    // Sprint 12.0: accumulate cache token counts
    session.cacheCreationInputTokens += usage.cacheCreationInputTokens ?? 0;
    session.cacheReadInputTokens += usage.cacheReadInputTokens ?? 0;
    session.totalCostUsd = calculateCost(session.inputTokens, session.outputTokens, session.model);
    session.capStatus = this._evaluateCap(session.totalCostUsd);
    return { ...session };
  }

  /** Read current cost state without ending the session. */
  getSessionState(sessionId: string): SessionCostState | null {
    const s = this.sessions.get(sessionId);
    return s ? { ...s } : null;
  }

  /** Convenience accessor for the cap status of an active session. */
  getCostCapStatus(sessionId: string): CostCapStatus {
    return this.sessions.get(sessionId)?.capStatus ?? 'ok';
  }

  /** Close a session and accumulate its cost into the in-memory daily total. */
  endSession(sessionId: string): SessionCostState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    this.inMemoryDailyTotalUsd += session.totalCostUsd;
    this.sessions.delete(sessionId);
    return { ...session };
  }

  /** In-memory daily total (Phase 2A sessions). Use budget-enforcer for Phase 7D sessions. */
  getDailyTotalUsd(): number {
    return this.inMemoryDailyTotalUsd;
  }

  /** Reset in-memory daily total (Phase 2A compatibility). */
  resetDailyTotal(): void {
    this.inMemoryDailyTotalUsd = 0;
  }

  /**
   * Returns true if the daily hard cap is reached.
   * Checks the DB-backed budget-enforcer (Phase 7D sessions) first;
   * falls back to in-memory total (Phase 2A sessions).
   */
  isDailyCapReached(): boolean {
    if (dbIsDailyCapReached()) return true;
    return this.inMemoryDailyTotalUsd >= AGENT_COST_CONFIG.dailyHardCapUsd;
  }

  private _evaluateCap(totalCostUsd: number): CostCapStatus {
    if (totalCostUsd >= AGENT_COST_CONFIG.perSessionSoftCapUsd) return 'soft_cap';
    if (totalCostUsd >= AGENT_COST_CONFIG.perSessionWarnAtUsd) return 'warn';
    return 'ok';
  }
}

/** Singleton — imported by index.ts and executor.ts */
export const costTracker = new CostTracker();

// ─── Sprint 12.0: Cache savings helper ───────────────────────────────────────

/**
 * Calculate USD saved by reading from the prompt cache.
 * Cache reads are billed at 10% of normal input token cost, so the saving
 * per cache-read token is 90% of what would have been charged without caching.
 *
 * @param cacheReadInputTokens  Number of tokens served from the cache.
 * @param model                 Model string (used to look up per-token pricing).
 * @returns                     USD amount saved (always >= 0).
 */
export function calculateCacheSavingsUsd(cacheReadInputTokens: number, model: string): number {
  if (cacheReadInputTokens === 0) return 0;
  // Full cost at normal rate minus what was actually charged (10%)
  const normalCost = calculateCost(cacheReadInputTokens, 0, model);
  const cacheCost = normalCost * 0.10;
  return Math.max(0, normalCost - cacheCost);
}
