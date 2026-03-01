/**
 * Performance Monitoring Utilities
 *
 * Tools for measuring and tracking performance in GREGORE.
 * Used to identify bottlenecks and optimize hot paths.
 */

/**
 * Performance metric
 */
export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Performance tracker
 */
class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();
  private maxMetrics = 1000; // Circular buffer

  /**
   * Start timing an operation
   */
  start(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * End timing and record metric
   */
  end(name: string, metadata?: Record<string, unknown>): number | null {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`No timer started for: ${name}`);
      return null;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    this.recordMetric({
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    return duration;
  }

  /**
   * Measure a synchronous function
   */
  measure<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
    this.start(name);
    try {
      const result = fn();
      this.end(name, metadata);
      return result;
    } catch (error) {
      this.end(name, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure an async function
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      this.end(name, metadata);
      return result;
    } catch (error) {
      this.end(name, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Circular buffer - remove oldest if over limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations
    if (metric.duration > 100) {
      console.warn(
        `Slow operation detected: ${metric.name} took ${metric.duration.toFixed(2)}ms`,
        metric.metadata
      );
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for specific operation
   */
  getMetricsFor(name: string): PerformanceMetric[] {
    return this.metrics.filter((m) => m.name === name);
  }

  /**
   * Get average duration for operation
   */
  getAverageDuration(name: string): number {
    const metrics = this.getMetricsFor(name);
    if (metrics.length === 0) return 0;

    const total = metrics.reduce((sum, m) => sum + m.duration, 0);
    return total / metrics.length;
  }

  /**
   * Get statistics for operation
   */
  getStats(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.getMetricsFor(name);
    if (metrics.length === 0) return null;

    const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
    const count = durations.length;

    return {
      count,
      avg: durations.reduce((sum, d) => sum + d, 0) / count,
      min: durations[0]!,
      max: durations[count - 1]!,
      p50: durations[Math.floor(count * 0.5)]!,
      p95: durations[Math.floor(count * 0.95)]!,
      p99: durations[Math.floor(count * 0.99)]!,
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Get summary report
   */
  getSummary(): string {
    const operations = new Set(this.metrics.map((m) => m.name));
    const lines: string[] = ['Performance Summary:', ''];

    for (const op of operations) {
      const stats = this.getStats(op);
      if (stats) {
        lines.push(
          `${op}:`,
          `  Count: ${stats.count}`,
          `  Avg: ${stats.avg.toFixed(2)}ms`,
          `  Min: ${stats.min.toFixed(2)}ms`,
          `  Max: ${stats.max.toFixed(2)}ms`,
          `  P50: ${stats.p50.toFixed(2)}ms`,
          `  P95: ${stats.p95.toFixed(2)}ms`,
          `  P99: ${stats.p99.toFixed(2)}ms`,
          ''
        );
      }
    }

    return lines.join('\n');
  }
}

/**
 * Global performance tracker instance
 */
export const perf = new PerformanceTracker();

/**
 * Performance decorator for class methods
 */
export function measurePerformance(
  _target: unknown,
  propertyKey: string,
  descriptor: PropertyDescriptor
): void {
  const originalMethod = descriptor.value;

  descriptor.value = function (this: unknown, ...args: unknown[]) {
    const className = (this as { constructor: { name: string } }).constructor
      .name;
    const metricName = `${className}.${propertyKey}`;

    perf.start(metricName);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const result = originalMethod.apply(this, args) as unknown;

      // Handle async methods
      if (result instanceof Promise) {
        return result.finally(() => {
          perf.end(metricName);
        });
      }

      perf.end(metricName);
      return result;
    } catch (error) {
      perf.end(metricName, { error: true });
      throw error;
    }
  };
}

/**
 * Memory usage tracker
 */
export class MemoryTracker {
  /**
   * Get current memory usage (if available)
   */
  static getCurrentUsage(): {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null {
    if ('memory' in performance) {
      const memory = (
        performance as {
          memory?: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
          };
        }
      ).memory;

      if (memory) {
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        };
      }
    }
    return null;
  }

  /**
   * Format bytes to human-readable
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Log current memory usage
   */
  static logUsage(): void {
    const usage = this.getCurrentUsage();
    if (usage) {
      console.log('Memory Usage:', {
        used: this.formatBytes(usage.usedJSHeapSize),
        total: this.formatBytes(usage.totalJSHeapSize),
        limit: this.formatBytes(usage.jsHeapSizeLimit),
        percentage: `${((usage.usedJSHeapSize / usage.jsHeapSizeLimit) * 100).toFixed(2)}%`,
      });
    } else {
      console.log('Memory API not available');
    }
  }

  /**
   * Check if memory usage is high
   */
  static isMemoryHigh(threshold = 0.8): boolean {
    const usage = this.getCurrentUsage();
    if (!usage) return false;

    return usage.usedJSHeapSize / usage.jsHeapSizeLimit > threshold;
  }
}

/**
 * React component render tracker
 */
export class RenderTracker {
  private static renderCounts = new Map<string, number>();

  /**
   * Track component render
   */
  static track(componentName: string): void {
    const count = this.renderCounts.get(componentName) || 0;
    this.renderCounts.set(componentName, count + 1);

    if (count > 10) {
      console.warn(`${componentName} has rendered ${count + 1} times`);
    }
  }

  /**
   * Get render count for component
   */
  static getCount(componentName: string): number {
    return this.renderCounts.get(componentName) || 0;
  }

  /**
   * Get all render counts
   */
  static getAllCounts(): Map<string, number> {
    return new Map(this.renderCounts);
  }

  /**
   * Clear tracking data
   */
  static clear(): void {
    this.renderCounts.clear();
  }

  /**
   * Get summary report
   */
  static getSummary(): string {
    const sorted = Array.from(this.renderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const lines = ['Component Render Summary:', ''];
    for (const [name, count] of sorted) {
      lines.push(`${name}: ${count} renders`);
    }

    return lines.join('\n');
  }
}

/**
 * React hook for tracking renders
 */
export function useRenderTracker(componentName: string): void {
  RenderTracker.track(componentName);
}

/**
 * Database query performance tracker
 */
export class QueryTracker {
  private static queries: Array<{
    query: string;
    duration: number;
    timestamp: number;
  }> = [];

  /**
   * Track query execution
   */
  static track(query: string, duration: number): void {
    this.queries.push({
      query: query.trim(),
      duration,
      timestamp: Date.now(),
    });

    // Keep only last 100 queries
    if (this.queries.length > 100) {
      this.queries.shift();
    }

    // Log slow queries
    if (duration > 50) {
      console.warn(
        `Slow query (${duration.toFixed(2)}ms):`,
        query.substring(0, 100)
      );
    }
  }

  /**
   * Get slow queries (>50ms)
   */
  static getSlowQueries(): typeof QueryTracker.queries {
    return this.queries.filter((q) => q.duration > 50);
  }

  /**
   * Get query statistics
   */
  static getStats(): {
    total: number;
    avgDuration: number;
    slowQueries: number;
  } {
    const total = this.queries.length;
    const avgDuration =
      total > 0
        ? this.queries.reduce((sum, q) => sum + q.duration, 0) / total
        : 0;
    const slowQueries = this.queries.filter((q) => q.duration > 50).length;

    return { total, avgDuration, slowQueries };
  }

  /**
   * Clear tracking data
   */
  static clear(): void {
    this.queries = [];
  }
}
