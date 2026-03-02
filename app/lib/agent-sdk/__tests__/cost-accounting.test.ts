/**
 * cost-accounting.test.ts — Phase 7D
 *
 * Tests for: cost-calculator, cost-tracker (DB layer), budget-enforcer.
 *
 * DB is mocked via vi.mock so no real SQLite connection is needed.
 * pricing.yaml is mocked via vi.mock('fs') to avoid filesystem dependency.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock fs so parsePricingYaml runs on fixture data ─────────────────────────

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    readFileSync: vi.fn((filePath: unknown) => {
      if (typeof filePath === 'string' && filePath.endsWith('pricing.yaml')) {
        return PRICING_YAML_FIXTURE;
      }
      return actual.readFileSync(filePath as string);
    }),
    watch: vi.fn(),
    existsSync: actual.existsSync,
  };
});

const PRICING_YAML_FIXTURE = `
models:
  claude-sonnet-4-5:
    input_per_million: 3.00
    output_per_million: 15.00
  claude-opus-4-5:
    input_per_million: 15.00
    output_per_million: 75.00
  claude-haiku-4-5-20251001:
    input_per_million: 0.80
    output_per_million: 4.00
`;

// ─── Mock the database ────────────────────────────────────────────────────────

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockPrepare = vi.fn(() => ({ run: mockRun, get: mockGet }));
const mockDb = { prepare: mockPrepare };

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  calculateCost,
  getPricingForModel,
  reloadPricing,
} from '../cost-calculator';

import {
  createSessionCost,
  updateSessionCost,
  finalizeSessionCost,
  getSessionCapStatus,
} from '../cost-tracker';

import {
  getDailyTotalUsd,
  isDailyCapReached,
  setDailyOverride,
  isDailyOverrideActive,
  clearDailyOverride,
  startOfTodayUtcMs,
  endOfTodayUtcMs,
  getBudgetConfigNumber,
  setBudgetConfig,
} from '../budget-enforcer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  reloadPricing(); // bust the pricing cache between tests
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 1. calculateCost ─────────────────────────────────────────────────────────

describe('calculateCost', () => {
  it('returns correct USD for sonnet exact key', () => {
    // 1M input @ $3 + 1M output @ $15 = $18
    expect(calculateCost(1_000_000, 1_000_000, 'claude-sonnet-4-5')).toBeCloseTo(18.0, 4);
  });

  it('returns correct USD for opus', () => {
    // 500k input @ $15/M + 200k output @ $75/M = $7.50 + $15.00 = $22.50
    expect(calculateCost(500_000, 200_000, 'claude-opus-4-5')).toBeCloseTo(22.50, 4);
  });

  it('returns correct USD for haiku (versioned key exact match)', () => {
    // 1M input @ $0.80 + 1M output @ $4.00 = $4.80
    expect(calculateCost(1_000_000, 1_000_000, 'claude-haiku-4-5-20251001')).toBeCloseTo(4.80, 4);
  });

  it('resolves versioned model key via date-strip fallback', () => {
    // claude-sonnet-4-5-20250929 → strip → claude-sonnet-4-5
    // 100k input @ $3/M + 50k output @ $15/M = $0.30 + $0.75 = $1.05
    expect(calculateCost(100_000, 50_000, 'claude-sonnet-4-5-20250929')).toBeCloseTo(1.05, 4);
  });

  it('returns 0 for unknown model (never crashes)', () => {
    expect(calculateCost(1_000_000, 1_000_000, 'unknown-model-xyz')).toBe(0);
  });

  it('returns 0 for zero tokens', () => {
    expect(calculateCost(0, 0, 'claude-sonnet-4-5')).toBe(0);
  });

  it('small token counts produce non-zero cost', () => {
    // 1000 input tokens of sonnet = $0.000003
    const cost = calculateCost(1_000, 0, 'claude-sonnet-4-5');
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeCloseTo(0.003, 6);
  });
});

// ─── 2. getPricingForModel fallback chain ─────────────────────────────────────

describe('getPricingForModel', () => {
  it('exact key returns rates directly', () => {
    const rates = getPricingForModel('claude-sonnet-4-5');
    expect(rates.input_per_million).toBe(3.00);
    expect(rates.output_per_million).toBe(15.00);
  });

  it('versioned key (YYYYMMDD suffix) falls back to short key', () => {
    const rates = getPricingForModel('claude-sonnet-4-5-20250929');
    expect(rates.input_per_million).toBe(3.00);
  });

  it('unknown model returns zero rates', () => {
    const rates = getPricingForModel('does-not-exist');
    expect(rates.input_per_million).toBe(0);
    expect(rates.output_per_million).toBe(0);
  });
});

// ─── 3. cost-tracker DB writes ────────────────────────────────────────────────

describe('createSessionCost', () => {
  it('calls db.prepare().run() with correct arguments', () => {
    createSessionCost('manifest-1', 'claude-sonnet-4-5', 'code', '/some/project');
    expect(mockPrepare).toHaveBeenCalledOnce();
    expect(mockRun).toHaveBeenCalledWith(
      'manifest-1',
      'code',
      'claude-sonnet-4-5',
      '/some/project',
      expect.any(Number), // started_at
      expect.any(Number), // updated_at
    );
  });

  it('accepts null projectId', () => {
    createSessionCost('manifest-2', 'claude-sonnet-4-5', 'docs', null);
    expect(mockRun).toHaveBeenCalledWith(
      'manifest-2', 'docs', 'claude-sonnet-4-5', null,
      expect.any(Number), expect.any(Number),
    );
  });
});

describe('updateSessionCost', () => {
  it('writes correct cost calculation to DB', () => {
    updateSessionCost('manifest-1', 100_000, 50_000, 'claude-sonnet-4-5');
    // Expected cost: (100k / 1M * 3.00) + (50k / 1M * 15.00) = $0.30 + $0.75 = $1.05
    expect(mockRun).toHaveBeenCalledWith(
      100_000,    // input_tokens
      50_000,     // output_tokens
      150_000,    // total_tokens
      expect.closeTo(1.05, 4), // estimated_cost_usd
      expect.any(Number),      // updated_at
      'manifest-1',
    );
  });
});

describe('finalizeSessionCost', () => {
  it('sets completed_at and updated_at', () => {
    finalizeSessionCost('manifest-1');
    expect(mockRun).toHaveBeenCalledWith(
      expect.any(Number), // completed_at
      expect.any(Number), // updated_at
      'manifest-1',
    );
  });
});

// ─── 4. getSessionCapStatus ───────────────────────────────────────────────────

describe('getSessionCapStatus', () => {
  it('returns ok when cost is below 80% of soft cap', () => {
    // Soft cap = $2.00 → 80% = $1.60 — cost $1.00 → ok
    mockGet.mockReturnValue({ value: '2.00' });
    expect(getSessionCapStatus(1.00)).toBe('ok');
  });

  it('returns warn when cost is between 80% and 100% of soft cap', () => {
    mockGet.mockReturnValue({ value: '2.00' });
    expect(getSessionCapStatus(1.70)).toBe('warn');
  });

  it('returns soft_cap when cost equals or exceeds soft cap', () => {
    mockGet.mockReturnValue({ value: '2.00' });
    expect(getSessionCapStatus(2.00)).toBe('soft_cap');
    expect(getSessionCapStatus(2.50)).toBe('soft_cap');
  });

  it('falls back to $2.00 soft cap when budget_config row is missing', () => {
    mockGet.mockReturnValue(undefined);
    // $1.50 is below $2.00 * 0.8 = $1.60 → ok
    expect(getSessionCapStatus(1.50)).toBe('ok');
    // $1.70 is above $1.60 → warn
    expect(getSessionCapStatus(1.70)).toBe('warn');
  });
});

// ─── 5. getDailyTotalUsd ─────────────────────────────────────────────────────

describe('getDailyTotalUsd', () => {
  it('returns sum from session_costs query', () => {
    mockGet.mockReturnValue({ total: 7.42 });
    const total = getDailyTotalUsd();
    expect(total).toBeCloseTo(7.42, 4);
    // Verify the query includes a started_at filter
    const sql = ((mockPrepare.mock.calls as unknown[][])[0] ?? [])[0] as string;
    expect(sql).toContain('SUM(estimated_cost_usd)');
    expect(sql).toContain('started_at');
  });

  it('returns 0 when no sessions exist today', () => {
    mockGet.mockReturnValue({ total: 0 });
    expect(getDailyTotalUsd()).toBe(0);
  });

  it('returns 0 if DB throws', () => {
    mockPrepare.mockImplementationOnce(() => { throw new Error('DB error'); });
    expect(getDailyTotalUsd()).toBe(0);
  });
});

// ─── 6. isDailyCapReached ─────────────────────────────────────────────────────

describe('isDailyCapReached', () => {
  it('returns true when daily total >= hard cap and no override', () => {
    // override check: key='daily_override_expires_at' → null
    // daily cap check: key='daily_hard_cap_usd' → 15.00
    // daily total: 15.50
    mockGet
      .mockReturnValueOnce(null)          // override key → null (no override)
      .mockReturnValueOnce({ value: '15.00' }) // daily_hard_cap_usd
      .mockReturnValueOnce({ total: 15.50 });  // SUM query
    expect(isDailyCapReached()).toBe(true);
  });

  it('returns false when daily total < hard cap', () => {
    mockGet
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ value: '15.00' })
      .mockReturnValueOnce({ total: 8.00 });
    expect(isDailyCapReached()).toBe(false);
  });

  it('returns false when override is active even if cap is exceeded', () => {
    // Override expiry set to far future
    const futureMs = Date.now() + 3_600_000;
    mockGet.mockReturnValueOnce({ value: String(futureMs) });
    expect(isDailyCapReached()).toBe(false);
  });
});

// ─── 7. Override for Today ────────────────────────────────────────────────────

describe('Override for Today', () => {
  it('setDailyOverride writes expiry at midnight UTC', () => {
    setDailyOverride();
    expect(mockRun).toHaveBeenCalledWith(
      'daily_override_expires_at',
      expect.stringMatching(/^\d+$/), // expiry timestamp as string
      expect.any(Number),
    );
    const expiry = parseInt(((mockRun.mock.calls as unknown[][])[0] ?? [])[1] as string, 10);
    const expectedMidnight = endOfTodayUtcMs();
    expect(expiry).toBe(expectedMidnight);
  });

  it('isDailyOverrideActive returns true for future expiry', () => {
    const futureMs = Date.now() + 3_600_000;
    mockGet.mockReturnValue({ value: String(futureMs) });
    expect(isDailyOverrideActive()).toBe(true);
  });

  it('isDailyOverrideActive returns false for past expiry', () => {
    const pastMs = Date.now() - 1_000;
    mockGet.mockReturnValue({ value: String(pastMs) });
    expect(isDailyOverrideActive()).toBe(false);
  });

  it('clearDailyOverride sets expiry to 0', () => {
    clearDailyOverride();
    expect(mockRun).toHaveBeenCalledWith('daily_override_expires_at', '0', expect.any(Number));
  });
});

// ─── 8. startOfTodayUtcMs / endOfTodayUtcMs ──────────────────────────────────

describe('startOfTodayUtcMs', () => {
  it('returns midnight UTC for today', () => {
    const start = startOfTodayUtcMs();
    const d = new Date(start);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });

  it('endOfTodayUtcMs is exactly 24h after startOfTodayUtcMs', () => {
    expect(endOfTodayUtcMs() - startOfTodayUtcMs()).toBe(86_400_000);
  });
});

// ─── 9. getBudgetConfigNumber / setBudgetConfig ───────────────────────────────

describe('getBudgetConfigNumber', () => {
  it('returns the parsed value from DB', () => {
    mockGet.mockReturnValue({ value: '10.00' });
    expect(getBudgetConfigNumber('session_hard_cap_usd', 999)).toBe(10.00);
  });

  it('returns fallback when row is missing', () => {
    mockGet.mockReturnValue(undefined);
    expect(getBudgetConfigNumber('missing_key', 42)).toBe(42);
  });
});

describe('setBudgetConfig', () => {
  it('upserts key/value into budget_config', () => {
    setBudgetConfig('daily_hard_cap_usd', '20.00');
    const sql = ((mockPrepare.mock.calls as unknown[][])[0] ?? [])[0] as string;
    expect(sql).toContain('INSERT INTO budget_config');
    expect(mockRun).toHaveBeenCalledWith('daily_hard_cap_usd', '20.00', expect.any(Number));
  });
});
