/**
 * Persist Middleware
 *
 * Simple persistence middleware for Zustand stores.
 * Handles localStorage with versioning support.
 */

/**
 * Persist options
 */
export interface PersistOptions<T> {
  /** Storage key name */
  name: string;

  /** Version for migration support */
  version?: number;

  /** Partial state to persist (omit sensitive data) */
  partialize?: (state: T) => Partial<T>;

  /** Storage implementation (defaults to localStorage) */
  storage?: Storage;

  /** Called when hydration completes */
  onRehydrateStorage?: (state: T) => void;
}

/**
 * Persisted state wrapper
 */
interface PersistedState<T> {
  state: T;
  version: number;
}

/**
 * Save state to storage
 */
export function saveToStorage<T>(
  name: string,
  state: T,
  options: Pick<PersistOptions<T>, 'version' | 'partialize' | 'storage'>
): void {
  const {
    version = 0,
    partialize = (s) => s,
    storage = localStorage,
  } = options;

  try {
    const stateToPersist = partialize(state);
    const persistedState: PersistedState<Partial<T>> = {
      state: stateToPersist,
      version,
    };
    storage.setItem(name, JSON.stringify(persistedState));
  } catch (error) {
    console.error(`Failed to persist state for ${name}:`, error);
  }
}

/**
 * Load state from storage
 */
export function loadFromStorage<T>(
  name: string,
  options: Pick<PersistOptions<T>, 'version' | 'storage' | 'onRehydrateStorage'>
): Partial<T> | null {
  const { version = 0, storage = localStorage, onRehydrateStorage } = options;

  try {
    const item = storage.getItem(name);
    if (!item) return null;

    const persistedState = JSON.parse(item) as PersistedState<Partial<T>>;

    // Version mismatch - could add migration here if needed
    if (persistedState.version !== version) {
      console.warn(
        `State version mismatch for ${name}. Expected ${version}, got ${persistedState.version}`
      );
    }

    if (onRehydrateStorage) {
      onRehydrateStorage(persistedState.state as T);
    }

    return persistedState.state;
  } catch (error) {
    console.error(`Failed to hydrate state for ${name}:`, error);
    return null;
  }
}

/**
 * Clear persisted state
 */
export function clearPersistedState(
  name: string,
  storage: Storage = localStorage
): void {
  try {
    storage.removeItem(name);
  } catch (error) {
    console.error(`Failed to clear persisted state for ${name}:`, error);
  }
}

/**
 * Get persisted state without hydrating
 */
export function getPersistedState<T>(
  name: string,
  storage: Storage = localStorage
): T | null {
  try {
    const item = storage.getItem(name);
    if (!item) return null;

    const persistedState = JSON.parse(item) as PersistedState<T>;
    return persistedState.state;
  } catch (error) {
    console.error(`Failed to get persisted state for ${name}:`, error);
    return null;
  }
}
