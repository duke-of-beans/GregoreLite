/**
 * Agent SDK Cost Configuration
 *
 * Per-session and daily cost caps for worker sessions.
 * BLUEPRINT §4.3.5
 */

export interface AgentCostConfig {
  /** Warn user when session cost exceeds this (USD) */
  perSessionWarnAtUsd: number;
  /** Soft cap: pause session and notify when exceeded (USD) */
  perSessionSoftCapUsd: number;
  /** Hard cap: block new sessions when daily total exceeds this (USD) */
  dailyHardCapUsd: number;
  /** Max concurrent worker sessions before queuing */
  maxConcurrentSessions: number;
  /** Default model for worker sessions */
  defaultModel: string;
}

export const AGENT_COST_CONFIG: AgentCostConfig = {
  perSessionWarnAtUsd: 1.60,
  perSessionSoftCapUsd: 2.00,
  dailyHardCapUsd: 15.00,
  maxConcurrentSessions: 8,
  defaultModel: 'claude-sonnet-4-5-20250929',
};
