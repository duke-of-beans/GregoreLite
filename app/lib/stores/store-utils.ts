/**
 * Store Utilities
 *
 * Common utilities and helpers for Zustand stores.
 */

import { StateCreator } from 'zustand';

/**
 * Type for store reset function
 */
export type StoreResetter = () => void;

/**
 * Store with reset capability
 */
export interface ResettableStore {
  reset: () => void;
}

/**
 * Create a resettable store slice
 *
 * Wraps a state creator to add reset functionality that restores initial state.
 */
export const createResettableSlice = <T extends object>(
  initialState: T,
  stateCreator: StateCreator<T & ResettableStore>
): StateCreator<T & ResettableStore> => {
  return (set, get, store) => {
    const slice = stateCreator(set, get, store);

    return {
      ...slice,
      reset: () => {
        set(initialState);
      },
    };
  };
};

/**
 * Store version for migration support
 */
export interface VersionedStore {
  _version: number;
}

/**
 * Migration function type
 */
export type StoreMigration<T> = (state: unknown) => T;

/**
 * Create versioned store with migrations
 */
export const createVersionedStore = <T extends VersionedStore>(
  currentVersion: number,
  migrations: Record<number, StoreMigration<T>>
) => {
  return {
    version: currentVersion,
    migrate: (persistedState: unknown): T => {
      const state = persistedState as VersionedStore & T;

      if (!state || !state._version) {
        // No version, return as-is and let store handle initialization
        return state as T;
      }

      let migratedState = state;
      const currentStateVersion = state._version;

      // Apply migrations sequentially from old version to current
      for (
        let version = currentStateVersion + 1;
        version <= currentVersion;
        version++
      ) {
        const migration = migrations[version];
        if (migration) {
          migratedState = migration(migratedState) as VersionedStore & T;
          migratedState._version = version;
        }
      }

      return migratedState as T;
    },
  };
};

/**
 * Debounce helper for store updates
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Throttle helper for store updates
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Deep equality check for store selectors
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
 * Create selector with shallow comparison
 */
export function createShallowSelector<T, U>(
  selector: (state: T) => U
): (state: T) => U {
  let previous: U | undefined = undefined;
  let previousState: T | undefined = undefined;

  return (state: T) => {
    if (state !== previousState) {
      const next = selector(state);

      // Only update if shallow comparison shows difference
      if (previous === undefined || !shallowEqual(previous, next)) {
        previous = next;
      }

      previousState = state;
    }

    return previous as U;
  };
}

/**
 * Shallow equality check
 */
function shallowEqual(a: unknown, b: unknown): boolean {
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

  return keysA.every(
    (key) =>
      (a as Record<string, unknown>)[key] ===
      (b as Record<string, unknown>)[key]
  );
}

/**
 * Type-safe partial update helper
 */
export function createUpdater<T extends object>() {
  return (partial: Partial<T>) =>
    (state: T): T => ({
      ...state,
      ...partial,
    });
}

/**
 * Optimistic update pattern
 */
export interface OptimisticUpdate<T> {
  id: string;
  optimisticData: T;
  rollbackData: T;
  promise: Promise<T>;
}

/**
 * Create optimistic update manager
 */
export function createOptimisticManager<T>() {
  const pending = new Map<string, OptimisticUpdate<T>>();

  return {
    add(id: string, optimisticData: T, rollbackData: T, promise: Promise<T>) {
      pending.set(id, { id, optimisticData, rollbackData, promise });

      promise
        .then(() => {
          pending.delete(id);
        })
        .catch(() => {
          pending.delete(id);
        });
    },

    get(id: string): OptimisticUpdate<T> | undefined {
      return pending.get(id);
    },

    getAll(): OptimisticUpdate<T>[] {
      return Array.from(pending.values());
    },

    remove(id: string) {
      pending.delete(id);
    },

    clear() {
      pending.clear();
    },
  };
}
