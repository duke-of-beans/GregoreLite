/**
 * Devtools Middleware
 *
 * Simple Redux DevTools helper for Zustand stores.
 */

/**
 * Redux DevTools extension interface
 */
interface ReduxDevtoolsExtension {
  connect(options: { name: string }): {
    send(action: { type: string }, state: unknown): void;
    init(state: unknown): void;
  };
}

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevtoolsExtension;
  }
}

/**
 * Check if devtools is available
 */
export function hasDevtools(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.__REDUX_DEVTOOLS_EXTENSION__ !== undefined
  );
}

/**
 * Connect to devtools
 */
export function connectDevtools(name: string) {
  if (!hasDevtools()) return null;

  try {
    return window.__REDUX_DEVTOOLS_EXTENSION__!.connect({ name });
  } catch (error) {
    console.error('Failed to connect to Redux DevTools:', error);
    return null;
  }
}

/**
 * Send action to devtools
 */
export function sendToDevtools(
  devtools: ReturnType<typeof connectDevtools>,
  actionName: string,
  state: unknown
): void {
  if (!devtools) return;

  try {
    devtools.send({ type: actionName }, state);
  } catch (error) {
    console.error('Failed to send action to devtools:', error);
  }
}
