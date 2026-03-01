/**
 * Store Performance Optimization Utilities
 *
 * Provides memoized selectors and performance monitoring for Zustand stores.
 * Prevents unnecessary re-renders and optimizes store access patterns.
 */

/**
 * Simple memoization for selector functions
 * Caches results based on referential equality of inputs
 */
export function memoize<T, R>(selector: (state: T) => R): (state: T) => R {
  let lastState: T | undefined;
  let lastResult: R | undefined;

  return (state: T): R => {
    // If state hasn't changed (referential equality), return cached result
    if (state === lastState && lastResult !== undefined) {
      return lastResult;
    }

    // State changed, recompute
    lastState = state;
    lastResult = selector(state);
    return lastResult;
  };
}

/**
 * Deep equality check for objects
 * Used for comparing complex selector results
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Memoization with deep equality check
 * Use for selectors that return new objects/arrays
 */
export function memoizeDeep<T, R>(selector: (state: T) => R): (state: T) => R {
  let lastState: T | undefined;
  let lastResult: R | undefined;
  return (state: T): R => {
    // If state hasn't changed and we have a cached result, return it
    if (state === lastState && lastResult !== undefined) {
      return lastResult;
    }

    // Compute new result
    const newResult = selector(state);

    // If result is deeply equal to last result, return cached instance
    // This prevents unnecessary re-renders when selector returns new objects
    // with same values
    if (lastResult !== undefined && deepEqual(newResult, lastResult)) {
      return lastResult;
    }

    // Result changed, update cache
    lastState = state;
    lastResult = newResult;
    return newResult;
  };
}

/**
 * Memoization for array selectors
 * Optimized for cases where selector returns filtered/mapped arrays
 */
export function memoizeArray<T, R>(
  selector: (state: T) => R[]
): (state: T) => R[] {
  let lastState: T | undefined;
  let lastResult: R[] | undefined;

  return (state: T): R[] => {
    if (state === lastState && lastResult !== undefined) {
      return lastResult;
    }

    const newResult = selector(state);

    // Check if array contents are the same
    if (
      lastResult !== undefined &&
      newResult.length === lastResult.length &&
      newResult.every((item, idx) => deepEqual(item, lastResult![idx]))
    ) {
      return lastResult;
    }

    lastState = state;
    lastResult = newResult;
    return newResult;
  };
}

/**
 * Performance monitoring wrapper for selectors
 * Logs slow selectors in development mode
 */
export function monitorSelector<T, R>(
  name: string,
  selector: (state: T) => R,
  warnThresholdMs: number = 10
): (state: T) => R {
  if (process.env.NODE_ENV !== 'development') {
    return selector;
  }

  return (state: T): R => {
    const start = performance.now();
    const result = selector(state);
    const duration = performance.now() - start;

    if (duration > warnThresholdMs) {
      console.warn(
        `[Store Performance] Slow selector "${name}": ${duration.toFixed(2)}ms`
      );
    }

    return result;
  };
}
/**
 * Batch selector updates to reduce re-renders
 * Useful when multiple state updates happen in quick succession
 */
export function batchSelectors<T>(
  store: T,
  updates: ((state: T) => void)[]
): void {
  // In Zustand, we can wrap multiple updates in a single transaction
  // This prevents intermediate renders

  // Note: Zustand automatically batches updates within the same tick,
  // but this helper makes the intent explicit
  updates.forEach((update) => {
    if (typeof store === 'object' && store !== null && 'setState' in store) {
      const setState = (store as { setState: (fn: (state: T) => void) => void })
        .setState;
      setState(update);
    }
  });
}

/**
 * Create a throttled selector that only updates at most once per interval
 * Useful for high-frequency updates like scroll position
 */
export function throttleSelector<T, R>(
  selector: (state: T) => R,
  intervalMs: number = 16 // ~60fps
): (state: T) => R {
  let lastResult: R | undefined;
  let lastTime = 0;

  return (state: T): R => {
    const now = Date.now();

    // If enough time has passed, recompute
    if (now - lastTime >= intervalMs || lastResult === undefined) {
      lastResult = selector(state);
      lastTime = now;
    }

    return lastResult;
  };
}

/**
 * Create a debounced selector that only updates after state settles
 * Useful for search inputs or text fields
 */
export function debounceSelector<T, R>(
  selector: (state: T) => R,
  delayMs: number = 300
): (state: T) => R {
  let lastResult: R | undefined;
  let timeoutId: NodeJS.Timeout | undefined;

  return (state: T): R => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      lastResult = selector(state);
    }, delayMs);

    // Return last computed result (or compute immediately if first call)
    if (lastResult === undefined) {
      lastResult = selector(state);
    }

    return lastResult;
  };
}

/**
 * Selector composition helper
 * Combine multiple selectors with automatic memoization
 */
export function composeSelectors<T, R1, R2, R3>(
  selector1: (state: T) => R1,
  selector2: (state: T) => R2,
  combiner: (r1: R1, r2: R2) => R3
): (state: T) => R3 {
  const memoized1 = memoize(selector1);
  const memoized2 = memoize(selector2);

  return memoizeDeep((state: T) => {
    const r1 = memoized1(state);
    const r2 = memoized2(state);
    return combiner(r1, r2);
  });
}
/**
 * Store performance metrics
 * Track selector call counts and timings
 */
interface SelectorMetrics {
  name: string;
  callCount: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
}

const metricsMap = new Map<string, Omit<SelectorMetrics, 'avgTime'>>();

/**
 * Track selector performance metrics
 */
export function trackSelector<T, R>(
  name: string,
  selector: (state: T) => R
): (state: T) => R {
  if (process.env.NODE_ENV !== 'development') {
    return selector;
  }

  return (state: T): R => {
    const start = performance.now();
    const result = selector(state);
    const duration = performance.now() - start;

    // Update metrics
    const existing = metricsMap.get(name);
    if (existing) {
      existing.callCount++;
      existing.totalTime += duration;
      existing.maxTime = Math.max(existing.maxTime, duration);
      existing.minTime = Math.min(existing.minTime, duration);
    } else {
      metricsMap.set(name, {
        name,
        callCount: 1,
        totalTime: duration,
        maxTime: duration,
        minTime: duration,
      });
    }

    return result;
  };
}

/**
 * Get selector performance metrics
 */
export function getSelectorMetrics(): SelectorMetrics[] {
  return Array.from(metricsMap.values())
    .map((m) => ({
      ...m,
      avgTime: m.totalTime / m.callCount,
    }))
    .sort((a, b) => b.totalTime - a.totalTime); // Sort by total time
}

/**
 * Clear selector performance metrics
 */
export function clearSelectorMetrics(): void {
  metricsMap.clear();
}

/**
 * Log selector performance metrics to console
 */
export function logSelectorMetrics(): void {
  if (process.env.NODE_ENV !== 'development') return;

  const metrics = getSelectorMetrics();

  if (metrics.length === 0) {
    console.log('[Store Performance] No metrics collected');
    return;
  }

  console.group('[Store Performance] Selector Metrics');
  console.table(
    metrics.map((m) => ({
      Selector: m.name,
      Calls: m.callCount,
      'Total (ms)': m.totalTime.toFixed(2),
      'Avg (ms)': m.avgTime.toFixed(2),
      'Max (ms)': m.maxTime.toFixed(2),
      'Min (ms)': m.minTime.toFixed(2),
    }))
  );
  console.groupEnd();
}
