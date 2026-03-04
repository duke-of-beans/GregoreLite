# SPRINT 10.6A — EXECUTION BRIEF: Unblock Foundation
# Wave 1: Fix hydration, fix API 500s, lay Transit Map schema
# Prerequisites: None (first brief in chain)
# Gate: Zero console errors on page load. Transit Map table exists.

---

## CONTEXT

You are working on GregLite, a Tauri + Next.js 16 + React 19 + TypeScript desktop app.
Project root: `D:\Projects\GregLite`
App directory: `D:\Projects\GregLite\app`
Dev server: `cd D:\Projects\GregLite\app && pnpm dev` (port 3000)

Read the full sprint blueprint for context: `D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md`
Read the Transit Map spec for Task 3: `D:\Projects\GregLite\TRANSIT_MAP_SPEC.md`

This brief covers Tasks 1, 2, and 14 from the blueprint. All three are independent.

---

## TASK 1 — Fix Hydration Error in ChatSidebar

**File:** `D:\Projects\GregLite\app\components\chat\ChatSidebar.tsx`

**Problem:** `useState(() => localStorage.getItem(...))` causes hydration mismatch because
server renders `collapsed = false` while client may have `'true'` in localStorage.

**Fix:** Replace the localStorage-reading initializer with a `useEffect` that syncs after mount.

Change the state initialization from:
```typescript
const [collapsed, setCollapsed] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
});
```

To:
```typescript
const [collapsed, setCollapsed] = useState(false);
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true');
  setMounted(true);
}, []);
```

Add opacity transition to prevent flash. On the outermost div of BOTH the collapsed and
expanded return blocks, add:
```
style={{ ..., opacity: mounted ? 1 : 0, transition: 'opacity 150ms ease' }}
```

Make sure `mounted` is available in both render paths (collapsed and expanded).

**Gate:** Zero "hydration mismatch" warnings in browser console. Sidebar state matches
localStorage after mount.

---

## TASK 2 — Fix API 500s in Dev Mode

**Problem:** Multiple API routes crash when KERNL SQLite is unavailable or uninitialized.
Routes: `/api/context`, `/api/conversations`, `/api/costs/today`, `/api/settings/thread-tabs`,
`/api/morning-briefing`, `/api/settings`.

**Fix:** In each route handler, wrap the database call in try/catch and return empty defaults.

Pattern to apply to EVERY route listed above:
```typescript
try {
  // existing database call
  const data = existingDbCall();
  return successResponse(data);
} catch (err) {
  console.warn('[api/ROUTE_NAME] DB unavailable:', err);
  return successResponse(/* appropriate empty default */);
}
```

Empty defaults by route:
- `/api/context` → `{ activeProject: null, kernlStatus: 'offline', eosSummary: null, aegisProfile: 'balanced', recentDecisions: [] }`
- `/api/conversations` → `{ conversations: [], total: 0, page: 1, pageSize: 20 }`
- `/api/costs/today` → `{ totalUsd: 0 }`
- `/api/settings/thread-tabs` → `{ tabs: [] }`
- `/api/morning-briefing` → `{ alreadyShown: true }` (suppress briefing if DB unavailable)
- `/api/settings` → `{ settings: {} }`

Find the routes under `D:\Projects\GregLite\app\app\api\`. Check each subdirectory.

**Gate:** `pnpm dev` → open http://localhost:3000 → zero 500 errors in Network tab.
All routes return 200 with empty defaults.

---

## TASK 3 (numbered 14 in blueprint) — Transit Map Data Foundation

**Problem:** Need `conversation_events` table and tree-structure columns on `messages` table
before event capture can begin. Schema must be laid NOW before data accumulates.

### Step 1: Find the KERNL initialization file

Look in `D:\Projects\GregLite\app\lib\kernl\` for the file that creates tables (likely
`index.ts` or `db.ts` or `init.ts`). Find where `CREATE TABLE` statements run.

### Step 2: Add migration SQL

Add these statements to the init/migration function (they're all idempotent):

```sql
-- Transit Map: conversation events table
CREATE TABLE IF NOT EXISTS conversation_events (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id      TEXT,
  event_type      TEXT NOT NULL,
  category        TEXT NOT NULL,
  timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
  payload         TEXT NOT NULL DEFAULT '{}',
  schema_version  INTEGER NOT NULL DEFAULT 1,
  tags            TEXT DEFAULT '[]',
  annotations     TEXT DEFAULT '[]',
  learning_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_events_conversation ON conversation_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON conversation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_category ON conversation_events(category);
CREATE INDEX IF NOT EXISTS idx_events_message ON conversation_events(message_id)
  WHERE message_id IS NOT NULL;
```

For the tree structure columns on `messages`, use a safe ALTER TABLE pattern:
```typescript
// Safe column additions — SQLite ALTER TABLE ADD COLUMN is idempotent-safe if wrapped
const columnsToAdd = [
  { name: 'parent_id', type: 'TEXT DEFAULT NULL' },
  { name: 'branch_index', type: 'INTEGER DEFAULT 0' },
  { name: 'is_active_branch', type: 'INTEGER DEFAULT 1' },
];

for (const col of columnsToAdd) {
  try {
    db.exec(`ALTER TABLE messages ADD COLUMN ${col.name} ${col.type}`);
  } catch (err: unknown) {
    // "duplicate column name" is expected on subsequent runs — ignore
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('duplicate column')) throw err;
  }
}

// Index for tree queries
db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id) WHERE parent_id IS NOT NULL`);
```

### Step 3: Create event capture helper

Create file: `D:\Projects\GregLite\app\lib\events\capture.ts`

```typescript
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
    const { getDb } = require('@/lib/kernl');
    const db = getDb();
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
```

### Step 4: Create event registry config

Create file: `D:\Projects\GregLite\app\lib\events\registry.ts`

```typescript
/**
 * Event Registry — Transit Map §4.3
 *
 * Defines known event types. The renderer reads this registry;
 * it does not hardcode knowledge of specific event types.
 * Adding a new event type = adding an entry here.
 */

export interface EventTypeDefinition {
  id: string;
  category: 'flow' | 'quality' | 'system' | 'context' | 'cognitive';
  name: string;
  learnable: boolean;
  experimental: boolean;
}

export const EVENT_REGISTRY: EventTypeDefinition[] = [
  // Flow events
  { id: 'flow.message', category: 'flow', name: 'Message Exchange', learnable: false, experimental: false },
  { id: 'flow.topic_shift', category: 'flow', name: 'Topic Boundary', learnable: true, experimental: true },
  { id: 'flow.branch_fork', category: 'flow', name: 'Conversation Fork', learnable: true, experimental: false },
  { id: 'flow.session_boundary', category: 'flow', name: 'Session Start/End', learnable: false, experimental: false },

  // Quality events
  { id: 'quality.interruption', category: 'quality', name: 'User Interrupted', learnable: true, experimental: false },
  { id: 'quality.regeneration', category: 'quality', name: 'Response Regenerated', learnable: true, experimental: false },
  { id: 'quality.edit_resend', category: 'quality', name: 'Prompt Edited & Resent', learnable: true, experimental: false },

  // System events
  { id: 'system.model_route', category: 'system', name: 'Model Routing Decision', learnable: true, experimental: true },
  { id: 'system.gate_trigger', category: 'system', name: 'Decision Gate Fired', learnable: true, experimental: false },
  { id: 'system.error', category: 'system', name: 'API or System Error', learnable: false, experimental: false },

  // Context events
  { id: 'context.retrieval', category: 'context', name: 'Context Retrieved', learnable: true, experimental: false },
  { id: 'context.ghost_surface', category: 'context', name: 'Ghost Surfaced', learnable: true, experimental: false },
  { id: 'context.window_pressure', category: 'context', name: 'Context Window Threshold', learnable: true, experimental: true },

  // Cognitive events
  { id: 'cognitive.tool_invocation', category: 'cognitive', name: 'Tool Used', learnable: true, experimental: false },
  { id: 'cognitive.artifact_generated', category: 'cognitive', name: 'Artifact Produced', learnable: true, experimental: false },
];

export function getEventType(id: string): EventTypeDefinition | undefined {
  return EVENT_REGISTRY.find((e) => e.id === id);
}
```

### Step 5: Wire initial capture points

In `D:\Projects\GregLite\app\app\api\chat\route.ts`, after the existing `addMessage()` calls,
add event capture. Import `captureEvent` from `@/lib/events/capture`.

After the user message `addMessage()`:
```typescript
captureEvent({
  conversation_id: threadId,
  message_id: /* the returned message ID */,
  event_type: 'flow.message',
  category: 'flow',
  payload: { role: 'user', content_length: body.message.length },
});
```

After the assistant message `addMessage()`:
```typescript
captureEvent({
  conversation_id: threadId,
  message_id: assistantMsg.id,
  event_type: 'flow.message',
  category: 'flow',
  payload: {
    role: 'assistant',
    content_length: content.length,
    model: response.model,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    latency_ms: latencyMs,
  },
});
```

In `ChatInterface.tsx`, in `handleRegenerate`:
```typescript
captureEvent({
  conversation_id: activeConversationId!,
  event_type: 'quality.regeneration',
  category: 'quality',
  payload: { original_message_index: lastAssistantIdx },
});
```

In `ChatInterface.tsx`, in `handleEditMessage`:
```typescript
captureEvent({
  conversation_id: activeConversationId!,
  event_type: 'quality.edit_resend',
  category: 'quality',
  payload: { original_content_length: msg.content.length, edited_content_length: msg.content.length },
});
```

**Gate:** After KERNL init, verify table exists:
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name='conversation_events';
```
Send a message → check `conversation_events` table has 2 rows (user + assistant flow.message).
Regenerate → check for quality.regeneration row.

---

## FINAL GATES FOR THIS BRIEF

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — 890+ tests passing
3. Browser console: zero hydration warnings
4. Network tab: zero 500 errors on page load
5. `conversation_events` table created and receiving events
6. `messages` table has `parent_id`, `branch_index`, `is_active_branch` columns

## COMMITS

```
fix(ux): fix hydration error in ChatSidebar — defer localStorage to useEffect
fix(api): graceful empty responses for dev mode API routes
feat(telemetry): transit map data foundation — events table, tree columns, capture helper
```
