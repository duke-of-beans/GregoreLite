# SPRINT 1C — Continuity Checkpointing
## GregLite Phase 1 | Session 3 of 5 (Sequential)
**Status:** READY TO QUEUE (after 1B gates pass)  
**Depends on:** Sprint 1B complete (KERNL module exists)  
**Blocks:** Sprint 1D

---

## OBJECTIVE

Every Claude response writes a checkpoint diff to SQLite. App crash → restart → conversation fully intact. This is the crash survivability guarantee from BLUEPRINT_FINAL.md §2.2.

**Success criteria:**
- Every assistant response triggers a checkpoint write (not every N turns — every response)
- Checkpoint is a diff, not a full dump
- On app restart, last active session is restored into UI state
- Conversation visible in UI after restart without user action
- Checkpoint write completes in <50ms (non-blocking to UI)

---

## NEW FILES TO CREATE

```
app/lib/continuity/
  index.ts          — public API
  checkpoint.ts     — diff writer, restore logic
  diff.ts           — compute minimal diff between conversation states
  types.ts          — Checkpoint, ConversationDiff interfaces
```

---

## IMPLEMENTATION

### Checkpoint diff format

```typescript
interface ConversationDiff {
  threadId: string;
  timestamp: number;
  addedMessages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    tokens?: number;
  }>;
  updatedMetadata?: {
    lastActive: number;
    contextHash?: string;
  };
}
```

Checkpoint is append-only. On restore, replay all diffs in order to reconstruct conversation state. This means crash at any point loses at most one in-flight response.

### Checkpoint table (add to KERNL schema in 1B)

```sql
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  diff_json TEXT NOT NULL,
  written_at INTEGER NOT NULL,
  FOREIGN KEY(thread_id) REFERENCES threads(id)
);
CREATE INDEX idx_checkpoints_thread ON checkpoints(thread_id, written_at);
```

### Public API

```typescript
export interface ContinuityModule {
  // Called after every assistant response
  checkpoint(threadId: string, diff: ConversationDiff): Promise<void>;
  
  // Called on app boot — returns null if no active session
  restore(threadId: string): Promise<RestoredConversation | null>;
  
  // Returns thread ID of last active session (for auto-restore on boot)
  getLastActiveThread(): Promise<string | null>;
}

export interface RestoredConversation {
  threadId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  lastActive: number;
}
```

### Wire into chat route

After sprint 1B wired KERNL into the chat route, add continuity checkpoint call:

```typescript
// After message appended to KERNL:
await continuity.checkpoint(threadId, {
  threadId,
  timestamp: Date.now(),
  addedMessages: [
    { id: userMsgId, role: 'user', content: body.message },
    { id: assistantMsgId, role: 'assistant', content, tokens: totalTokens }
  ]
});
```

### Wire into app boot (page.tsx or layout.tsx)

```typescript
// On mount:
const lastThread = await continuity.getLastActiveThread();
if (lastThread) {
  const restored = await continuity.restore(lastThread);
  if (restored) {
    setMessages(restored.messages);
  }
}
```

---

## GATES

- [ ] Checkpoint written after every assistant response (check DB directly)
- [ ] Kill `pnpm dev` mid-conversation, restart → messages still visible
- [ ] Checkpoint write time <50ms (log it)
- [ ] pnpm type-check clean
- [ ] Commit: `sprint-1c: continuity checkpointing, crash recovery`
