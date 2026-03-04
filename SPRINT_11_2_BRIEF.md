GREGLITE SPRINT 11.2 - Transit Map Phase A: Data Foundation
Sprint 11.2 | No UI — pure data layer | March 2026

YOUR ROLE: Build the event capture infrastructure for the Transit Map. This sprint creates the database tables, TypeScript types, event registry, capture helper, and initial capture hooks. NO UI COMPONENTS in this sprint. The data layer must exist before any visualization can be built. Sprints 11.3–11.7 depend on this foundation. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\TRANSIT_MAP_SPEC.md — READ §2 (Event Taxonomy), §4 (Storage & Capture) FULLY before touching any file. This is your source of truth for event types, schemas, and capture points.
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- The chat route (app/api/chat/route.ts) has complex SSE streaming logic — understand the full message lifecycle before inserting capture hooks. Fire-and-forget only — never block the stream.
- Client components (ChatInterface.tsx) cannot import server-side modules — if capture hooks need to fire from client components, create a thin API route (/api/transit/capture) that accepts POST requests.
- The KERNL database uses better-sqlite3 (synchronous). The capture helper should be synchronous to match — no async needed for SQLite writes.
- nanoid may need to be imported from 'nanoid' — check package.json for the installed version. If not installed, use crypto.randomUUID() instead.
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

FILE LOCATIONS (read these first to understand patterns):
  app/lib/kernl/database.ts           — getDatabase(), runMigrations() pattern
  app/lib/kernl/schema.sql            — existing table definitions
  app/app/api/chat/route.ts           — SSE streaming, message persistence
  app/components/chat/ChatInterface.tsx — stop/regenerate/edit handlers

NEW FILES TO CREATE:
  app/lib/transit/types.ts            — EventMetadata, EventCategory, EventTypeDefinition types
  app/lib/transit/registry.ts         — Event registry with all initial types from spec §2.2
  app/lib/transit/capture.ts          — captureEvent() write helper
  app/app/api/transit/capture/route.ts — Thin POST route for client-side capture hooks
  app/lib/transit/__tests__/capture.test.ts — Tests
  app/lib/transit/__tests__/registry.test.ts — Tests

---

TASK 1: Create conversation_events table

File: app/lib/kernl/database.ts — add to runMigrations() using the existing try/catch idempotent pattern.

SQL:
```sql
CREATE TABLE IF NOT EXISTS conversation_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  payload TEXT NOT NULL DEFAULT '{}',
  schema_version INTEGER NOT NULL DEFAULT 1,
  tags TEXT DEFAULT '[]',
  annotations TEXT DEFAULT '[]',
  learning_status TEXT DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_events_conversation ON conversation_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON conversation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_category ON conversation_events(category);
CREATE INDEX IF NOT EXISTS idx_events_message ON conversation_events(message_id);
```

Add this as a new migration block in runMigrations(). Use the same pattern as existing migrations — db.exec() wrapped in try/catch. The CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS make it idempotent.

---

TASK 2: Add tree columns to messages table

File: app/lib/kernl/database.ts — add to runMigrations(), AFTER the conversation_events table creation.

```typescript
// Transit Map: tree columns for branching support
const treeColumns = [
  'ALTER TABLE messages ADD COLUMN parent_id TEXT DEFAULT NULL',
  'ALTER TABLE messages ADD COLUMN branch_index INTEGER DEFAULT 0',
  'ALTER TABLE messages ADD COLUMN is_active_branch INTEGER DEFAULT 1',
];
for (const sql of treeColumns) {
  try { db.exec(sql); } catch { /* duplicate column — already migrated */ }
}
```

This is the same idempotent ALTER TABLE pattern used elsewhere in the codebase. The try/catch swallows "duplicate column name" errors on re-run.

---

TASK 3: EventMetadata types

New file: app/lib/transit/types.ts

```typescript
/**
 * Transit Map Types — Sprint 11.2
 * Source of truth: TRANSIT_MAP_SPEC.md §2.3
 */

export type EventCategory = 'flow' | 'quality' | 'system' | 'context' | 'cognitive';

export interface EventMetadata {
  id: string;
  event_type: string;
  timestamp: string;
  message_id: string | null;
  conversation_id: string;
  payload: Record<string, unknown>;
  tags: string[];
  annotations: string[];
  learning_status: 'pending' | 'processed' | 'skipped';
  schema_version: number;
  category: EventCategory;
}

export type EventInput = Omit<EventMetadata, 'id' | 'timestamp' | 'schema_version'>;

export interface EventTypeDefinition {
  id: string;
  category: EventCategory;
  name: string;
  description: string;
  learnable: boolean;
  /** Scrollbar landmark config — null means no landmark for this event type */
  scrollbar: {
    enabled: boolean;
    color: string;
    height: number;
    opacity: number;
  } | null;
  /** Marker shape for Z2 subway view */
  marker: {
    shape: MarkerShape;
    size: MarkerSize;
    color: string;
  };
}

export type MarkerShape = 'circle' | 'diamond' | 'square' | 'triangle' | 'hexagon';
export type MarkerSize = 'sm' | 'md' | 'lg';
```

---

TASK 4: Event registry

New file: app/lib/transit/registry.ts

Build the registry from TRANSIT_MAP_SPEC.md §2.2. Include ALL event types listed in the spec:

FLOW: flow.message, flow.topic_shift, flow.branch_fork, flow.branch_merge, flow.session_boundary
QUALITY: quality.interruption, quality.regeneration, quality.edit_resend, quality.long_pause, quality.immediate_followup, quality.copy_event
SYSTEM: system.model_route, system.gate_trigger, system.gate_resolution, system.rate_limit, system.error, system.latency_spike
CONTEXT: context.retrieval, context.ghost_surface, context.ghost_engaged, context.window_pressure, context.window_exceeded
COGNITIVE: cognitive.thinking_block, cognitive.tool_invocation, cognitive.artifact_generated, cognitive.artifact_engagement

Each entry should have: id, category, name, description, learnable, scrollbar config (null for most initially — only topic_shift, interruption, artifact_generated, gate_trigger get scrollbar landmarks), marker config.

Category → marker shape mapping (from spec §3.2):
- flow → circle
- quality → diamond
- system → square
- context → triangle
- cognitive → hexagon

Category → marker color:
- flow → #3b82f6 (blue)
- quality → #ef4444 (red)
- system → #f59e0b (amber)
- context → #8b5cf6 (purple)
- cognitive → #06b6d4 (cyan)

Export functions:
```typescript
export function getEventType(id: string): EventTypeDefinition | undefined
export function getAllEventTypes(): EventTypeDefinition[]
export function getEventTypesByCategory(category: EventCategory): EventTypeDefinition[]
```

Store the registry as a Map<string, EventTypeDefinition> for O(1) lookup.

---

TASK 5: Event capture helper

New file: app/lib/transit/capture.ts

```typescript
import { getDatabase } from '@/lib/kernl/database';
import { getEventType } from './registry';
import type { EventInput, EventCategory } from './types';

/**
 * Capture a Transit Map event. Fire-and-forget — errors are logged, never thrown.
 * Returns the event ID on success, null on failure.
 */
export function captureEvent(event: EventInput): string | null {
  try {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const schema_version = 1;

    // Validate event type exists in registry (warn but don't block)
    const typeDef = getEventType(event.event_type);
    if (!typeDef) {
      console.warn(`[transit] Unknown event type: ${event.event_type} — capturing anyway`);
    }

    const db = getDatabase();
    db.prepare(`
      INSERT INTO conversation_events (id, conversation_id, message_id, event_type, category, timestamp, payload, schema_version, tags, annotations, learning_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      event.conversation_id,
      event.message_id ?? null,
      event.event_type,
      event.category,
      timestamp,
      JSON.stringify(event.payload),
      schema_version,
      JSON.stringify(event.tags ?? []),
      JSON.stringify(event.annotations ?? []),
      event.learning_status ?? 'pending'
    );

    return id;
  } catch (err) {
    console.error('[transit] captureEvent failed:', err);
    return null;
  }
}

/**
 * Query events for a conversation.
 */
export function getEventsForConversation(conversationId: string): Array<Record<string, unknown>> {
  try {
    const db = getDatabase();
    return db.prepare(
      'SELECT * FROM conversation_events WHERE conversation_id = ? ORDER BY timestamp ASC'
    ).all(conversationId) as Array<Record<string, unknown>>;
  } catch (err) {
    console.error('[transit] getEventsForConversation failed:', err);
    return [];
  }
}

/**
 * Query events by type for a conversation.
 */
export function getEventsByType(conversationId: string, eventType: string): Array<Record<string, unknown>> {
  try {
    const db = getDatabase();
    return db.prepare(
      'SELECT * FROM conversation_events WHERE conversation_id = ? AND event_type = ? ORDER BY timestamp ASC'
    ).all(conversationId, eventType) as Array<Record<string, unknown>>;
  } catch (err) {
    console.error('[transit] getEventsByType failed:', err);
    return [];
  }
}
```

IMPORTANT: Use crypto.randomUUID() (available in Node 19+) instead of nanoid to avoid import issues. If crypto.randomUUID is not available in the runtime, fall back to a simple uuid-like generator.

---

TASK 6: Capture hook — flow.message (server-side)

File: app/app/api/chat/route.ts

Find where messages are persisted (look for addMessage, db.prepare INSERT INTO messages, or similar). AFTER the message is written to the database, add:

```typescript
// Transit Map: capture flow.message event (fire-and-forget)
try {
  const { captureEvent } = await import('@/lib/transit/capture');
  captureEvent({
    event_type: 'flow.message',
    category: 'flow',
    conversation_id: threadId, // use whatever variable holds the thread/conversation ID
    message_id: messageId,     // use whatever variable holds the just-persisted message ID
    payload: {
      role: 'assistant',       // or 'user' depending on which message
      token_count: usage?.output_tokens ?? 0,
      model: model ?? 'unknown',
      latency_ms: Date.now() - startTime, // if timing is tracked
    },
    tags: [],
    annotations: [],
    learning_status: 'pending',
  });
} catch { /* fire-and-forget */ }
```

READ THE FULL route.ts before inserting. The SSE streaming pattern means the message may be built incrementally. Find the point where the COMPLETE message is persisted (after streaming finishes), not the start of streaming.

If there are two persistence points (user message + assistant message), capture both with the appropriate role.

---

TASK 7: Capture hooks — quality events (client-side via API route)

Since ChatInterface.tsx is a client component, it cannot import server modules. Create a thin API route:

New file: app/app/api/transit/capture/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { captureEvent } from '@/lib/transit/capture';
import type { EventInput } from '@/lib/transit/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as EventInput;
    
    // Basic validation
    if (!body.event_type || !body.conversation_id || !body.category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const eventId = captureEvent(body);
    return NextResponse.json({ id: eventId });
  } catch (err) {
    console.error('[transit/capture] POST failed:', err);
    return NextResponse.json({ error: 'Capture failed' }, { status: 500 });
  }
}
```

Then add a client-side helper:

New file: app/lib/transit/client.ts

```typescript
/**
 * Client-side event capture — fires POST to /api/transit/capture.
 * Fire-and-forget: errors are logged, never thrown or awaited.
 */
export function captureClientEvent(event: {
  event_type: string;
  category: string;
  conversation_id: string;
  message_id?: string | null;
  payload: Record<string, unknown>;
}): void {
  fetch('/api/transit/capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...event,
      message_id: event.message_id ?? null,
      tags: [],
      annotations: [],
      learning_status: 'pending',
    }),
  }).catch((err) => console.error('[transit] client capture failed:', err));
}
```

Now wire capture hooks into ChatInterface.tsx (or wherever the handlers live):

1. **quality.interruption** — find the stop/abort button handler. After calling abort:
```typescript
captureClientEvent({
  event_type: 'quality.interruption',
  category: 'quality',
  conversation_id: currentThreadId,
  message_id: currentMessageId,
  payload: {
    tokens_generated_before_stop: partialTokenCount,
    time_to_interrupt_ms: Date.now() - streamStartTime,
  },
});
```

2. **quality.regeneration** — find the regenerate handler (Cmd+R path). After triggering regen:
```typescript
captureClientEvent({
  event_type: 'quality.regeneration',
  category: 'quality',
  conversation_id: currentThreadId,
  message_id: originalMessageId,
  payload: { original_message_id: originalMessageId },
});
```

3. **quality.edit_resend** — find the edit-and-resend handler (Cmd+E path). After sending edited message:
```typescript
captureClientEvent({
  event_type: 'quality.edit_resend',
  category: 'quality',
  conversation_id: currentThreadId,
  payload: {
    original_prompt_length: originalContent.length,
    edited_prompt_length: editedContent.length,
  },
});
```

IMPORTANT: Read ChatInterface.tsx carefully to find the actual handler functions and variable names. The examples above use placeholder variable names — use the real ones. If some variables (like partialTokenCount or streamStartTime) don't exist, use reasonable approximations or omit those payload fields.

---

TASK 8: Tests

New file: app/lib/transit/__tests__/capture.test.ts

Test captureEvent():
- Writes event to conversation_events table, returns event ID
- getEventsForConversation returns written events in order
- getEventsByType filters correctly
- Invalid event (missing conversation_id) is caught, returns null
- Unknown event_type still writes (warning logged, not rejected)

New file: app/lib/transit/__tests__/registry.test.ts

Test registry:
- getEventType('flow.message') returns correct definition
- getEventType('nonexistent') returns undefined
- getAllEventTypes() returns all 25+ types
- getEventTypesByCategory('quality') returns only quality events
- Every registered event has valid category, marker config, and id format (category.name)

---

TASK 9: Session end

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing (expect ~10-15 new tests on top of existing ~945)
3. Verify: conversation_events table created in DB
4. Verify: lib/transit/ directory has types.ts, registry.ts, capture.ts, client.ts
5. Verify: /api/transit/capture route exists and accepts POST
6. Update STATUS.md:
   - Sprint 11.2 COMPLETE
   - Note: "Transit Map data foundation shipped. conversation_events table, 25+ event types registered, capture hooks on flow.message + quality.interruption/regeneration/edit_resend"
7. Write SPRINT_11_2_COMPLETE.md:
   - List all files created
   - Event types registered (count)
   - Capture hooks wired (list which events are actively captured)
   - Test count
8. git add -A
9. Write commit message to .git\COMMIT_MSG_TEMP: "feat: Sprint 11.2 — Transit Map data foundation (events table, tree columns, 25+ event types, capture hooks)"
10. git commit -F .git\COMMIT_MSG_TEMP
11. git push

---

QUALITY GATES:
1. conversation_events table exists with all columns from spec §4.1
2. messages table has parent_id, branch_index, is_active_branch columns
3. EventMetadata type matches spec §2.3
4. Registry has all event types from spec §2.2 (25+)
5. captureEvent() writes to DB, returns ID, never throws
6. flow.message captured on every assistant response in chat route
7. quality.interruption captured on stop button
8. quality.regeneration captured on Cmd+R
9. quality.edit_resend captured on Cmd+E
10. /api/transit/capture POST route works for client-side hooks
11. Zero new TypeScript errors
12. All tests pass
13. Capture failures are logged, never crash the app

NON-NEGOTIABLE RULES:
1. Every file you create or edit MUST pass npx tsc --noEmit with 0 errors
2. ALL capture hooks are FIRE-AND-FORGET — never block chat, never await, never throw
3. Do NOT create any UI components — this sprint is pure data infrastructure
4. Use crypto.randomUUID() for event IDs (not nanoid)
5. Use cmd shell (not PowerShell)
6. Wrap all DB migrations in try/catch for idempotent re-runs
7. The registry is a static config — no database reads, no file system reads
8. READ the full chat route.ts and ChatInterface.tsx before inserting hooks — understand the flow first
