'use client';

/**
 * ContextPanel React context + 30-second polling provider.
 *
 * Polls GET /api/context every 30s. Exposes ContextPanelState + collapsed
 * toggle to all context panel components. Collapsed preference is persisted
 * in localStorage under key `greglite:context-panel-collapsed`.
 *
 * Architecture: server does the KERNL query; this module only fetches JSON.
 * No direct better-sqlite3 usage — stays client-safe.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ContextPanelState } from './types';
import { DEFAULT_CONTEXT_STATE } from './types';

const POLL_INTERVAL_MS = 30_000;
const LS_KEY = 'greglite:context-panel-collapsed';

// ─── Context shape ───────────────────────────────────────────────────────────

export interface ContextPanelCtx {
  state: ContextPanelState;
  loading: boolean;
  collapsed: boolean;
  toggleCollapsed: () => void;
}

export const ContextPanelContext = createContext<ContextPanelCtx>({
  state: DEFAULT_CONTEXT_STATE,
  loading: true,
  collapsed: false,
  toggleCollapsed: () => undefined,
});

export function useContextPanel(): ContextPanelCtx {
  return useContext(ContextPanelContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function useContextPanelProvider(): ContextPanelCtx {
  const [state, setState] = useState<ContextPanelState>(DEFAULT_CONTEXT_STATE);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore collapsed preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored === 'true') setCollapsed(true);
    } catch {
      // localStorage unavailable — proceed with default
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch('/api/context', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json() as { success: boolean; data?: ContextPanelState };
      if (json.success && json.data) {
        setState(json.data);
      }
    } catch {
      // Network error — keep stale state, don't crash panel
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch immediately on mount
    void fetchContext();

    // Then poll every 30s
    intervalRef.current = setInterval(() => {
      void fetchContext();
      console.debug('[context-provider] poll fired');
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchContext]);

  return { state, loading, collapsed, toggleCollapsed };
}
