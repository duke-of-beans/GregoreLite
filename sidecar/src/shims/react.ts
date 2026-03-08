/**
 * Minimal React shim for Node.js sidecar context.
 *
 * Zustand v5 (zustand/react) imports useSyncExternalStore from 'react'.
 * In a Node.js API-route context there is no React tree — stores are
 * plain module-level singletons and .getState() is called directly.
 * This shim provides just enough surface area for the module graph to
 * initialise without crashing at startup.
 */

export function useSyncExternalStore<T>(
  _subscribe: (cb: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T
): T {
  // In a server (non-React) context, return the snapshot immediately.
  return (getServerSnapshot ?? getSnapshot)();
}

// Stub the most commonly imported hooks so deep transitive imports
// (e.g. zustand middleware, context utilities) don't throw on require.
export const useState = <T>(init: T | (() => T)): [T, (v: T) => void] => [
  typeof init === 'function' ? (init as () => T)() : init,
  () => {},
];
export const useReducer = (
  _reducer: unknown,
  init: unknown
): [unknown, () => void] => [init, () => {}];
export const useEffect = (_fn: () => void | (() => void), _deps?: unknown[]): void => {};
export const useLayoutEffect = (_fn: () => void | (() => void), _deps?: unknown[]): void => {};
export const useRef = <T>(init?: T): { current: T | undefined } => ({ current: init });
export const useCallback = <T extends (...args: unknown[]) => unknown>(fn: T): T => fn;
export const useMemo = <T>(fn: () => T, _deps?: unknown[]): T => fn();
export const useContext = (): undefined => undefined;
export const createContext = <T>(defaultValue?: T) => ({
  Provider: () => null,
  Consumer: () => null,
  displayName: undefined,
  _currentValue: defaultValue,
});
export const forwardRef = (render: unknown) => render;
export const memo = (component: unknown) => component;

// Default export mirrors the named exports so both
// `import React from 'react'` and `import { X } from 'react'` resolve.
const React = {
  useSyncExternalStore,
  useState,
  useReducer,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  useContext,
  createContext,
  forwardRef,
  memo,
};

export default React;
