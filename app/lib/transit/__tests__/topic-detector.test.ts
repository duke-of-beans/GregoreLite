/**
 * topic-detector tests — Sprint 11.3
 * Covers: similar messages, different messages, short messages, threshold boundary
 */

import { describe, it, expect } from 'vitest';
import { detectTopicShift } from '../topic-detector';

describe('detectTopicShift', () => {
  // ── Similar messages → high similarity, no shift ────────────────────────

  it('returns no shift for highly similar consecutive messages', () => {
    // High token overlap: {binary, search, tree, python} shared = Jaccard ~0.57
    const prev = 'How do I implement a binary search tree in Python?';
    const curr = 'Can you explain binary search tree insertion in Python?';
    const result = detectTopicShift(prev, curr);
    expect(result.isShift).toBe(false);
    expect(result.similarity).toBeGreaterThan(0.4);
    expect(result.inferredTopic).toBe('');
  });

  it('returns no shift when messages share most keywords', () => {
    // Heavily overlapping tokens: {react, hooks, manage, state, data, components}
    const prev = 'How should React hooks manage state data in components?';
    const curr = 'Which React hooks help manage state data for components?';
    const result = detectTopicShift(prev, curr);
    expect(result.isShift).toBe(false);
    expect(result.similarity).toBeGreaterThanOrEqual(0.4);
  });

  // ── Different messages → low similarity, shift detected ─────────────────

  it('detects topic shift between completely unrelated messages', () => {
    const prev = 'Write me a SQL query to find duplicate rows in a database table';
    // Message is >60 chars so inferredTopic will be exactly 60 after slice
    const curr = 'Can you help me create a detailed vegetarian meal plan for the entire week with recipes?';
    const result = detectTopicShift(prev, curr);
    expect(result.isShift).toBe(true);
    expect(result.similarity).toBeLessThan(0.4);
    expect(result.inferredTopic).toHaveLength(60); // capped at 60 chars
  });

  it('detects topic shift from coding to travel planning', () => {
    const prev = 'Debug this Python function that calculates fibonacci numbers recursively';
    const curr = 'What are the best tourist attractions to visit in Tokyo Japan?';
    const result = detectTopicShift(prev, curr);
    expect(result.isShift).toBe(true);
    expect(result.similarity).toBeLessThan(0.4);
    expect(result.inferredTopic).not.toBe('');
  });

  // ── Short messages → no shift (too short to judge) ──────────────────────

  it('returns no shift for previous message with fewer than 3 meaningful tokens', () => {
    const prev = 'yes';
    const curr = 'Tell me about machine learning algorithms and neural networks in detail';
    const result = detectTopicShift(prev, curr);
    expect(result.isShift).toBe(false);
    expect(result.similarity).toBe(1);
    expect(result.inferredTopic).toBe('');
  });

  it('returns no shift for current message with fewer than 3 meaningful tokens', () => {
    const prev = 'Explain the differences between SQL and NoSQL databases for large-scale apps';
    const curr = 'ok';
    const result = detectTopicShift(prev, curr);
    expect(result.isShift).toBe(false);
    expect(result.similarity).toBe(1);
    expect(result.inferredTopic).toBe('');
  });

  it('returns no shift when both messages are too short', () => {
    const result = detectTopicShift('yes', 'no');
    expect(result.isShift).toBe(false);
    expect(result.similarity).toBe(1);
    expect(result.inferredTopic).toBe('');
  });

  // ── Threshold behaviour ──────────────────────────────────────────────────

  it('respects custom threshold — higher threshold catches more shifts', () => {
    // With default 0.4, this should be close to the boundary
    const prev = 'How do I deploy a Next.js application to production servers?';
    const curr = 'What is the best way to configure nginx for a web application?';

    const strictResult = detectTopicShift(prev, curr, 0.7);
    const lenientResult = detectTopicShift(prev, curr, 0.1);

    // Stricter threshold (0.7) is more likely to flag a shift
    expect(strictResult.isShift).toBe(true);
    // Lenient threshold (0.1) is less likely to flag a shift
    expect(lenientResult.isShift).toBe(false);
  });

  // ── Return shape ─────────────────────────────────────────────────────────

  it('inferredTopic is capped at 60 chars when shift is detected', () => {
    const prev = 'Write a recursive merge sort algorithm in JavaScript';
    const curr = 'Plan a seven course dinner menu for a French restaurant with wine pairings and desserts';
    const result = detectTopicShift(prev, curr);
    if (result.isShift) {
      expect(result.inferredTopic.length).toBeLessThanOrEqual(60);
    }
  });

  it('inferredTopic is empty string when no shift detected', () => {
    const prev = 'Explain how garbage collection works in modern JavaScript engines';
    const curr = 'How does the V8 engine perform garbage collection for JavaScript memory?';
    const result = detectTopicShift(prev, curr);
    if (!result.isShift) {
      expect(result.inferredTopic).toBe('');
    }
  });

  // ── Similarity is always 0–1 ─────────────────────────────────────────────

  it('similarity is always in [0, 1] range', () => {
    const cases = [
      ['hello world foo bar baz qux', 'completely different text about animals cats'],
      ['exact same words repeated twice', 'exact same words repeated twice'],
      ['', ''],
    ];
    for (const [a, b] of cases) {
      const result = detectTopicShift(a!, b!);
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
    }
  });
});
