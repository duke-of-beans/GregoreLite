/**
 * Decision Gate Store — Zustand
 *
 * Holds the current gate trigger result and dismiss counter so the UI
 * can render the correct gate panel state (normal / mandatory).
 *
 * setTrigger() — called from chat route fire-and-forget after analyze() fires.
 *                Accepts optional dismissCount so the panel knows how many
 *                dismissals remain without a server round-trip.
 * setDismissCount() — called by GatePanel after POST /api/decision-gate/dismiss
 *                     returns the updated count from the server.
 * clearTrigger() — called by GatePanel after approve / override completes.
 *
 * No persistence — gate state is session-only. A locked gate from a previous
 * session should not block a fresh session.
 */

import { create } from 'zustand';
import type { TriggerResult } from '@/lib/decision-gate';

interface DecisionGateStoreState {
  /** The most recent trigger result — null if no gate is active. */
  trigger: TriggerResult | null;

  /**
   * Mirrors lock.ts dismissCount. Set when the trigger fires (so the panel
   * immediately knows how many dismissals remain) and updated after each
   * dismiss API call.
   */
  dismissCount: number;

  /** Set by chat route when analyze() fires. */
  setTrigger: (result: TriggerResult, dismissCount?: number) => void;

  /** Update dismiss count after POST /api/decision-gate/dismiss. */
  setDismissCount: (count: number) => void;

  /** Called by GatePanel after David approves or overrides. */
  clearTrigger: () => void;
}

export const useDecisionGateStore = create<DecisionGateStoreState>((set) => ({
  trigger: null,
  dismissCount: 0,

  setTrigger: (result: TriggerResult, dismissCount = 0) =>
    set({ trigger: result, dismissCount }),

  setDismissCount: (count: number) => set({ dismissCount: count }),

  clearTrigger: () => set({ trigger: null, dismissCount: 0 }),
}));
