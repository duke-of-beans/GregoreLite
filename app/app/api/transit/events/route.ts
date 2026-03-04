/**
 * GET /api/transit/events
 *
 * Returns all conversation_events for a conversation, enriched with:
 *   - config: the registry EventTypeDefinition (scrollbar, marker, etc.)
 *   - message_index: zero-based position of the attached message in conversation order
 *   - total_messages: count of messages in the conversation
 *
 * Used by ScrollbarLandmarks to position ticks accurately by message position.
 *
 * Sprint 11.3 — Transit Map Phase B
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getEventsForConversation } from '@/lib/transit/capture';
import { getEventType } from '@/lib/transit/registry';
import { getThreadMessages } from '@/lib/kernl';

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversationId');

  if (!conversationId) {
    return NextResponse.json({ events: [] });
  }

  try {
    // Build message → index map for accurate landmark positioning.
    // getThreadMessages returns messages ordered oldest-first.
    const messages = getThreadMessages(conversationId);
    const messageIndexMap = new Map<string, number>(
      messages.map((m, i) => [m.id, i]),
    );
    const totalMessages = messages.length;

    const events = getEventsForConversation(conversationId);

    const enriched = events.map((e) => ({
      ...e,
      message_index:
        e.message_id ? (messageIndexMap.get(e.message_id) ?? null) : null,
      total_messages: totalMessages,
      config: getEventType(e.event_type) ?? null,
    }));

    return NextResponse.json({ events: enriched });
  } catch (err) {
    console.warn('[transit/events] GET failed:', err);
    return NextResponse.json({ events: [] });
  }
}
