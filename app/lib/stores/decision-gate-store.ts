/**
 * Decision Gate Store — Zustand
 *
 * Holds the current gate trigger result so the UI can render the
 * decision gate panel (Sprint 4B).
 *
 * The store is set fire-and-forget from the chat route after every
 * assistant response. Sprint 4B adds the gate panel component that
 * reads from this store.
 */

import { create } from 'zustand';
import type { TriggerResult } from '@/lib/decision-gate';

interface DecisionGateStoreState {
  /** The most recent trigger result — null if no gate is active. */
  trigger: TriggerResult | null;
  /** Set by chat route when analyze() fires. */
  setTrigger: (result: TriggerResult) => void;
  /** Called by Sprint 4B UI when David approves or dismisses. */
  clearTrigger: () => void;
}

export const useDecisionGateStore = create<DecisionGateStoreState>((set) => ({
  trigger: null,

  setTrigger: (result: TriggerResult) => set({ trigger: result }),

  clearTrigger: () => set({ trigger: null }),
}));
