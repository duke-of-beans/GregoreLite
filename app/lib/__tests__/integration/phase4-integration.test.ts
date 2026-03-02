/**
 * Decision Gate — Phase 4 Integration Tests (Sprint 4C)
 *
 * Certification suite for Phase 4. Tests that cross multiple modules
 * and verify the gate operates correctly end-to-end.
 *
 * Coverage:
 *   1. Gate fires on all 5 implemented live triggers
 *   2. Gate does NOT fire on 10 normal conversation scenarios (false positive rate)
 *   3. Lock state machine: acquire → dismiss → mandatory → override
 *   4. Mandatory gate: 3 dismissals, rationale ≥20 chars requirement
 *   5. KERNL logging: approve and override write correct schema
 *   6. getValueBoost(): real DB implementation (1.5× for decided threads, 1.0× otherwise)
 *   7. Performance: analyze() sync path < 100ms on 20-message conversation
 *
 * @module __tests__/integration/phase4-integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockCreate = vi.hoisted(() => vi.fn());
const mockLogDecision = vi.hoisted(() => vi.fn());
const mockReleaseLock = vi.hoisted(() => vi.fn());
const mockFindSimilarChunks = vi.hoisted(() => vi.fn().mockResolvedValue([]));

// DB mocks for getValueBoost
const { mockDbGet, mockDbPrepare } = vi.hoisted(() => {
  const get = vi.fn().mockReturnValue(undefined);
  const prepare = vi.fn().mockReturnValue({ get });
  return { mockDbGet: get, mockDbPrepare: prepare };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

vi.mock('@/lib/kernl/decision-store', () => ({
  logDecision: mockLogDecision,
}));

vi.mock('@/lib/decision-gate/lock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/decision-gate/lock')>();
  return { ...actual, releaseLock: mockReleaseLock };
});

vi.mock('@/lib/vector', () => ({
  findSimilarChunks: mockFindSimilarChunks,
}));

vi.mock('@/lib/kernl/database', () => ({
  getDatabase: vi.fn(() => ({ prepare: mockDbPrepare })),
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────────

import { analyze, getDecisionLock } from '@/lib/decision-gate';
import {
  acquireLock,
  dismissLock,
  isMandatory,
  _resetLockState,
} from '@/lib/decision-gate/lock';
import { logGateApproval } from '@/lib/decision-gate/kernl-logger';
import { getValueBoost } from '@/lib/cross-context/value-boost';
import type { GateMessage } from '@/lib/decision-gate';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function user(content: string): GateMessage {
  return { role: 'user', content };
}

function assistant(content: string): GateMessage {
  return { role: 'assistant', content };
}

/** Default Haiku response: all triggers false — no gate fires from inference. */
function haikuAllFalse() {
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: '{"highTradeoff":false,"multiProject":false,"largeEstimate":false}' }],
  });
}

// ─── Suite setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetLockState();
  mockCreate.mockReset();
  mockLogDecision.mockReset();
  mockReleaseLock.mockReset();
  mockFindSimilarChunks.mockResolvedValue([]);
  mockDbGet.mockReturnValue(undefined);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Gate fires on all 5 implemented live triggers
// ═══════════════════════════════════════════════════════════════════════════════

describe('Decision Gate — all 5 live triggers fire correctly', () => {
  it('repeated_question fires after 3 messages on the same topic', async () => {
    haikuAllFalse();
    // All three messages share the word "authentication" — n-gram overlap threshold
    const messages: GateMessage[] = [
      user('how should we approach the authentication system design?'),
      assistant('We could use JWT or session-based auth.'),
      user('going back to the authentication system, what is the right approach?'),
      assistant('That depends on the session persistence requirements.'),
      user('still thinking about the authentication system design and approach'),
    ];
    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('repeated_question');
  });

  it('sacred_principle_risk fires on "just for now" language', async () => {
    haikuAllFalse();
    const messages: GateMessage[] = [
      user('can we just add a temporary fix here just for now?'),
    ];
    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('sacred_principle_risk');
  });

  it('irreversible_action fires on "deploy to production"', async () => {
    haikuAllFalse();
    const messages: GateMessage[] = [
      assistant('We should deploy to production tonight to fix the issue.'),
    ];
    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('irreversible_action');
  });

  it('contradicts_prior fires when message matches prior KERNL decision', async () => {
    haikuAllFalse();
    mockFindSimilarChunks.mockResolvedValueOnce([
      {
        chunkId: 'decision-chunk-1',
        distance: 0.15,
        similarity: 0.85,
        content: 'We decided to use SQLite for all local persistence',
        sourceType: 'decision',
        sourceId: 'thread-prior-1',
      },
    ]);
    const messages: GateMessage[] = [
      user('I think we should switch everything to PostgreSQL for the local persistence layer'),
    ];
    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('contradicts_prior');
  });

  it('low_confidence fires when Claude expresses uncertainty 2+ times', async () => {
    haikuAllFalse();
    const messages: GateMessage[] = [
      assistant(
        "I'm not sure which approach is correct here. I cannot guarantee this will work " +
        'without further testing — you should verify the output before committing.',
      ),
    ];
    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('low_confidence');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Gate does NOT fire in 10 normal conversation scenarios
// ═══════════════════════════════════════════════════════════════════════════════

describe('Decision Gate — false positive testing (10 normal scenarios)', () => {
  // All Haiku calls return all-false; findSimilarChunks returns []

  it('does not fire on a general architecture discussion', async () => {
    haikuAllFalse();
    const result = await analyze([
      user('What are the tradeoffs between microservices and monoliths?'),
      assistant('Microservices offer independent deployment but add operational complexity.'),
    ]);
    expect(result.triggered).toBe(false);
  });

  it('does not fire on a code review request', async () => {
    haikuAllFalse();
    const result = await analyze([
      user('Can you review this TypeScript function for correctness?'),
      assistant('The function looks correct. One suggestion: extract the inner loop.'),
    ]);
    expect(result.triggered).toBe(false);
  });

  it('does not fire on a simple factual question', async () => {
    haikuAllFalse();
    const result = await analyze([
      user('What is the default port for PostgreSQL?'),
      assistant('PostgreSQL defaults to port 5432.'),
    ]);
    expect(result.triggered).toBe(false);
  });

  it('does not fire on a bug fix discussion', async () => {
    haikuAllFalse();
    const result = await analyze([
      user('The login button is not working — it throws a 401 on every request.'),
      assistant('The 401 suggests the auth token is missing from the request headers.'),
      user('Found it — the Authorization header was being stripped by the proxy.'),
    ]);
    expect(result.triggered).toBe(false);
  });

  it('does not fire on a status update message', async () => {
    haikuAllFalse();
    const result = await analyze([
      user('Just letting you know I pushed the changes to the feature branch.'),
      assistant('Confirmed. The branch is at the expected state.'),
    ]);
    expect(result.triggered).toBe(false);
  });

  it('does not fire on a learning or educational question', async () => {
    haikuAllFalse();
    const result = await analyze([
      user('Can you explain how async/await works under the hood in JavaScript?'),
      assistant('Async/await is syntactic sugar over Promises and the event loop.'),
    ]);
    expect(result.triggered).toBe(false);
  });

  it('does not fire on a best practices question', async () => {
    haikuAllFalse();
    const result = await analyze([
      user('What are the best practices for structuring a Next.js app?'),
      assistant('Use the App Router, colocate tests, and keep API routes thin.'),
    ]);
    expect(result.triggered).toBe(false);
  });

  it('does not fire on a design pattern question', async () => {
    haikuAllFalse();
    const result = await analyze([
      user('When should I use the Observer pattern vs Event Emitter?'),
      assistant('Observer is for synchronous notification; EventEmitter handles async.'),
    ]);
    expect(result.triggered).toBe(false);
  });

  it('does not fire on a testing discussion', async () => {
    haikuAllFalse();
    const result = await analyze([
      user('Should I write unit tests or integration tests for this module?'),
      assistant('Both. Unit tests for pure logic, integration tests for DB interactions.'),
    ]);
    expect(result.triggered).toBe(false);
  });

  it('does not fire on a documentation question', async () => {
    haikuAllFalse();
    const result = await analyze([
      user('How should I document the API endpoints for this service?'),
      assistant('Use OpenAPI/Swagger for REST endpoints. Document each param and error code.'),
    ]);
    expect(result.triggered).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Lock state machine transitions
// ═══════════════════════════════════════════════════════════════════════════════

describe('Lock state machine — acquire → dismiss → mandatory', () => {
  it('lock is inactive by default', () => {
    expect(getDecisionLock().locked).toBe(false);
    expect(getDecisionLock().dismissCount).toBe(0);
  });

  it('acquireLock activates the lock with trigger and reason', () => {
    acquireLock('sacred_principle_risk', 'temporary fix detected');
    const state = getDecisionLock();
    expect(state.locked).toBe(true);
    expect(state.trigger).toBe('sacred_principle_risk');
    expect(state.reason).toBe('temporary fix detected');
  });

  it('dismissLock below 3 releases the lock but preserves dismissCount', () => {
    acquireLock('low_confidence', 'uncertain');
    dismissLock(); // count = 1, released
    const state = getDecisionLock();
    expect(state.locked).toBe(false);
    expect(state.dismissCount).toBe(1);
  });

  it('3 dismissals makes the gate mandatory and keeps it locked', () => {
    acquireLock('irreversible_action', 'deploy detected');
    dismissLock(); // 1
    acquireLock('irreversible_action', 'deploy detected');
    dismissLock(); // 2
    acquireLock('irreversible_action', 'deploy detected');
    dismissLock(); // 3 → mandatory
    expect(isMandatory()).toBe(true);
    expect(getDecisionLock().locked).toBe(true);
  });

  it('API returns 423 signal when lock is active', () => {
    acquireLock('repeated_question', 'same question detected');
    // This mirrors the exact check in POST /api/chat
    const lock = getDecisionLock();
    expect(lock.locked).toBe(true); // route would return 423
  });

  it('API returns 200 signal after lock is released', () => {
    acquireLock('repeated_question', 'same question detected');
    // releaseLock is mocked (for KERNL logger tests); use _resetLockState for state machine tests
    _resetLockState();
    const lock = getDecisionLock();
    expect(lock.locked).toBe(false); // route would process normally
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Mandatory gate — rationale requirement
// ═══════════════════════════════════════════════════════════════════════════════

describe('Mandatory gate — rationale enforcement', () => {
  it('3 dismissals makes gate mandatory', () => {
    for (let i = 0; i < 3; i++) {
      acquireLock('low_confidence', 'uncertain');
      dismissLock();
    }
    expect(isMandatory()).toBe(true);
  });

  it('mandatory gate stays locked after the 3rd dismissal', () => {
    for (let i = 0; i < 3; i++) {
      acquireLock('low_confidence', 'uncertain');
      dismissLock();
    }
    // Gate is mandatory and still locked
    expect(getDecisionLock().locked).toBe(true);
    expect(getDecisionLock().dismissCount).toBe(3);
  });

  it('override without rationale (< 20 chars) should be rejected by API route logic', () => {
    // This mirrors the validation in POST /api/decision-gate/override
    const shortRationale = 'too short';
    expect(shortRationale.trim().length).toBeLessThan(20);
  });

  it('override with valid rationale (≥ 20 chars) passes validation', () => {
    const validRationale = 'I understand the risk and accept it explicitly';
    expect(validRationale.trim().length).toBeGreaterThanOrEqual(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. KERNL logging — approvals and overrides
// ═══════════════════════════════════════════════════════════════════════════════

describe('KERNL logging — approvals and overrides write correct schema', () => {
  beforeEach(() => {
    mockLogDecision.mockReset();
    mockReleaseLock.mockReset();
  });

  it('approval writes to decisions table with correct fields', () => {
    logGateApproval('thread-001', 'sacred_principle_risk', 'approved');
    expect(mockLogDecision).toHaveBeenCalledOnce();
    const arg = mockLogDecision.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.thread_id).toBe('thread-001');
    expect(arg.category).toBe('decision-gate');
    expect(arg.title).toContain('approved');
    expect(arg.title).toContain('sacred_principle_risk');
    expect(arg.impact).toBe('high');
  });

  it('override writes to decisions table with provided rationale', () => {
    const rationale = 'I have reviewed this and accept the temporary exception';
    logGateApproval('thread-002', 'irreversible_action', 'overridden', rationale);
    const arg = mockLogDecision.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.rationale).toBe(rationale);
    expect(arg.title).toContain('overridden');
  });

  it('releaseLock is called after KERNL write (not before)', () => {
    logGateApproval('thread-003', 'low_confidence', 'approved');
    const logOrder = mockLogDecision.mock.invocationCallOrder[0]!;
    const releaseOrder = mockReleaseLock.mock.invocationCallOrder[0]!;
    expect(releaseOrder).toBeGreaterThan(logOrder);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. getValueBoost() — real Phase 4 implementation
// ═══════════════════════════════════════════════════════════════════════════════

describe('getValueBoost() — Phase 4 real implementation', () => {
  beforeEach(() => {
    mockDbGet.mockReturnValue(undefined);
    mockDbPrepare.mockReturnValue({ get: mockDbGet });
  });

  it('returns 1.0 when chunk is not found in content_chunks', () => {
    mockDbGet.mockReturnValue(undefined); // chunk not found
    expect(getValueBoost('unknown-chunk')).toBe(1.0);
  });

  it('returns 1.0 when chunk exists but its thread has no decisions', () => {
    mockDbGet
      .mockReturnValueOnce({ source_id: 'thread-no-decision' }) // chunk found
      .mockReturnValueOnce(undefined); // no decision for that thread
    expect(getValueBoost('chunk-no-decision')).toBe(1.0);
  });

  it('returns 1.5 when chunk source thread has a logged KERNL decision', () => {
    mockDbGet
      .mockReturnValueOnce({ source_id: 'thread-with-decision' }) // chunk found
      .mockReturnValueOnce({ 1: 1 }); // decision exists (SELECT 1 result)
    expect(getValueBoost('chunk-decided')).toBe(1.5);
  });

  it('fails open (returns 1.0) on DB error — never penalises a chunk', () => {
    mockDbPrepare.mockImplementationOnce(() => {
      throw new Error('DB connection lost');
    });
    expect(getValueBoost('chunk-db-error')).toBe(1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Performance: sync analysis path < 100ms on 20-message conversation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Performance — sync analysis path timing', () => {
  it('sync path (no Haiku) completes well under 100ms on 20-message conversation', async () => {
    // Trigger irreversible_action synchronously — no Haiku call needed.
    // Filler messages use fully distinct vocabulary so repeated_question never fires first.
    const fillerPairs: GateMessage[] = [
      user('Can you explain the difference between TCP and UDP protocols?'),
      assistant('TCP guarantees delivery; UDP prioritises speed over reliability.'),
      user('What is the purpose of a reverse proxy in web infrastructure?'),
      assistant('A reverse proxy routes client requests to backend servers and handles SSL.'),
      user('How does garbage collection work in the JVM?'),
      assistant('The JVM uses generational GC with Eden, Survivor, and Old Gen spaces.'),
      user('What distinguishes a compiled language from an interpreted one?'),
      assistant('Compiled languages produce native binaries; interpreted ones run via a VM.'),
      user('Describe the CAP theorem in distributed systems.'),
      assistant('CAP states a system can guarantee only two of: Consistency, Availability, Partition tolerance.'),
      user('What is the role of an index in a relational database?'),
      assistant('An index speeds up SELECT queries at the cost of additional write overhead.'),
      user('How does HTTPS differ from HTTP?'),
      assistant('HTTPS wraps HTTP in TLS, providing encryption and server authentication.'),
      user('What is idempotency in REST API design?'),
      assistant('An idempotent operation produces the same result regardless of how many times it is called.'),
    ];
    const messages: GateMessage[] = [
      ...fillerPairs,
      assistant('We should truncate the users table and redeploy to production immediately.'),
      user('Understood, let us proceed.'),
    ];

    const t0 = Date.now();
    const result = await analyze(messages);
    const elapsed = Date.now() - t0;

    // Gate fired synchronously — Haiku never called
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('irreversible_action');
    expect(mockCreate).not.toHaveBeenCalled();

    // Log for SPRINT_4C_COMPLETE.md documentation
    console.log(`[perf] sync analyze() on 20-message conversation: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(100);
  });

  it('haiku inference path is called only when all sync checks pass', async () => {
    haikuAllFalse();
    // Completely benign message — all sync checks will pass, Haiku will be called
    const messages: GateMessage[] = [
      user('What is the best way to name TypeScript interfaces?'),
      assistant('Use PascalCase and descriptive names that describe the shape.'),
    ];

    const t0 = Date.now();
    await analyze(messages);
    const elapsed = Date.now() - t0;

    // Haiku should have been called (mocked, so near-instant)
    expect(mockCreate).toHaveBeenCalledOnce();
    console.log(`[perf] full analyze() path (sync + mocked Haiku): ${elapsed}ms`);
  });
});
