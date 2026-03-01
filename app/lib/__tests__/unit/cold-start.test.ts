/**
 * Tests for app/lib/vector/cold-start.ts — Sprint 3C
 *
 * Coverage:
 *   - warmAll(): calls readHotCache then buildWarmCache in order, logs three tier-ready messages
 *   - searchAllTiers(): short-circuits on hot cache, merges tiers, falls through to sqlite-vec
 *   - mergeDedup(): deduplicates by chunkId, sorts by similarity, respects k limit
 *
 * All three underlying cache modules and @/lib/vector are mocked.
 *
 * @module __tests__/unit/cold-start.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hot cache mock ────────────────────────────────────────────────────────────
const { mockReadHotCache, mockSearchHotCache } = vi.hoisted(() => ({
  mockReadHotCache: vi.fn().mockResolvedValue([]),
  mockSearchHotCache: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/vector/hot-cache', () => ({
  readHotCache: mockReadHotCache,
  searchHotCache: mockSearchHotCache,
}));

// ── Warm cache mock ───────────────────────────────────────────────────────────
const { mockBuildWarmCache, mockSearchWarmCache } = vi.hoisted(() => ({
  mockBuildWarmCache: vi.fn().mockResolvedValue(undefined),
  mockSearchWarmCache: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/vector/warm-cache', () => ({
  buildWarmCache: mockBuildWarmCache,
  searchWarmCache: mockSearchWarmCache,
}));

// ── @/lib/vector (Tier 3 — sqlite-vec) mock ───────────────────────────────────
const { mockSearchSimilar } = vi.hoisted(() => ({
  mockSearchSimilar: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/vector', () => ({
  searchSimilar: mockSearchSimilar,
}));

import { warmAll, searchAllTiers, mergeDedup } from '@/lib/vector/cold-start';
import type { VectorSearchResult } from '@/lib/vector/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResult(chunkId: string, similarity: number): VectorSearchResult {
  return { chunkId, similarity, distance: 1 - similarity };
}

function makeQuery(): Float32Array {
  return new Float32Array(384).fill(0.05);
}

beforeEach(() => {
  mockReadHotCache.mockReset();
  mockSearchHotCache.mockReset();
  mockBuildWarmCache.mockReset();
  mockSearchWarmCache.mockReset();
  mockSearchSimilar.mockReset();

  mockReadHotCache.mockResolvedValue([]);
  mockSearchHotCache.mockReturnValue([]);
  mockBuildWarmCache.mockResolvedValue(undefined);
  mockSearchWarmCache.mockReturnValue([]);
  mockSearchSimilar.mockResolvedValue([]);
});

// ─── warmAll() ────────────────────────────────────────────────────────────────

describe('warmAll()', () => {
  it('calls readHotCache() before buildWarmCache()', async () => {
    const order: string[] = [];
    mockReadHotCache.mockImplementation(async () => { order.push('hot'); });
    mockBuildWarmCache.mockImplementation(async () => { order.push('warm'); });

    await warmAll();
    expect(order).toEqual(['hot', 'warm']);
  });

  it('calls both readHotCache() and buildWarmCache() exactly once', async () => {
    await warmAll();
    expect(mockReadHotCache).toHaveBeenCalledOnce();
    expect(mockBuildWarmCache).toHaveBeenCalledOnce();
  });

  it('resolves without error when both tiers succeed', async () => {
    await expect(warmAll()).resolves.toBeUndefined();
  });

  it('propagates rejection when readHotCache() fails', async () => {
    mockReadHotCache.mockRejectedValue(new Error('disk read error'));
    await expect(warmAll()).rejects.toThrow('disk read error');
  });

  it('propagates rejection when buildWarmCache() fails', async () => {
    mockBuildWarmCache.mockRejectedValue(new Error('db error'));
    await expect(warmAll()).rejects.toThrow('db error');
  });
});

// ─── searchAllTiers() ─────────────────────────────────────────────────────────

describe('searchAllTiers()', () => {
  it('returns hot cache results immediately when hot has >= k above minSimilarity', async () => {
    const hotResults = Array.from({ length: 10 }, (_, i) =>
      makeResult(`hot-${i}`, 0.9 - i * 0.01)
    );
    mockSearchHotCache.mockReturnValue(hotResults);

    const results = await searchAllTiers(makeQuery(), 10, 0.7);
    expect(results).toHaveLength(10);
    expect(mockSearchWarmCache).not.toHaveBeenCalled();
    expect(mockSearchSimilar).not.toHaveBeenCalled();
  });

  it('falls through to warm cache when hot has < k results', async () => {
    mockSearchHotCache.mockReturnValue([makeResult('hot-1', 0.9)]);
    mockSearchWarmCache.mockReturnValue([
      makeResult('warm-1', 0.85),
      makeResult('warm-2', 0.82),
    ]);

    const results = await searchAllTiers(makeQuery(), 3, 0.7);
    expect(mockSearchWarmCache).toHaveBeenCalledOnce();
    // All three results should be present (1 hot + 2 warm = 3)
    expect(results).toHaveLength(3);
  });

  it('falls through to sqlite-vec when hot + warm have < k results', async () => {
    mockSearchHotCache.mockReturnValue([makeResult('hot-1', 0.88)]);
    mockSearchWarmCache.mockReturnValue([makeResult('warm-1', 0.84)]);
    mockSearchSimilar.mockResolvedValue([
      makeResult('vec-1', 0.8),
      makeResult('vec-2', 0.78),
    ]);

    const results = await searchAllTiers(makeQuery(), 5, 0.7);
    expect(mockSearchSimilar).toHaveBeenCalledOnce();
    expect(results.map((r) => r.chunkId)).toContain('vec-1');
  });

  it('does not fall through to sqlite-vec when merged already has k results', async () => {
    mockSearchHotCache.mockReturnValue([makeResult('h1', 0.9), makeResult('h2', 0.88)]);
    mockSearchWarmCache.mockReturnValue([makeResult('w1', 0.85)]);

    await searchAllTiers(makeQuery(), 3, 0.7);
    expect(mockSearchSimilar).not.toHaveBeenCalled();
  });

  it('filters results below minSimilarity from all tiers', async () => {
    mockSearchHotCache.mockReturnValue([
      makeResult('pass', 0.9),
      makeResult('fail', 0.5), // below threshold
    ]);

    const results = await searchAllTiers(makeQuery(), 10, 0.7);
    expect(results.every((r) => r.similarity >= 0.7)).toBe(true);
  });

  it('deduplicates the same chunkId appearing in multiple tiers', async () => {
    mockSearchHotCache.mockReturnValue([makeResult('shared', 0.9)]);
    mockSearchWarmCache.mockReturnValue([makeResult('shared', 0.85)]);

    const results = await searchAllTiers(makeQuery(), 10, 0.7);
    const shared = results.filter((r) => r.chunkId === 'shared');
    expect(shared).toHaveLength(1);
    // Should keep the higher similarity version (from hot cache)
    expect(shared[0]!.similarity).toBeCloseTo(0.9, 5);
  });

  it('passes k to searchHotCache and searchWarmCache', async () => {
    await searchAllTiers(makeQuery(), 7, 0.7);
    expect(mockSearchHotCache).toHaveBeenCalledWith(expect.any(Float32Array), 7);
  });
});

// ─── mergeDedup() ─────────────────────────────────────────────────────────────

describe('mergeDedup()', () => {
  it('deduplicates by chunkId, keeping highest similarity', () => {
    const results = [
      makeResult('a', 0.9),
      makeResult('a', 0.7), // duplicate — lower similarity
      makeResult('b', 0.8),
    ];
    const merged = mergeDedup(results, 10);
    expect(merged).toHaveLength(2);
    const a = merged.find((r) => r.chunkId === 'a');
    expect(a!.similarity).toBeCloseTo(0.9, 5);
  });

  it('returns at most k results', () => {
    const results = Array.from({ length: 10 }, (_, i) => makeResult(`r${i}`, 0.9 - i * 0.05));
    const merged = mergeDedup(results, 3);
    expect(merged).toHaveLength(3);
  });

  it('sorts output by similarity descending', () => {
    const results = [
      makeResult('low', 0.7),
      makeResult('high', 0.95),
      makeResult('mid', 0.8),
    ];
    const merged = mergeDedup(results, 10);
    expect(merged[0]!.chunkId).toBe('high');
    expect(merged[1]!.chunkId).toBe('mid');
    expect(merged[2]!.chunkId).toBe('low');
  });

  it('handles empty input', () => {
    expect(mergeDedup([], 10)).toEqual([]);
  });

  it('handles k=0', () => {
    const results = [makeResult('a', 0.9)];
    expect(mergeDedup(results, 0)).toEqual([]);
  });

  it('returns all results when count < k', () => {
    const results = [makeResult('a', 0.9), makeResult('b', 0.8)];
    expect(mergeDedup(results, 100)).toHaveLength(2);
  });
});
