/**
 * Query Performance Utilities
 *
 * Tools for analyzing, optimizing, and monitoring database query performance.
 */

import Database from 'better-sqlite3';
import { getDatabase } from '../database/connection';

/**
 * Query execution plan
 */
export interface QueryPlan {
  query: string;
  plan: {
    id: number;
    parent: number;
    detail: string;
  }[];
}

/**
 * Query performance metrics
 */
export interface QueryMetrics {
  query: string;
  executionTime: number;
  rowsAffected: number;
  usesIndex: boolean;
  indexName?: string;
}

/**
 * Analyze query execution plan
 *
 * Uses EXPLAIN QUERY PLAN to understand how SQLite will execute a query.
 * Helps identify missing indexes or inefficient query patterns.
 *
 * @example
 * ```typescript
 * const plan = analyzeQuery('SELECT * FROM conversations WHERE archived = 0');
 * console.log(plan);
 * // Shows: SCAN vs SEARCH, index usage, etc.
 * ```
 */
export function analyzeQuery(query: string): QueryPlan {
  const db = getDatabase();

  const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all() as {
    id: number;
    parent: number;
    notused: number;
    detail: string;
  }[];

  return {
    query,
    plan: plan.map((row) => ({
      id: row.id,
      parent: row.parent,
      detail: row.detail,
    })),
  };
}

/**
 * Measure query performance
 *
 * Executes query and measures execution time and resource usage.
 *
 * @example
 * ```typescript
 * const metrics = measureQuery(
 *   'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 20'
 * );
 * console.log(`Took ${metrics.executionTime}ms`);
 * ```
 */
export function measureQuery(
  query: string,
  params: unknown[] = []
): QueryMetrics {
  const db = getDatabase();
  const stmt = db.prepare(query);

  const startTime = performance.now();
  const result = params.length > 0 ? stmt.all(...params) : stmt.all();
  const endTime = performance.now();

  // Check if query uses an index
  const plan = analyzeQuery(query);
  const usesIndex = plan.plan.some((p) => p.detail.includes('USING INDEX'));
  const indexMatch = plan.plan
    .find((p) => p.detail.includes('USING INDEX'))
    ?.detail.match(/USING INDEX ([^\s]+)/);

  return {
    query,
    executionTime: endTime - startTime,
    rowsAffected: Array.isArray(result) ? result.length : 0,
    usesIndex,
    ...(indexMatch?.[1] && { indexName: indexMatch[1] }),
  };
}

/**
 * Benchmark query with multiple runs
 *
 * Runs query multiple times to get average performance metrics.
 * Useful for identifying performance regressions.
 */
export function benchmarkQuery(
  query: string,
  params: unknown[] = [],
  runs: number = 10
): {
  avgTime: number;
  minTime: number;
  maxTime: number;
  runs: number;
  metrics: QueryMetrics;
} {
  const times: number[] = [];
  let finalMetrics: QueryMetrics | null = null;

  for (let i = 0; i < runs; i++) {
    const metrics = measureQuery(query, params);
    times.push(metrics.executionTime);
    if (i === runs - 1) finalMetrics = metrics;
  }

  return {
    avgTime: times.reduce((sum, t) => sum + t, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    runs,
    metrics: finalMetrics!,
  };
}

/**
 * Get query execution statistics
 *
 * Returns detailed statistics about query execution including
 * cache hits, sorts, and index usage.
 */
export function getQueryStats(db?: Database.Database): {
  cacheHits: number;
  cacheMisses: number;
  cacheSize: number;
  pageCount: number;
} {
  const database = db || getDatabase();

  return {
    cacheHits: database.pragma('cache_hit', { simple: true }) as number,
    cacheMisses: database.pragma('cache_miss', { simple: true }) as number,
    cacheSize: database.pragma('cache_size', { simple: true }) as number,
    pageCount: database.pragma('page_count', { simple: true }) as number,
  };
}

/**
 * Optimize database
 *
 * Runs ANALYZE and VACUUM to optimize query performance.
 * Should be run periodically (e.g., during maintenance windows).
 */
export function optimizeDatabase(): {
  analyzeTime: number;
  vacuumTime: number;
  sizeBeforeKB: number;
  sizeAfterKB: number;
} {
  const db = getDatabase();

  // Get initial stats
  const statsBefore = getQueryStats(db);
  const pageSize = db.pragma('page_size', { simple: true }) as number;
  const sizeBeforeKB = (statsBefore.pageCount * pageSize) / 1024;

  // Run ANALYZE
  const analyzeStart = performance.now();
  db.prepare('ANALYZE').run();
  const analyzeTime = performance.now() - analyzeStart;

  // Run VACUUM
  const vacuumStart = performance.now();
  db.prepare('VACUUM').run();
  const vacuumTime = performance.now() - vacuumStart;

  // Get final stats
  const statsAfter = getQueryStats(db);
  const sizeAfterKB = (statsAfter.pageCount * pageSize) / 1024;

  return {
    analyzeTime,
    vacuumTime,
    sizeBeforeKB,
    sizeAfterKB,
  };
}

/**
 * Get slow queries
 *
 * Returns list of queries that took longer than threshold.
 * Useful for identifying optimization opportunities.
 */
export class QueryLogger {
  private queries: QueryMetrics[] = [];
  private enabled = false;

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  log(query: string, params: unknown[] = []): void {
    if (!this.enabled) return;

    const metrics = measureQuery(query, params);
    this.queries.push(metrics);
  }

  getSlowQueries(thresholdMs: number = 100): QueryMetrics[] {
    return this.queries
      .filter((q) => q.executionTime > thresholdMs)
      .sort((a, b) => b.executionTime - a.executionTime);
  }

  getStats(): {
    totalQueries: number;
    avgTime: number;
    slowQueries: number;
    fastQueries: number;
  } {
    const times = this.queries.map((q) => q.executionTime);
    const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;

    return {
      totalQueries: this.queries.length,
      avgTime,
      slowQueries: this.queries.filter((q) => q.executionTime > 100).length,
      fastQueries: this.queries.filter((q) => q.executionTime <= 100).length,
    };
  }

  clear(): void {
    this.queries = [];
  }

  report(): string {
    const stats = this.getStats();
    const slowQueries = this.getSlowQueries(100);

    let report = `\n=== Query Performance Report ===\n`;
    report += `Total Queries: ${stats.totalQueries}\n`;
    report += `Average Time: ${stats.avgTime.toFixed(2)}ms\n`;
    report += `Fast Queries (<100ms): ${stats.fastQueries}\n`;
    report += `Slow Queries (>100ms): ${stats.slowQueries}\n\n`;

    if (slowQueries.length > 0) {
      report += `Top 10 Slowest Queries:\n`;
      slowQueries.slice(0, 10).forEach((q, i) => {
        report += `${i + 1}. ${q.executionTime.toFixed(2)}ms - ${q.query.substring(0, 60)}...\n`;
        report += `   Uses Index: ${q.usesIndex ? 'YES' : 'NO'}`;
        if (q.indexName) report += ` (${q.indexName})`;
        report += '\n';
      });
    }

    return report;
  }
}

// Global query logger instance
export const queryLogger = new QueryLogger();
