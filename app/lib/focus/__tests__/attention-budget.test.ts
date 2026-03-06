/**
 * attention-budget.test.ts — Sprint 19.0 Task 10
 *
 * Tests Law 10 (Attention Budget) implementation.
 * Pure module-level state — no DB mocking required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  spendAttention,
  getAttentionRemaining,
  getAttentionHistory,
  resetDailyBudget,
  getAttentionTooltip,
  isBudgetExhausted,
  DAILY_BUDGET,
  ATTENTION_COSTS,
} from '../attention-budget';

beforeEach(() => {
  resetDailyBudget();
  vi.restoreAllMocks();
});

describe('initial state', () => {
  it('starts with full daily budget', () => {
    expect(getAttentionRemaining()).toBe(DAILY_BUDGET);
  });

  it('budget is not exhausted at start', () => {
    expect(isBudgetExhausted()).toBe(false);
  });

  it('history is empty at start', () => {
    expect(getAttentionHistory()).toHaveLength(0);
  });
});

describe('spendAttention', () => {
  it('returns true and deducts ghost_suggestion cost', () => {
    const result = spendAttention('ghost_suggestion');
    expect(result).toBe(true);
    expect(getAttentionRemaining()).toBe(DAILY_BUDGET - ATTENTION_COSTS.ghost_suggestion);
  });

  it('returns true and deducts gate_mandatory cost', () => {
    spendAttention('gate_mandatory');
    expect(getAttentionRemaining()).toBe(DAILY_BUDGET - ATTENTION_COSTS.gate_mandatory);
  });

  it('records spend in history', () => {
    spendAttention('status_notification');
    const history = getAttentionHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.type).toBe('status_notification');
    expect(history[0]?.cost).toBe(ATTENTION_COSTS.status_notification);
  });

  it('returns false when budget is exhausted', () => {
    // Drain budget: critical_alert (cost 25) × 4 = 100
    spendAttention('critical_alert');
    spendAttention('critical_alert');
    spendAttention('critical_alert');
    spendAttention('critical_alert');
    expect(getAttentionRemaining()).toBe(0);
    const result = spendAttention('gate_warning');
    expect(result).toBe(false);
  });

  it('does not deduct cost when budget is exhausted', () => {
    spendAttention('critical_alert');
    spendAttention('critical_alert');
    spendAttention('critical_alert');
    spendAttention('critical_alert');
    const remaining = getAttentionRemaining();
    spendAttention('status_notification');
    expect(getAttentionRemaining()).toBe(remaining);
  });

  it('critical_alert always passes regardless of exhaustion', () => {
    for (let i = 0; i < 4; i++) spendAttention('critical_alert');
    expect(isBudgetExhausted()).toBe(true);
    const result = spendAttention('critical_alert');
    expect(result).toBe(true);
  });
});

describe('isBudgetExhausted', () => {
  it('returns false when budget remains', () => {
    spendAttention('ghost_suggestion');
    expect(isBudgetExhausted()).toBe(false);
  });

  it('returns true when remaining reaches 0', () => {
    spendAttention('critical_alert');
    spendAttention('critical_alert');
    spendAttention('critical_alert');
    spendAttention('critical_alert');
    expect(isBudgetExhausted()).toBe(true);
  });
});

describe('resetDailyBudget', () => {
  it('restores full budget after spending', () => {
    spendAttention('gate_mandatory');
    spendAttention('gate_mandatory');
    resetDailyBudget();
    expect(getAttentionRemaining()).toBe(DAILY_BUDGET);
  });

  it('clears spend history', () => {
    spendAttention('gate_warning');
    resetDailyBudget();
    expect(getAttentionHistory()).toHaveLength(0);
  });
});

describe('getAttentionTooltip', () => {
  it('returns correct format at full budget', () => {
    const tip = getAttentionTooltip();
    expect(tip).toBe(`Attention: ${DAILY_BUDGET}/${DAILY_BUDGET} CT remaining`);
  });

  it('reflects spent attention', () => {
    spendAttention('gate_mandatory'); // cost 10
    const tip = getAttentionTooltip();
    const expected = DAILY_BUDGET - ATTENTION_COSTS.gate_mandatory;
    expect(tip).toBe(`Attention: ${expected}/${DAILY_BUDGET} CT remaining`);
  });
});

describe('ATTENTION_COSTS', () => {
  it('ghost_suggestion costs less than status_notification', () => {
    expect(ATTENTION_COSTS.ghost_suggestion).toBeLessThan(ATTENTION_COSTS.status_notification);
  });

  it('critical_alert is the highest cost', () => {
    const maxCost = Math.max(...Object.values(ATTENTION_COSTS));
    expect(ATTENTION_COSTS.critical_alert).toBe(maxCost);
  });

  it('all costs are positive integers', () => {
    for (const cost of Object.values(ATTENTION_COSTS)) {
      expect(cost).toBeGreaterThan(0);
      expect(Number.isInteger(cost)).toBe(true);
    }
  });
});
