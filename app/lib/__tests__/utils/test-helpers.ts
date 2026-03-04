/**
 * Test Utilities - Database & Store Testing Helpers
 *
 * Provides utilities for setting up test databases,
 * cleaning up after tests, and asserting common patterns.
 */

import Database from 'better-sqlite3';
import { expect } from 'vitest';
import type { Result } from '@/lib/repositories/types';

// ============================================================================
// DATABASE SETUP & TEARDOWN
// ============================================================================
// NOTE: setupTestDatabase / teardownTestDatabase / clearDatabase /
// setupTestDatabaseHooks were removed in Sprint 11.0 — they depended on
// lib/database/ (the old gregore.db ConversationRepository layer) which was
// deleted as part of route consolidation.  The KERNL SQLite layer
// (lib/kernl/database) self-initialises; per-test setup is not needed.

// ============================================================================
// RESULT ASSERTIONS
// ============================================================================

/**
 * Assert a Result is Ok and return the value
 */
export const expectOk = <T, E>(result: Result<T, E>): T => {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('Expected Ok result');
  }
  return result.value;
};

/**
 * Assert a Result is Err and return the error
 */
export const expectErr = <T, E>(result: Result<T, E>): E => {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('Expected Err result');
  }
  return result.error;
};

/**
 * Assert a Result is Ok with specific value
 */
export const expectOkValue = <T, E>(
  result: Result<T, E>,
  expectedValue: T
): void => {
  const value = expectOk(result);
  expect(value).toEqual(expectedValue);
};

/**
 * Assert a Result is Err with specific error message
 */
export const expectErrMessage = <T, E extends Error>(
  result: Result<T, E>,
  expectedMessage: string | RegExp
): void => {
  const error = expectErr(result);
  if (typeof expectedMessage === 'string') {
    expect(error.message).toBe(expectedMessage);
  } else {
    expect(error.message).toMatch(expectedMessage);
  }
};

// ============================================================================
// DATABASE QUERY HELPERS
// ============================================================================

/**
 * Get count of rows in a table
 */
export const getTableCount = (
  db: Database.Database,
  tableName: string
): number => {
  const result = db
    .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
    .get() as {
    count: number;
  };
  return result.count;
};

/**
 * Check if a record exists by ID
 */
export const recordExists = (
  db: Database.Database,
  tableName: string,
  id: string
): boolean => {
  const result = db
    .prepare(`SELECT 1 FROM ${tableName} WHERE id = ? LIMIT 1`)
    .get(id);
  return result !== undefined;
};

/**
 * Get all IDs from a table
 */
export const getAllIds = (
  db: Database.Database,
  tableName: string
): string[] => {
  const rows = db.prepare(`SELECT id FROM ${tableName}`).all() as Array<{
    id: string;
  }>;
  return rows.map((row) => row.id);
};

/**
 * Execute query and expect specific row count
 */
export const expectRowCount = (
  db: Database.Database,
  query: string,
  params: unknown[],
  expectedCount: number
): void => {
  const rows = db.prepare(query).all(...params);
  expect(rows).toHaveLength(expectedCount);
};

// ============================================================================
// TRANSACTION HELPERS
// ============================================================================

/**
 * Execute function in transaction and rollback
 * Useful for testing transaction behavior
 */
export const executeInTransaction = <T>(
  db: Database.Database,
  fn: () => T
): T => {
  const transaction = db.transaction(fn);
  return transaction();
};

/**
 * Test that function throws in transaction
 */
export const expectTransactionRollback = (
  db: Database.Database,
  fn: () => void
): void => {
  expect(() => {
    const transaction = db.transaction(fn);
    transaction();
  }).toThrow();
};

// ============================================================================
// TIMING UTILITIES
// ============================================================================

/**
 * Wait for a specified duration
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Measure execution time of async function
 */
export const measureTime = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
};

// ============================================================================
// MOCK DATA HELPERS
// ============================================================================

/**
 * Generate unique ID for testing
 */
export const generateTestId = (prefix: string = 'test'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * Generate timestamp offset from now
 */
export const timestampOffset = (offsetMs: number): number => {
  return Date.now() + offsetMs;
};

/**
 * Create array of sequential numbers
 */
export const range = (count: number): number[] => {
  return Array.from({ length: count }, (_, i) => i);
};

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert array contains exactly the expected items (order doesn't matter)
 */
export const expectArrayContainsExactly = <T>(
  actual: T[],
  expected: T[]
): void => {
  expect(actual).toHaveLength(expected.length);
  expect(new Set(actual)).toEqual(new Set(expected));
};

/**
 * Assert object has specific keys
 */
export const expectObjectHasKeys = <T extends object>(
  obj: T,
  keys: string[]
): void => {
  const actualKeys = Object.keys(obj);
  keys.forEach((key) => {
    expect(actualKeys).toContain(key);
  });
};

/**
 * Assert timestamp is recent (within last N seconds)
 */
export const expectRecentTimestamp = (
  timestamp: Date,
  maxAgeSeconds: number = 10
): void => {
  const now = Date.now();
  const timestampMs = timestamp.getTime();
  const age = now - timestampMs;
  expect(age).toBeLessThan(maxAgeSeconds * 1000);
  expect(age).toBeGreaterThanOrEqual(0);
};

// ============================================================================
// STORE TESTING HELPERS
// ============================================================================

/**
 * Wait for store state to match condition
 */
export const waitForStoreState = async <T>(
  getState: () => T,
  condition: (state: T) => boolean,
  timeoutMs: number = 5000
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (condition(getState())) {
      return;
    }
    await wait(50);
  }

  throw new Error('Store state condition not met within timeout');
};

/**
 * Get store state changes over time
 */
export const captureStoreChanges = <T>(
  getState: () => T,
  durationMs: number = 1000
): Promise<T[]> => {
  return new Promise((resolve) => {
    const changes: T[] = [];
    const interval = setInterval(() => {
      changes.push(getState());
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      resolve(changes);
    }, durationMs);
  });
};
