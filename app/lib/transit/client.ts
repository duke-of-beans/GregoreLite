/**
 * Transit Map — Client-Side Event Capture
 *
 * Browser-safe. Uses fetch() to call /api/transit/capture.
 * ALWAYS fire-and-forget — never awaited, never throws, never blocks UI.
 * Import this in client components (ChatInterface, etc.).
 *
 * Do NOT import lib/transit/capture directly from client components —
 * that module uses better-sqlite3 (server-only).
 */

import type { CaptureEventInput } from './types';

/**
 * Fire-and-forget client-side event capture.
 * Posts to /api/transit/capture which calls captureEvent() server-side.
 * Errors are swallowed — telemetry loss is acceptable.
 *
 * @example
 * captureClientEvent({
 *   conversation_id: conversationId,
 *   event_type: 'quality.interruption',
 *   category: 'quality',
 *   payload: { partial_content_length: fullContent.length },
 * });
 */
export function captureClientEvent(input: CaptureEventInput): void {
  try {
    void fetch('/api/transit/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).catch((err: unknown) => {
      console.warn('[transit/client] capture failed:', err);
    });
  } catch (err) {
    // Synchronous error in fetch setup — swallow
    console.warn('[transit/client] capture setup failed:', err);
  }
}
