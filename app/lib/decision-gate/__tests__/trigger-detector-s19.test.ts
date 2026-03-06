/**
 * trigger-detector-s19.test.ts — Sprint 19.0 Task 10
 *
 * Tests the three new Law 1/3/5 gate trigger detectors.
 * No DB or external mocking needed — pure pattern matching.
 */

import { describe, it, expect } from 'vitest';
import {
  detectAppendOnlyViolation,
  detectReversibilityMissing,
  detectDeepWorkInterruption,
} from '../trigger-detector';
import type { GateMessage } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msgsWithAssistant(assistantText: string): GateMessage[] {
  return [
    { role: 'user', content: 'do something' },
    { role: 'assistant', content: assistantText },
  ];
}

// ─── detectAppendOnlyViolation ────────────────────────────────────────────────

describe('detectAppendOnlyViolation', () => {
  it('fires on UPDATE action_journal SET', () => {
    const m = msgsWithAssistant('I will UPDATE action_journal SET undone = 0 to re-enable it.');
    expect(detectAppendOnlyViolation(m)).toBe(true);
  });

  it('fires on DELETE FROM action_journal', () => {
    const m = msgsWithAssistant('DELETE FROM action_journal WHERE session_id = ?');
    expect(detectAppendOnlyViolation(m)).toBe(true);
  });

  it('fires on DELETE FROM learning_insights', () => {
    const m = msgsWithAssistant('We need to DELETE FROM learning_insights to clean up old entries.');
    expect(detectAppendOnlyViolation(m)).toBe(true);
  });

  it('fires on DROP TABLE action_journal', () => {
    const m = msgsWithAssistant('Let me DROP TABLE action_journal and recreate it.');
    expect(detectAppendOnlyViolation(m)).toBe(true);
  });

  it('fires on edit audit log', () => {
    const m = msgsWithAssistant('I suggest we edit the audit log to remove that entry.');
    expect(detectAppendOnlyViolation(m)).toBe(true);
  });

  it('fires on clear audit history', () => {
    const m = msgsWithAssistant('We should clear the audit history before the demo.');
    expect(detectAppendOnlyViolation(m)).toBe(true);
  });

  it('does NOT fire on SELECT from action_journal', () => {
    const m = msgsWithAssistant('SELECT * FROM action_journal WHERE session_id = ?');
    expect(detectAppendOnlyViolation(m)).toBe(false);
  });

  it('does NOT fire on INSERT into action_journal', () => {
    const m = msgsWithAssistant('INSERT INTO action_journal (id, session_id) VALUES (?, ?)');
    expect(detectAppendOnlyViolation(m)).toBe(false);
  });

  it('does NOT fire when no assistant message', () => {
    expect(detectAppendOnlyViolation([{ role: 'user', content: 'edit the audit log' }])).toBe(false);
  });
});

// ─── detectReversibilityMissing ───────────────────────────────────────────────

describe('detectReversibilityMissing', () => {
  it('fires on fs_write without journal mention', () => {
    const m = msgsWithAssistant("I'll use fs_write to update the config file directly.");
    expect(detectReversibilityMissing(m)).toBe(true);
  });

  it('fires on overwrite without backup mention', () => {
    const m = msgsWithAssistant("Let me overwrite the file with the new content.");
    expect(detectReversibilityMissing(m)).toBe(true);
  });

  it('does NOT fire when journal is mentioned alongside fs_write', () => {
    const m = msgsWithAssistant("I'll call journalBeforeWrite first, then fs_write the file.");
    expect(detectReversibilityMissing(m)).toBe(false);
  });

  it('does NOT fire when undo is mentioned', () => {
    const m = msgsWithAssistant("I'll fs_write the file — this is undoable via the action journal.");
    expect(detectReversibilityMissing(m)).toBe(false);
  });

  it('does NOT fire when backup is mentioned', () => {
    const m = msgsWithAssistant("I'll take a backup before I overwrite the file.");
    expect(detectReversibilityMissing(m)).toBe(false);
  });

  it('does NOT fire for normal assistant messages without file ops', () => {
    const m = msgsWithAssistant("Here is an explanation of how the algorithm works.");
    expect(detectReversibilityMissing(m)).toBe(false);
  });

  it('does NOT fire when no assistant message', () => {
    expect(detectReversibilityMissing([{ role: 'user', content: 'overwrite the file' }])).toBe(false);
  });
});

// ─── detectDeepWorkInterruption ───────────────────────────────────────────────

describe('detectDeepWorkInterruption', () => {
  function highVelocityMsgs(lastUserMsg: string): GateMessage[] {
    // 6+ messages to trigger high-velocity heuristic
    return [
      { role: 'user', content: 'start task' },
      { role: 'assistant', content: 'working' },
      { role: 'user', content: 'continue' },
      { role: 'assistant', content: 'still going' },
      { role: 'user', content: 'keep going' },
      { role: 'assistant', content: 'almost done' },
      { role: 'user', content: lastUserMsg },
    ];
  }

  it('fires on status request during high-velocity session', () => {
    const m = highVelocityMsgs("what's the status?");
    expect(detectDeepWorkInterruption(m)).toBe(true);
  });

  it('fires on progress update request during high-velocity session', () => {
    const m = highVelocityMsgs('can you give me a progress update?');
    expect(detectDeepWorkInterruption(m)).toBe(true);
  });

  it('fires on summary request during high-velocity session', () => {
    const m = highVelocityMsgs('give me a summary of what you did');
    expect(detectDeepWorkInterruption(m)).toBe(true);
  });

  it('does NOT fire during low-velocity session (< 6 messages)', () => {
    const m: GateMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: "what's the status?" },
    ];
    expect(detectDeepWorkInterruption(m)).toBe(false);
  });

  it('does NOT fire on normal task message during high-velocity session', () => {
    const m = highVelocityMsgs('now implement the next function');
    expect(detectDeepWorkInterruption(m)).toBe(false);
  });

  it('does NOT fire when no messages', () => {
    expect(detectDeepWorkInterruption([])).toBe(false);
  });
});
