/**
 * Decision Gate — Types
 *
 * All interfaces for the Decision Gate system (§8 blueprint).
 * Eight trigger conditions, lock state, and trigger result shape.
 */

/**
 * The 8 gate trigger conditions — any one fires the gate (OR logic).
 *
 * Live in Sprint 4A (keyword/semantic):
 *   repeated_question, sacred_principle_risk, irreversible_action,
 *   contradicts_prior, low_confidence
 *
 * Haiku inference (Sprint 4B — single inferStructuredTriggers() call):
 *   high_tradeoff_count, multi_project_touch, large_build_estimate
 *   The always-false stub functions were removed in Sprint 11.0.
 */
export type GateTrigger =
  | 'repeated_question'       // same architectural question in 3+ messages
  | 'high_tradeoff_count'     // decision involves ≥4 major tradeoffs — Haiku inference
  | 'multi_project_touch'     // decision touches ≥2 projects — Haiku inference
  | 'sacred_principle_risk'   // forbidden phrases detected
  | 'irreversible_action'     // delete, deploy to prod, breaking schema change
  | 'large_build_estimate'    // build time >3 Agent SDK sessions — Haiku inference
  | 'contradicts_prior'       // contradicts a KERNL-logged decision
  | 'low_confidence';         // Claude expresses confidence <60%

/** Result returned by analyze() — consumed by chat route + UI (Sprint 4B) */
export interface TriggerResult {
  triggered: boolean;
  trigger: GateTrigger | null;
  /** Human-readable explanation shown in gate panel (Sprint 4B) */
  reason: string;
}

/** Module-level lock state — enforced at API layer in Sprint 4B */
export interface DecisionLockState {
  locked: boolean;
  trigger: GateTrigger | null;
  reason: string;
  /** Count of dismissals; 3 dismissals → isMandatory() returns true */
  dismissCount: number;
  lockedAt: number | null;
}

/**
 * Minimal message shape used inside the decision gate.
 * Decoupled from full KERNL Message — only needs role + content.
 */
export interface GateMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
