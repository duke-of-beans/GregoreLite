/**
 * Cost Tracker
 *
 * Accumulates token usage during a session and computes USD cost
 * via the existing pricing.ts service. Enforces per-session caps.
 *
 * BLUEPRINT §4.3.5
 *
 * API:
 *   startSession(model)    → sessionId (auto-generated)
 *   recordUsage(id, usage) → SessionCostState
 *   getSessionState(id)    → SessionCostState | null
 *   getCostCapStatus(id)   → CostCapStatus
 *   endSession(id)         → SessionCostState | null
 *   isDailyCapReached()    → boolean
 *   getDailyTotalUsd()     → number
 *   resetDailyTotal()      → void
 */

import { nanoid } from 'nanoid';
import { calculateCost } from '../services/pricing';
import { AGENT_COST_CONFIG } from './config';
import type { TokenUsage } from './types';

export type CostCapStatus = 'ok' | 'warn' | 'soft_cap' | 'hard_cap';

export interface SessionCostState {
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  capStatus: CostCapStatus;
}

// ─── Session cost accumulator ─────────────────────────────────────────────────

export class CostTracker {
  private sessions = new Map<string, SessionCostState>();
  private dailyTotalUsd = 0;

  /**
   * Register a new tracking session for the given model.
   * Returns the auto-generated sessionId — callers must store it for
   * subsequent recordUsage / endSession calls.
   */
  startSession(model: string): string {
    const sessionId = nanoid();
    this.sessions.set(sessionId, {
      sessionId,
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalCostUsd: 0,
      capStatus: 'ok',
    });
    return sessionId;
  }

  /**
   * Record token usage for a session. Returns updated cost state.
   * Call this on every streaming usage event.
   */
  recordUsage(sessionId: string, usage: TokenUsage): SessionCostState {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`CostTracker: unknown sessionId ${sessionId}`);
    }

    session.inputTokens += usage.inputTokens;
    session.outputTokens += usage.outputTokens;
    session.totalCostUsd = calculateCost(session.model, session.inputTokens, session.outputTokens);
    session.capStatus = this.evaluateCap(session.totalCostUsd);

    return { ...session };
  }

  /**
   * Get the current cost state for a session without ending it.
   */
  getSessionState(sessionId: string): SessionCostState | null {
    const s = this.sessions.get(sessionId);
    return s ? { ...s } : null;
  }

  /**
   * Convenience accessor for the cap status of an active session.
   */
  getCostCapStatus(sessionId: string): CostCapStatus {
    return this.sessions.get(sessionId)?.capStatus ?? 'ok';
  }

  /**
   * Returns true if the global daily hard cap has been reached.
   * Checked before spawning any new session.
   */
  isDailyCapReached(): boolean {
    return this.dailyTotalUsd >= AGENT_COST_CONFIG.dailyHardCapUsd;
  }

  /**
   * Close a session and accumulate its cost into the daily total.
   */
  endSession(sessionId: string): SessionCostState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    this.dailyTotalUsd += session.totalCostUsd;
    this.sessions.delete(sessionId);
    return session;
  }

  getDailyTotalUsd(): number {
    return this.dailyTotalUsd;
  }

  /** Reset daily total (call once per calendar day). */
  resetDailyTotal(): void {
    this.dailyTotalUsd = 0;
  }

  private evaluateCap(totalCostUsd: number): CostCapStatus {
    if (totalCostUsd >= AGENT_COST_CONFIG.perSessionSoftCapUsd) return 'soft_cap';
    if (totalCostUsd >= AGENT_COST_CONFIG.perSessionWarnAtUsd) return 'warn';
    return 'ok';
  }
}

// Singleton shared across the app
export const costTracker = new CostTracker();
