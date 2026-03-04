/**
 * Transit Map — Event Capture
 * Source of truth: TRANSIT_MAP_SPEC.md §4.4
 *
 * Server-side only. Uses better-sqlite3 (synchronous).
 * ALL capture hooks are FIRE-AND-FORGET — never block the chat stream or UI.
 * Errors are logged, never thrown. Telemetry loss is acceptable.
 */

import type { CaptureEventInput, EventMetadata } from './types';
import { getDatabase } from '@/lib/kernl/database';

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Write an event to the conversation_events table.
 *
 * Synchronous (better-sqlite3). Wrapped in try/catch — telemetry loss is
 * acceptable and must never surface as a thrown error to callers.
 *
 * Usage pattern (always fire-and-forget):
 *   try { captureEvent({ ... }); } catch { }
 * Or just call it directly — the function itself never throws.
 */
export function captureEvent(input: CaptureEventInput): void {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO conversation_events (id, conversation_id, message_id, event_type, category, payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      input.conversation_id,
      input.message_id ?? null,
      input.event_type,
      input.category,
      JSON.stringify(input.payload ?? {}),
    );
  } catch (err) {
    // Non-blocking — telemetry loss is acceptable.
    console.warn('[transit] captureEvent failed:', err);
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * All events for a conversation, ordered oldest-first.
 * Returns empty array on any error.
 */
export function getEventsForConversation(conversationId: string): EventMetadata[] {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, conversation_id, message_id, event_type, category, payload, created_at
      FROM conversation_events
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId) as Array<{
      id: string;
      conversation_id: string;
      message_id: string | null;
      event_type: string;
      category: string;
      payload: string;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      message_id: row.message_id,
      event_type: row.event_type,
      category: row.category as EventMetadata['category'],
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.warn('[transit] getEventsForConversation failed:', err);
    return [];
  }
}

/**
 * Most recent events of a specific type, newest-first.
 * Useful for learning pipeline analysis and the self-improvement dashboard.
 * Defaults to last 100 events.
 */
export function getEventsByType(eventType: string, limit = 100): EventMetadata[] {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, conversation_id, message_id, event_type, category, payload, created_at
      FROM conversation_events
      WHERE event_type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(eventType, limit) as Array<{
      id: string;
      conversation_id: string;
      message_id: string | null;
      event_type: string;
      category: string;
      payload: string;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      message_id: row.message_id,
      event_type: row.event_type,
      category: row.category as EventMetadata['category'],
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.warn('[transit] getEventsByType failed:', err);
    return [];
  }
}
