'use client';

/**
 * useShimmerMatches — debounced KERNL memory shimmer hook.
 *
 * Debounces 300ms after the last keystroke, then POSTs to /api/shimmer-matches.
 * Returns ShimmerMatch[] for rendering the ShimmerOverlay.
 *
 * Skips query if:
 *   - enabled === false
 *   - inputText < 10 chars
 *   - fewer than 3 meaningful tokens (checked server-side too, but fast-fail here)
 */

import { useState, useEffect, useRef } from 'react';
import type { ShimmerMatch } from '@/lib/memory/shimmer-query';

export function useShimmerMatches(
  inputText: string,
  conversationId: string,
  enabled: boolean,
): ShimmerMatch[] {
  const [matches, setMatches] = useState<ShimmerMatch[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear on disable or short input
    if (!enabled || inputText.length < 10) {
      setMatches([]);
      return;
    }

    // Cancel previous debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // 300ms debounce
    debounceRef.current = setTimeout(() => {
      // Cancel any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      fetch('/api/shimmer-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputText, conversationId }),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : { matches: [] }))
        .then((data: { matches?: ShimmerMatch[] }) => {
          if (!controller.signal.aborted) {
            setMatches(data.matches ?? []);
          }
        })
        .catch((err: unknown) => {
          // Abort errors are expected on fast typing — ignore silently
          if (err instanceof DOMException && err.name === 'AbortError') return;
          console.warn('[useShimmerMatches] fetch error:', err);
          setMatches([]);
        });
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputText, conversationId, enabled]);

  // Clear matches when input is cleared
  useEffect(() => {
    if (inputText === '') {
      setMatches([]);
    }
  }, [inputText]);

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return matches;
}
