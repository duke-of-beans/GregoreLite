/**
 * Decision Gate — Unit Tests
 *
 * Tests for all 8 trigger conditions + lock state machine.
 * Each live trigger has independent positive and negative cases.
 * Stubs are verified to always return false.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectRepeatedQuestion,
  detectSacredPrincipleRisk,
  detectIrreversibleAction,
  detectLowConfidence,
  detectHighTradeoffCount,
  detectMultiProjectTouch,
  detectLargeEstimate,
} from '@/lib/decision-gate/trigger-detector';
import {
  acquireLock,
  releaseLock,
  dismissLock,
  getLockState,
  isMandatory,
  _resetLockState,
} from '@/lib/decision-gate/lock';
import { analyze } from '@/lib/decision-gate';
import type { GateMessage } from '@/lib/decision-gate/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function userMsg(content: string): GateMessage {
  return { role: 'user', content };
}

function assistantMsg(content: string): GateMessage {
  return { role: 'assistant', content };
}

// ─── repeated_question ────────────────────────────────────────────────────────

describe('detectRepeatedQuestion', () => {
  it('fires when same topic appears in 3+ user messages', () => {
    const messages: GateMessage[] = [
      userMsg('Should we use sqlite or postgres for the database schema?'),
      userMsg('I keep wondering about the database schema approach'),
      userMsg('What is the best way to handle the database schema migrations?'),
    ];
    expect(detectRepeatedQuestion(messages)).toBe(true);
  });

  it('does not fire with fewer than 3 user messages', () => {
    const messages: GateMessage[] = [
      userMsg('Should we use sqlite for the database?'),
      userMsg('What about postgres database options?'),
    ];
    expect(detectRepeatedQuestion(messages)).toBe(false);
  });

  it('does not fire when topics are unrelated across messages', () => {
    const messages: GateMessage[] = [
      userMsg('How should we handle authentication tokens?'),
      userMsg('What is the best approach for caching embeddings?'),
      userMsg('Should we add rate limiting to the API routes?'),
    ];
    expect(detectRepeatedQuestion(messages)).toBe(false);
  });

  it('ignores assistant messages when counting user repetitions', () => {
    const messages: GateMessage[] = [
      userMsg('Tell me about the caching strategy'),
      assistantMsg('Caching strategy involves cache invalidation and caching warm up and cache layers'),
      assistantMsg('Cache expiry and cache strategy are important considerations for caching'),
      assistantMsg('Here is more about caching and cache management and cache design'),
    ];
    // Only 1 user message — should not trigger even with assistant repetition
    expect(detectRepeatedQuestion(messages)).toBe(false);
  });

  it('only considers the last 10 user messages', () => {
    // 11 user messages — first 3 repeat the same schema/architecture topic.
    // With a 10-message window, the first message drops out, leaving only 2
    // messages with the repeated phrase — below the threshold of 3.
    const messages: GateMessage[] = [
      userMsg('how should we design the database schema migration strategy'),
      userMsg('the database schema migration question remains open'),
      userMsg('database schema migration needs a final answer'),
      // 8 fully distinct messages — no shared content-bearing words
      userMsg('shipping the new authentication flow next week'),
      userMsg('review the rate limiting implementation please'),
      userMsg('AEGIS integration looks good after the last fix'),
      userMsg('embeddings pipeline benchmark results look solid'),
      userMsg('war room dependency graph rendering correctly'),
      userMsg('artifact detection working across all render modes'),
      userMsg('cost tracker UI wired and showing live totals'),
      userMsg('job queue state machine transitions verified'),
    ];
    // Last 10 user messages: #2–#11. Only messages #2 and #3 contain
    // the schema/migration phrases — count = 2, below threshold of 3.
    expect(detectRepeatedQuestion(messages)).toBe(false);
  });
});

// ─── sacred_principle_risk ────────────────────────────────────────────────────

describe('detectSacredPrincipleRisk', () => {
  it('fires on "temporary fix"', () => {
    const messages = [assistantMsg('We could do a temporary fix for now')];
    expect(detectSacredPrincipleRisk(messages)).toBe(true);
  });

  it('fires on "technical debt"', () => {
    const messages = [userMsg("This will add some technical debt but let's ship it")];
    expect(detectSacredPrincipleRisk(messages)).toBe(true);
  });

  it('fires on "just for now"', () => {
    const messages = [assistantMsg('Just for now we can hardcode the value')];
    expect(detectSacredPrincipleRisk(messages)).toBe(true);
  });

  it('fires on "mvp of"', () => {
    const messages = [userMsg('Build an mvp of the payment system')];
    expect(detectSacredPrincipleRisk(messages)).toBe(true);
  });

  it('fires on "quick fix"', () => {
    const messages = [assistantMsg('A quick fix would be to patch the middleware')];
    expect(detectSacredPrincipleRisk(messages)).toBe(true);
  });

  it('does not fire on clean architecture discussion', () => {
    const messages = [
      userMsg('How should we design the authentication layer properly?'),
      assistantMsg('The right approach is to build a proper JWT middleware with refresh token rotation.'),
    ];
    expect(detectSacredPrincipleRisk(messages)).toBe(false);
  });

  it('is case-insensitive', () => {
    const messages = [assistantMsg('This is TECHNICAL DEBT we should avoid')];
    expect(detectSacredPrincipleRisk(messages)).toBe(true);
  });

  it('only checks last 5 messages', () => {
    const messages: GateMessage[] = [
      assistantMsg('This is a temporary fix for the auth issue'),
      userMsg('message 2'),
      userMsg('message 3'),
      userMsg('message 4'),
      userMsg('message 5'),
      userMsg('message 6'), // message 1 now outside the window
    ];
    expect(detectSacredPrincipleRisk(messages)).toBe(false);
  });
});

// ─── irreversible_action ──────────────────────────────────────────────────────

describe('detectIrreversibleAction', () => {
  it('fires on "drop table"', () => {
    const messages = [assistantMsg('Run DROP TABLE users to clean up the schema')];
    expect(detectIrreversibleAction(messages)).toBe(true);
  });

  it('fires on "deploy to prod"', () => {
    const messages = [assistantMsg('You can now deploy to prod with these changes')];
    expect(detectIrreversibleAction(messages)).toBe(true);
  });

  it('fires on "push to main"', () => {
    const messages = [assistantMsg('Run git push to main to release')];
    expect(detectIrreversibleAction(messages)).toBe(true);
  });

  it('fires on "breaking change"', () => {
    const messages = [assistantMsg('This is a breaking change to the public API')];
    expect(detectIrreversibleAction(messages)).toBe(true);
  });

  it('fires on "force push"', () => {
    const messages = [assistantMsg('You will need to force push to override the history')];
    expect(detectIrreversibleAction(messages)).toBe(true);
  });

  it('fires on "delete from" SQL', () => {
    const messages = [assistantMsg('Execute: DELETE FROM sessions WHERE created_at < ?')];
    expect(detectIrreversibleAction(messages)).toBe(true);
  });

  it('does not fire on a regular code explanation', () => {
    const messages = [
      assistantMsg('Here is how to add the new index to the users table using a migration file.'),
    ];
    expect(detectIrreversibleAction(messages)).toBe(false);
  });

  it('only checks the last assistant message', () => {
    const messages: GateMessage[] = [
      assistantMsg('You can deploy to prod once all tests pass'),
      userMsg('Ok, got it'),
      assistantMsg('Yes, run the migration first and verify the rollback plan'),
    ];
    // The last assistant message has no irreversible pattern
    expect(detectIrreversibleAction(messages)).toBe(false);
  });

  it('does not fire if there are no assistant messages', () => {
    const messages = [userMsg('How do I deploy to prod?')];
    expect(detectIrreversibleAction(messages)).toBe(false);
  });
});

// ─── low_confidence ───────────────────────────────────────────────────────────

describe('detectLowConfidence', () => {
  it('fires when 2+ uncertainty phrases are present', () => {
    const messages = [
      assistantMsg(
        "I'm not sure this approach will work. You may want to double-check the schema compatibility."
      ),
    ];
    expect(detectLowConfidence(messages)).toBe(true);
  });

  it('does not fire with only 1 uncertainty phrase', () => {
    const messages = [assistantMsg("I'm not sure about the exact syntax here but this should work.")];
    expect(detectLowConfidence(messages)).toBe(false);
  });

  it('fires when multiple hedges accumulate', () => {
    const messages = [
      assistantMsg(
        "This might not be the best approach. I'd need to verify the edge cases. " +
          'You should verify the output before committing this to production.'
      ),
    ];
    expect(detectLowConfidence(messages)).toBe(true);
  });

  it('does not fire on a confident response', () => {
    const messages = [
      assistantMsg(
        'The correct approach is to use a compound index on (user_id, created_at). ' +
          'This will give you O(log n) lookup and the query planner will use it automatically.'
      ),
    ];
    expect(detectLowConfidence(messages)).toBe(false);
  });

  it('does not fire if there are no assistant messages', () => {
    const messages = [userMsg("I'm not sure what to do here, you may want to double-check")];
    expect(detectLowConfidence(messages)).toBe(false);
  });

  it('only checks the last assistant message', () => {
    const messages: GateMessage[] = [
      assistantMsg("I'm not sure this is right. You may want to double-check the implementation."),
      userMsg('Ok, what about the other approach?'),
      assistantMsg('The migration approach is straightforward and well-understood.'),
    ];
    // The last assistant message is confident
    expect(detectLowConfidence(messages)).toBe(false);
  });
});

// ─── Stubs — Sprint 4B ────────────────────────────────────────────────────────

describe('Sprint 4B stubs — always return false', () => {
  const messages: GateMessage[] = [
    userMsg('We need to decide on the architecture for the new system'),
    assistantMsg('There are several tradeoffs to consider across multiple projects'),
  ];

  it('detectHighTradeoffCount returns false', async () => {
    expect(await detectHighTradeoffCount(messages)).toBe(false);
  });

  it('detectMultiProjectTouch returns false', async () => {
    expect(await detectMultiProjectTouch(messages)).toBe(false);
  });

  it('detectLargeEstimate returns false', async () => {
    expect(await detectLargeEstimate(messages)).toBe(false);
  });
});

// ─── lock state machine ───────────────────────────────────────────────────────

describe('lock state machine', () => {
  beforeEach(() => {
    _resetLockState();
  });

  it('starts unlocked with zero dismissals', () => {
    const state = getLockState();
    expect(state.locked).toBe(false);
    expect(state.dismissCount).toBe(0);
    expect(state.trigger).toBeNull();
  });

  it('acquireLock sets locked state', () => {
    acquireLock('sacred_principle_risk', 'Detected technical debt language');
    const state = getLockState();
    expect(state.locked).toBe(true);
    expect(state.trigger).toBe('sacred_principle_risk');
    expect(state.reason).toBe('Detected technical debt language');
    expect(state.lockedAt).not.toBeNull();
  });

  it('releaseLock clears all state including dismissCount', () => {
    acquireLock('irreversible_action', 'Deploy to prod detected');
    dismissLock(); // dismissCount = 1
    releaseLock();
    const state = getLockState();
    expect(state.locked).toBe(false);
    expect(state.dismissCount).toBe(0);
    expect(state.trigger).toBeNull();
  });

  it('dismissLock increments dismissCount and releases when below 3', () => {
    acquireLock('low_confidence', 'Claude uncertain');
    dismissLock(); // count = 1
    const state = getLockState();
    expect(state.locked).toBe(false);
    expect(state.dismissCount).toBe(1);
  });

  it('dismissLock at count=2 still releases', () => {
    acquireLock('repeated_question', 'Same question 3x');
    dismissLock(); // 1
    acquireLock('repeated_question', 'Same question again');
    dismissLock(); // 2
    expect(getLockState().locked).toBe(false);
    expect(getLockState().dismissCount).toBe(2);
  });

  it('isMandatory returns false below 3 dismissals', () => {
    acquireLock('low_confidence', 'Claude uncertain');
    dismissLock(); // 1
    expect(isMandatory()).toBe(false);
    acquireLock('low_confidence', 'Claude uncertain again');
    dismissLock(); // 2
    expect(isMandatory()).toBe(false);
  });

  it('isMandatory returns true at 3 dismissals and gate stays locked', () => {
    acquireLock('repeated_question', 'Question');
    dismissLock(); // 1
    acquireLock('repeated_question', 'Question');
    dismissLock(); // 2
    acquireLock('repeated_question', 'Question');
    dismissLock(); // 3 — mandatory
    expect(isMandatory()).toBe(true);
    expect(getLockState().locked).toBe(true);
  });

  it('acquireLock preserves existing dismissCount', () => {
    acquireLock('low_confidence', 'First trigger');
    dismissLock(); // 1
    // New trigger fires — dismissCount should be preserved
    acquireLock('sacred_principle_risk', 'Second trigger');
    expect(getLockState().dismissCount).toBe(1);
  });
});

// ─── analyze() integration ────────────────────────────────────────────────────

describe('analyze()', () => {
  beforeEach(() => {
    _resetLockState();
    // Mock findSimilarChunks to avoid needing a real sqlite-vec index in tests
    vi.mock('@/lib/vector', () => ({
      findSimilarChunks: vi.fn().mockResolvedValue([]),
    }));
  });

  it('returns triggered:false for a normal conversation', async () => {
    const messages: GateMessage[] = [
      userMsg('How do I add a new column to the users table?'),
      assistantMsg('Use a migration file with ALTER TABLE users ADD COLUMN new_col TEXT.'),
    ];
    const result = await analyze(messages);
    expect(result.triggered).toBe(false);
    expect(result.trigger).toBeNull();
  });

  it('detects sacred_principle_risk and acquires lock', async () => {
    const messages: GateMessage[] = [
      userMsg('We need to ship this now'),
      assistantMsg('A quick fix would be to patch the middleware just for now'),
    ];
    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('sacred_principle_risk');
    expect(getLockState().locked).toBe(true);
  });

  it('detects irreversible_action', async () => {
    const messages: GateMessage[] = [
      userMsg('Clean up the old data'),
      assistantMsg('Run DELETE FROM audit_logs WHERE created_at < 2024-01-01 to purge old records.'),
    ];
    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.trigger).toBe('irreversible_action');
  });

  it('returns reason string with every trigger', async () => {
    const messages: GateMessage[] = [
      userMsg('Ship the quick fix'),
      assistantMsg('A quick fix here would be the tech debt approach'),
    ];
    const result = await analyze(messages);
    expect(result.triggered).toBe(true);
    expect(result.reason.length).toBeGreaterThan(0);
  });
});
