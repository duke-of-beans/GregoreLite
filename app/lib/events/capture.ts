/**
 * Event Capture — Transit Map §2.3
 *
 * Writes conversation events to the conversation_events table.
 * Non-blocking — telemetry capture must NEVER break the chat flow.
 * If the database is unavailable, events are silently dropped.
 */

import { nanoid } from 'nanoid';

type EventCategory = 'flow' | 'quality' | 'system' | 'context' | 'cognitive';

export interface CaptureEventInput {
  conversation_id: string;
  message_id?: string;
  event_type: string;
  category: EventCategory;
  payload?: Record<string, unknown>;
}

export function captureEvent(input: CaptureEventInput): void {
  try {
    // Dynamic import to avoid circular dependency with kernl init
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDatabase } = require('@/lib/kernl/database');
    const db = getDatabase();
    db.prepare(`
      INSERT INTO conversation_events (id, conversation_id, message_id, event_type, category, payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      nanoid(),
      input.conversation_id,
      input.message_id ?? null,
      input.event_type,
      input.category,
      JSON.stringify(input.payload ?? {}),
    );
  } catch (err) {
    // Non-blocking — telemetry loss is acceptable
    console.warn('[events] capture failed:', err);
  }
}
