# SPRINT 10.6 — Professional Cognitive Interface
**Date:** March 3, 2026
**Phase:** Phase 10.6 — "Make GregLite feel like a professional cognitive tool, not a chatbot."
**Status:** PLANNED
**Estimated effort:** ~4 sprints (14 tasks, dependency-ordered)
**Research basis:** AI Chat Interface UX competitive analysis (March 3, 2026)
**Architectural pre-decisions:** Transit Map event_metadata schema, tree data model for branching

---

## Overview

Sprint 10.5 shipped basic UX polish (sidebar, logo, auto-title, dev API fix). Browser
testing revealed critical gaps: hydration errors, no streaming, demo-grade message density,
no processing indicators, broken auto-scroll, and double-pane sidebar architecture.

Competitive research across ChatGPT, Claude.ai, Gemini, Cursor, Windsurf, Copilot, and Cody
identified the core insight: **every AI chat product was designed for 5-minute casual interactions,
then adopted for 8-hour professional workdays. Nobody redesigned for the second use case.**

This sprint closes that gap. SSE streaming is the foundation. Everything else builds on it.

---

## Dependency Chain

```
Task 1 (Hydration Fix) ──────────────────────────────── standalone, do first
Task 2 (API 500 Fix) ───────────────────────────────── standalone, do first
Task 3 (SSE Streaming) ─────┬──→ Task 7 (Thinking Indicator)
                             ├──→ Task 8 (Collapsible Tool Blocks)
                             └──→ Task 9 (Interruption/Stop Button)
Task 4 (Flat Messages + Density) ───────────────────── standalone
Task 5 (Auto-scroll + Scroll Button) ──→ Task 10 (Scrollbar Landmarks)
Task 6 (Sidebar Consolidation) ─────────────────────── standalone
Task 11 (Cost Precision) ──────────────────────────── standalone
Task 12 (GregLite Branding) ───────────────────────── standalone
Task 13 (System Prompt Tuning) ────────────────────── standalone
Task 14 (Transit Map Data Foundation) ─────────────── architectural pre-decision
```

---

## Task 1 — Fix Hydration Error in ChatSidebar
**Priority:** P0 (console errors on every page load)
**Problem:** ChatSidebar reads `localStorage('greglite-sidebar-collapsed')` during initial
render. Server renders expanded (240px), client may render collapsed (48px). React hydration
mismatch: different DOM structure (sidebar width, button layout, child elements).
**Root cause:** `useState(() => localStorage.getItem(...))` runs during SSR where
`window` is undefined. The `typeof window` guard returns false on server → defaults to
`false` (expanded). Client may have `'true'` stored → collapsed. Mismatch.

**Solution:** Defer localStorage read to `useEffect`. Render server-safe default first,
then sync to localStorage on mount. This is a 1-line pattern change.

```typescript
// BEFORE (hydration mismatch):
const [collapsed, setCollapsed] = useState<boolean>(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
});

// AFTER (hydration-safe):
const [collapsed, setCollapsed] = useState(false); // SSR-safe default
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true');
  setMounted(true);
}, []);
```

Optional: add `mounted` flag to suppress brief flash of expanded→collapsed transition.
Use CSS `opacity: 0` until mounted, then `opacity: 1` with 150ms transition.

**File:** `app/components/chat/ChatSidebar.tsx`
**Gate:** Zero hydration warnings in browser console. Sidebar state matches localStorage on load.

---

## Task 2 — Fix API 500s in Dev Mode
**Priority:** P0 (blocks testing of all features)
**Problem:** Sprint 10.5 Task 1 made `output: 'export'` conditional on production. But API
routes still return 500 because they depend on KERNL SQLite database, which may not be
initialized in dev. Multiple routes fail on page load:
- GET /api/context → ContextPanel fetch
- GET /api/conversations → ChatSidebar fetch
- GET /api/costs/today → StatusBar fetch
- GET /api/settings/thread-tabs → tab layout load
- GET /api/morning-briefing → ChatInterface bootstrap

**Solution:** Each API route needs a try/catch at the DB access layer that returns sensible
empty defaults instead of 500. Not mock data — real empty responses.

```typescript
// Pattern for every API route:
try {
  const data = getThreads(); // KERNL call
  return successResponse(data);
} catch (err) {
  // DB not initialized or missing — return empty, not 500
  console.warn('[api/conversations] DB unavailable:', err);
  return successResponse({ conversations: [], total: 0 });
}
```

Apply to: `/api/context`, `/api/conversations`, `/api/costs/today`, `/api/settings/thread-tabs`,
`/api/morning-briefing`, `/api/settings`. Six routes, same pattern.

**Files:** All routes under `app/app/api/`
**Gate:** `pnpm dev` → page loads with zero 500 errors. All API routes return 200 with empty defaults.

---

## Task 3 — SSE Streaming for Chat Responses
**Priority:** P0 (foundational — Tasks 7, 8, 9 depend on this)
**Problem:** `/api/chat` calls `client.messages.create()` (blocking), waits for full response,
returns single JSON blob. User sees nothing for 5-30 seconds. No ability to interrupt.
Every competitor streams.

**Solution:** Convert to Server-Sent Events using Anthropic's streaming SDK.

**API route changes** (`app/app/api/chat/route.ts`):

```typescript
// Replace client.messages.create() with client.messages.stream()
const stream = client.messages.stream({
  model: 'claude-sonnet-4-5',
  max_tokens: 8096,
  system: body.systemPrompt ?? getBootstrapSystemPrompt(),
  messages: anthropicMessages,
});

// Return SSE response
const encoder = new TextEncoder();
const readableStream = new ReadableStream({
  async start(controller) {
    // Send conversation ID immediately
    controller.enqueue(encoder.encode(
      `data: ${JSON.stringify({ type: 'meta', conversationId: threadId })}\n\n`
    ));

    // Stream text deltas
    stream.on('text', (text) => {
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'text_delta', text })}\n\n`
      ));
    });

    // Stream thinking blocks (extended thinking / interleaved thinking)
    stream.on('contentBlock', (block) => {
      if (block.type === 'thinking') {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'thinking', thinking: block.thinking })}\n\n`
        ));
      }
      if (block.type === 'tool_use') {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'tool_use', name: block.name, input: block.input })}\n\n`
        ));
      }
    });

    // Final message with usage stats
    const finalMessage = await stream.finalMessage();
    const textBlock = finalMessage.content.find((b) => b.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';
    const latencyMs = Date.now() - start;

    // Persist to KERNL (same as before)
    const assistantMsg = addMessage({
      thread_id: threadId,
      role: 'assistant',
      content,
      model: finalMessage.model,
      input_tokens: finalMessage.usage.input_tokens,
      output_tokens: finalMessage.usage.output_tokens,
      latency_ms: latencyMs,
    });

    checkpoint(threadId, assistantMsg.id);

    // Send completion event with usage data
    controller.enqueue(encoder.encode(
      `data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMsg.id,
        model: finalMessage.model,
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        },
        costUsd: 0, // Wire pricing.ts
        latencyMs,
      })}\n\n`
    ));

    controller.close();
  },
});

return new Response(readableStream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});
```

**Client changes** (`app/components/chat/ChatInterface.tsx`):

Replace the fetch+JSON parse in `handleSubmit` with an EventSource consumer:

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: messageText, conversationId }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let fullContent = '';

// Add placeholder assistant message (empty, will be streamed into)
const streamingMessage: MessageProps = {
  role: 'assistant',
  content: '',
  timestamp: new Date(),
  isStreaming: true,
};
appendMessage(tabId, streamingMessage);

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value, { stream: true });
  // Parse SSE lines
  for (const line of chunk.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const event = JSON.parse(line.slice(6));

    if (event.type === 'meta') {
      if (event.conversationId && !conversationId) {
        setTabConversationId(tabId, event.conversationId);
      }
    }
    if (event.type === 'text_delta') {
      fullContent += event.text;
      updateStreamingMessage(tabId, fullContent); // New store action
    }
    if (event.type === 'thinking') {
      // Store for collapsible thinking block (Task 8)
    }
    if (event.type === 'tool_use') {
      // Store for tool invocation display (Task 8)
    }
    if (event.type === 'done') {
      finalizeStreamingMessage(tabId, fullContent, event); // New store action
    }
  }
}
```

**Store changes** (`app/lib/stores/thread-tabs-store.ts`):
- Add `updateStreamingMessage(tabId, content)` — updates last message's content in place
- Add `finalizeStreamingMessage(tabId, content, meta)` — marks streaming complete, adds metadata
- Add `isStreaming` flag to MessageProps type

**MessageProps change:** Add optional `isStreaming?: boolean` to MessageProps interface.

**Markdown rendering during streaming:** Use existing ReactMarkdown + remark-gfm. The key
detail: ReactMarkdown handles partial markdown gracefully for most cases. For code blocks
that arrive mid-stream (opening \`\`\` without closing), wrap in a try/catch and render
as plain text until the block completes. Vercel's Streamdown library is an option if we
hit edge cases, but start with ReactMarkdown and see.

**Fire-and-forget post-processing:** Move artifact detection, decision gate analysis,
embedding, and proactive surfacing into the `done` event handler. They already run
fire-and-forget — just move them from the route to the client's done handler, or keep
them in the route's stream completion callback.

**Files:**
- MODIFY: `app/app/api/chat/route.ts` — SSE streaming
- MODIFY: `app/components/chat/ChatInterface.tsx` — EventSource consumer
- MODIFY: `app/lib/stores/thread-tabs-store.ts` — streaming message actions
- MODIFY: `app/components/chat/Message.tsx` — streaming cursor indicator

**Gate:** Send message → see tokens appear progressively. Usage stats display after completion.
No regressions on KERNL persistence, checkpointing, artifact detection, or auto-title.

---

## Task 4 — Flat Borderless Messages + Density Toggle
**Priority:** P1 (visual identity)
**Problem:** Messages use chat bubble styling: `max-w-[80%]`, `rounded-lg p-4`, visible
borders/backgrounds, `justify-end` for user messages. Over-padded, large font, excessive gaps.
Built for readability demos, not 8-hour work sessions. Every serious competitor uses flat
borderless messages in a centered column.

**Solution:** Kill bubbles. Flat messages. Three density presets.

**Message.tsx changes:**
- Remove `justify-end` / `justify-start` layout — all messages left-aligned in centered column
- Remove `rounded-lg`, `border-l-[3px]`, bubble backgrounds
- User messages: subtle left border (2px cyan) + role label "You"
- Assistant messages: no border, role label "GregLite" or model name badge
- All messages: full width within max-w-3xl centered column

**Density presets** (stored in localStorage, togglable via Cmd+D or settings):

```typescript
type Density = 'compact' | 'comfortable' | 'spacious';

const DENSITY_CONFIG = {
  compact:     { fontSize: '13px', lineHeight: '1.4', gap: '8px',  padding: '6px 0',  roleLabelSize: '10px' },
  comfortable: { fontSize: '14px', lineHeight: '1.5', gap: '12px', padding: '8px 0',  roleLabelSize: '11px' },
  spacious:    { fontSize: '15px', lineHeight: '1.6', gap: '20px', padding: '12px 0', roleLabelSize: '12px' },
} as const;
```

Default to `comfortable`. Keyboard shortcuts: Cmd+Shift+= (denser), Cmd+Shift+- (spacier).
No product in the market offers this. Immediate differentiation.

**CSS variables approach:** Define `--msg-font-size`, `--msg-line-height`, `--msg-gap`,
`--msg-padding` on the message list container. Messages read from these variables.
Density switch changes variables on the container, all messages update instantly.

**Files:**
- MODIFY: `app/components/chat/Message.tsx` — flat layout, density-aware CSS vars
- MODIFY: `app/components/chat/MessageList.tsx` — centered column, gap from density config
- NEW: `app/lib/stores/density-store.ts` — density state + localStorage persistence
- MODIFY: `app/components/chat/ChatInterface.tsx` — keyboard shortcuts for density

**Gate:** Messages render flat, left-aligned, no bubbles. Three density presets work via keyboard.
Density persists across page reloads. Compact mode looks like Slack, spacious like Claude.ai.

---

## Task 5 — Auto-scroll + Floating Scroll-to-Bottom Button
**Priority:** P1 (basic chat UX)
**Problem:** MessageList has a basic `scrollTop = scrollHeight` on message change, but:
(a) no smooth scrolling, (b) no scroll-to-bottom button when scrolled up, (c) auto-scroll
doesn't pause when user scrolls up to read, (d) no new-content indicator while scrolled up.

**Solution:** Proper scroll management with three states.

**States:**
- `isAtBottom` — user is within 100px of bottom → auto-scroll active
- `isScrolledUp` — user has scrolled up → auto-scroll paused, show float button
- `hasNewContent` — new content arrived while scrolled up → pulse the float button

**Implementation:**
- Use `IntersectionObserver` on a sentinel `<div>` at the bottom of the message list
- When sentinel is visible: `isAtBottom = true`, auto-scroll on new content
- When sentinel is not visible: `isAtBottom = false`, show floating button
- Floating button: fixed position at bottom-center of message list area, circular,
  down-arrow icon, subtle shadow. Pulse animation (scale 1.0→1.05→1.0) when `hasNewContent`
- Click button: `scrollIntoView({ behavior: 'smooth', block: 'end' })` on sentinel
- During SSE streaming: auto-scroll follows content if `isAtBottom`, pauses if scrolled up

**Auto-scroll toggle setting:** Add to density store or settings: `autoScrollEnabled` boolean.
Default true. Cursor is the only product with this toggle — we match it.

**Files:**
- MODIFY: `app/components/chat/MessageList.tsx` — IntersectionObserver, sentinel, scroll logic
- NEW: `app/components/chat/ScrollToBottom.tsx` — floating button component
- MODIFY: `app/lib/stores/density-store.ts` — add autoScroll setting

**Gate:** New messages auto-scroll when at bottom. Scrolling up pauses auto-scroll. Float button
appears with pulse. Click scrolls to bottom. During streaming, follows if at bottom, pauses if not.

---

## Task 6 — Sidebar Architecture Consolidation
**Priority:** P1 (layout)
**Problem:** ChatSidebar (left 240px) + ChatInterface content = double-pane when the
ContextPanel (right) already has sections for Active Projects, Recent Decisions, Quality.
Awkward double-pane layout where a sidebar opens from another sidebar.

**Solution:** Move "Recent Chats" into the Context Panel as a collapsible section.
Kill ChatSidebar as a standalone left pane. The Context Panel becomes the single right
panel housing all contextual information including conversation history.

**Changes:**
1. Add `RecentChats` section to ContextPanel — collapsible, shows last 10 conversations,
   click to load thread (reuse `handleLoadThread`). Section header: "Recent Chats" with
   a "See all" link that opens the full ChatHistoryPanel (Cmd+[).
2. Remove `<ChatSidebar>` from ChatInterface layout.
3. Chat content area expands to full width (minus Context Panel when open).
4. Context Panel toggle moves to a small caret at the right edge (or stays in header).

**Alternative considered:** Make ChatSidebar the primary left sidebar and move ContextPanel
content into it. Rejected because Context Panel has more sections (5+) that benefit from
a wider panel, and conversation history is just one section.

**Files:**
- MODIFY: `app/components/context/ContextPanel.tsx` — add RecentChats section
- MODIFY: `app/components/chat/ChatInterface.tsx` — remove ChatSidebar import/rendering
- NEW: `app/components/context/RecentChats.tsx` — conversation list for context panel

**Gate:** ChatSidebar removed from layout. Context Panel shows Recent Chats section.
Click loads thread. Chat content area uses full width. No regression on existing
Context Panel sections.

---

## Task 7 — Thinking/Processing Indicator
**Priority:** P1 (depends on Task 3 SSE)
**Problem:** No feedback during API call. User sees empty space for 5-30 seconds.

**Solution:** Tiered processing display that adapts to what's happening in the stream.

**Tier 1 — Basic thinking (no stream events yet):**
After sending message, before first SSE event arrives, show animated "thinking..." indicator
below the user's message. Three-dot pulse animation. Disappears when first text_delta arrives.

**Tier 2 — Streaming text:**
Replace thinking indicator with the streaming message (cursor blinking at end of text).
Cursor is a subtle `|` character that blinks via CSS animation, appended after the last
character of the streaming content. Removed when stream completes.

**Tier 3 — Tool use / extended thinking (from SSE events):**
When `type: 'thinking'` or `type: 'tool_use'` events arrive, show a collapsible status
line above the streaming text:
- Thinking: `🧠 Thinking... (Xs)` with elapsed timer
- Tool use: `🔧 Using [tool_name]...` with tool name from event

These status lines stack and auto-collapse when the next text_delta arrives.
Expandable on click to show details.

**Files:**
- NEW: `app/components/chat/ThinkingIndicator.tsx` — animated three-dot component
- NEW: `app/components/chat/StreamingCursor.tsx` — blinking cursor for streaming text
- NEW: `app/components/chat/ProcessingStatus.tsx` — tool/thinking status line
- MODIFY: `app/components/chat/MessageList.tsx` — render indicators based on streaming state
- MODIFY: `app/components/chat/Message.tsx` — append cursor when isStreaming

**Gate:** Thinking dots appear immediately on send. Text streams in with cursor. Tool use
shows status line. All indicators disappear cleanly on completion.

---

## Task 8 — Collapsible Tool & Thinking Blocks
**Priority:** P2 (depends on Task 3 SSE)
**Problem:** When Greg uses tools or extended thinking, the raw output clutters the message.
Power users want to see it; casual viewing should hide it.

**Solution:** Wrap tool-use and thinking sections in collapsible accordions within the message.

**Display pattern (matches Claude.ai's approach):**
- Thinking blocks: collapsed by default, show "Thought for Xs" header, expand to show
  bullet-pointed reasoning summary
- Tool use blocks: collapsed by default, show "Used [tool_name]" header with
  success/failure badge, expand to show input/output
- Multiple blocks stack vertically between text sections

**Data flow:** SSE events (Task 3) populate a `blocks` array on the message:
```typescript
interface MessageBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  content: string;
  metadata?: Record<string, unknown>; // tool name, duration, success, etc.
}
```

Message.tsx renders blocks sequentially. Text blocks render as markdown. Thinking and
tool blocks render as collapsible accordions.

**Files:**
- NEW: `app/components/chat/CollapsibleBlock.tsx` — generic accordion for thinking/tool blocks
- MODIFY: `app/components/chat/Message.tsx` — render block array instead of single content string
- MODIFY: `app/lib/stores/thread-tabs-store.ts` — MessageProps gets optional `blocks` array

**Gate:** Tool use blocks render collapsed with summary. Click expands to show detail.
Thinking blocks show elapsed time. Multiple blocks in one message stack correctly.

---

## Task 9 — Stop/Interrupt Button During Streaming
**Priority:** P1 (depends on Task 3 SSE)
**Problem:** No way to stop a response mid-generation. Critical for power users who see
a response going in the wrong direction and want to redirect.

**Solution:** Replace Send button with Stop button during streaming. Abort the SSE stream.

**Implementation:**
- Store an `AbortController` ref in ChatInterface
- Pass `signal` to the fetch call in handleSubmit
- During streaming (`isStreaming` state), SendButton shows as red Stop icon
- Click Stop: `abortController.abort()` → stream closes → finalize with partial content
- Partial content is kept in the message (not discarded) — user can see what Greg said so far

**Event capture:** When user stops, emit a `quality.interruption` event (Transit Map §2.2):
```typescript
captureEvent({
  event_type: 'quality.interruption',
  payload: {
    partial_content_length: fullContent.length,
    tokens_generated_before_stop: estimatedTokens,
    time_to_interrupt_ms: Date.now() - streamStartTime,
  },
});
```

This is the first Transit Map capture point — sets the pattern for all future event capture.

**Files:**
- MODIFY: `app/components/chat/ChatInterface.tsx` — AbortController, stop handler
- MODIFY: `app/components/chat/SendButton.tsx` — stop state (red square icon)
- MODIFY: `app/lib/stores/thread-tabs-store.ts` — handle partial finalization

**Gate:** Stop button appears during streaming. Click aborts stream. Partial content preserved.
Send button returns to normal after stop. Event captured (if Transit Map table exists).

---

## Task 10 — Scrollbar Landmarks (DeepSeek Pattern)
**Priority:** P2 (depends on Task 5 scroll infrastructure)
**Problem:** Long conversations are featureless scroll — no visual indication of where
topic shifts, code blocks, or important moments are.

**Solution:** Colored tick marks on the scrollbar track showing conversation landmarks.

**Initial landmark types** (from Transit Map spec §3.4):
- User messages: subtle 1px frost ticks (show conversation density)
- Code blocks / artifacts: 2px teal ticks
- Topic shifts: 3px cyan ticks (Phase B — requires embedding comparison, STUB for now)
- Interruptions: 3px red ticks (wired in Task 9)

**Implementation:**
- `CustomScrollbar.tsx` — overlay positioned on the scrollbar track
- Reads message array, identifies landmark types by content analysis (code fence regex,
  message role, streaming interruption flag)
- Renders `position: absolute` lines with `pointer-events: none`
- Landmark position: `(messageIndex / totalMessages) * scrollbarHeight`
- Hover hit area (8px wide) shows tooltip with landmark type

**Performance:** For <200 messages, render all landmarks. For >200, cluster into density bands.

**Files:**
- NEW: `app/components/chat/CustomScrollbar.tsx` — landmark overlay
- MODIFY: `app/components/chat/MessageList.tsx` — wrap scroll container with CustomScrollbar

**Gate:** Scrollbar shows colored ticks at code blocks, user messages, and interruption points.
Hover shows tooltip. No interference with native scroll behavior.

---

## Task 11 — Cost Display Precision (4 Decimal Places)
**Priority:** P1 (quick win)
**Problem:** StatusBar shows `$0.02` when real cost is `$0.0247`. Hides granularity that
power users need. Per-message costs invisible.

**Solution:** Two changes.

**StatusBar:** Change `costToday.toFixed(2)` to `costToday.toFixed(4)`.

**Per-message cost annotation:** After streaming completes (Task 3 `done` event),
show a subtle inline annotation on the assistant message:

```
GregLite · sonnet · 1,247 tokens · $0.0031 · 2.4s
```

This metadata line appears below the message content in `var(--mist)` at 10px.
Data comes from the SSE `done` event payload (model, usage, cost, latency).

**Files:**
- MODIFY: `app/components/ui/StatusBar.tsx` — `.toFixed(4)`
- MODIFY: `app/components/chat/Message.tsx` — per-message metadata line
- MODIFY: MessageProps type — add optional `model`, `tokens`, `costUsd`, `latencyMs`

**Gate:** StatusBar shows 4 decimal places. Each assistant message shows model/tokens/cost/latency.

---

## Task 12 — GregLite Branding Consistency
**Priority:** P2 (quick win)
**Problem:** Mixed branding: "Gregore Lite" in some places, "GREGORE" in others.
Decision from this session: "GregLite" for daily use (one word, camelCase in code,
title case in UI). "Gregore Lite" reserved for formal docs/about screens.

**Solution:** Find-and-replace across UI-facing strings.

**Changes:**
- Header.tsx: "Gregore Lite" → "GregLite"
- layout.tsx metadata: title "Gregore Lite" → "GregLite"
- MessageList empty state: "GREGORE" → "GregLite"
- StatusBar or any other UI string referencing the old name

Do NOT change: PROJECT_DNA.yaml identity section, README formal references, or
git commit history. Only user-facing UI strings.

**Files:**
- MODIFY: `app/components/ui/Header.tsx`
- MODIFY: `app/app/layout.tsx`
- MODIFY: `app/components/chat/MessageList.tsx`
- GREP: `grep -r "Gregore Lite\|GREGORE" app/components/ app/app/` for any others

**Gate:** All UI-visible text says "GregLite". No references to "Gregore Lite" or "GREGORE"
in component render output.

---

## Task 13 — System Prompt Tuning (Anti-Bootstrap)
**Priority:** P2 (quality of life)
**Problem:** User typed "you there" → GregLite auto-executed full bootstrap sequence
(read CLAUDE_INSTRUCTIONS.md, TECHNICAL_STANDARDS.md, etc.). This is because the system
prompt includes bootstrap instructions that trigger on any input. Not a UI bug — it's a
prompt engineering issue.

**Solution:** Adjust the default system prompt returned by `getBootstrapSystemPrompt()`.

Add an instruction like:
```
You are GregLite, a cognitive operating system for a power user.
Respond conversationally to casual messages (greetings, short questions).
Do NOT auto-execute bootstrap sequences, file reads, or environment detection
unless the user explicitly requests work on a specific project or codebase.
If the user says "hey" or "you there", just respond naturally.
```

This is a prompt-only change. The system prompt assembly in `lib/bootstrap/index.ts`
gets a preamble that distinguishes casual from work messages.

**Files:**
- MODIFY: `app/lib/bootstrap/index.ts` — adjust system prompt preamble

**Gate:** Sending "hey" or "you there" gets a conversational response, not a bootstrap execution.

---

## Task 14 — Transit Map Data Foundation (Architectural Pre-Decision)
**Priority:** P1 (schema must be right before data accumulates)
**Problem:** The Transit Map (TRANSIT_MAP_SPEC.md) requires two schema additions that must
be in place before we start capturing events. If we ship SSE streaming (Task 3) and
interruption capture (Task 9) without the schema, we'll lose telemetry data.

**Solution:** Create the database schema and event capture helpers. No visualization yet —
data only.

**Schema additions** (from TRANSIT_MAP_SPEC.md §4.1 and §4.2):

```sql
-- conversation_events table
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

-- Tree structure columns on messages table
ALTER TABLE messages ADD COLUMN parent_id TEXT DEFAULT NULL;
ALTER TABLE messages ADD COLUMN branch_index INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN is_active_branch INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id)
  WHERE parent_id IS NOT NULL;
```

**Event capture helper** (`app/lib/events/capture.ts`):

```typescript
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/kernl';

export interface CaptureEventInput {
  conversation_id: string;
  message_id?: string;
  event_type: string;
  category: 'flow' | 'quality' | 'system' | 'context' | 'cognitive';
  payload?: Record<string, unknown>;
}

export function captureEvent(input: CaptureEventInput): void {
  try {
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
    // Non-blocking — telemetry loss is acceptable, chat must not break
    console.warn('[events] capture failed:', err);
  }
}
```

**Event registry config** (`app/lib/events/registry.ts`): Load from
`app/config/event-registry.yaml` at startup. Initial types: `flow.message`,
`quality.interruption`, `quality.regeneration`, `quality.edit_resend`.

**Initial capture points** (wired in Tasks 3 and 9):
- `flow.message` — in chat route, after addMessage() for each user and assistant message
- `quality.interruption` — in Task 9 stop handler
- `quality.regeneration` — in ChatInterface.handleRegenerate (already exists)
- `quality.edit_resend` — in ChatInterface.handleEditMessage (already exists)

**Migration:** Run schema additions in KERNL's init function. `ALTER TABLE` with
`ADD COLUMN` is safe on existing databases (SQLite adds columns to existing rows as NULL).
`CREATE TABLE IF NOT EXISTS` is idempotent.

**Files:**
- MODIFY: `app/lib/kernl/index.ts` — add migration for new table + columns
- NEW: `app/lib/events/capture.ts` — event capture helper
- NEW: `app/lib/events/registry.ts` — event type registry
- NEW: `app/config/event-registry.yaml` — initial event types
- MODIFY: `app/app/api/chat/route.ts` — capture `flow.message` events
- MODIFY: `app/components/chat/ChatInterface.tsx` — capture regen/edit events

**Gate:** `conversation_events` table exists after KERNL init. Sending a message creates
a `flow.message` event row. Regenerating creates a `quality.regeneration` event row.
`messages` table has `parent_id`, `branch_index`, `is_active_branch` columns (unused but present).

---

## Cross-Cutting Concerns

- **TSC clean** after every task — `npx tsc --noEmit` must pass
- **No test regressions** — `pnpm test:run` must stay at 890+
- **Conventional commits** — one commit per task:
  - `fix(ux): fix hydration error in ChatSidebar`
  - `fix(api): graceful empty responses for dev mode`
  - `feat(chat): SSE streaming for chat responses`
  - `feat(ux): flat messages with density toggle`
  - `feat(ux): auto-scroll with floating scroll-to-bottom`
  - `refactor(layout): consolidate sidebar into context panel`
  - `feat(ux): thinking and processing indicators`
  - `feat(ux): collapsible tool and thinking blocks`
  - `feat(chat): stop/interrupt button during streaming`
  - `feat(ux): scrollbar landmarks`
  - `feat(ux): cost display 4 decimal places + per-message metadata`
  - `fix(brand): GregLite branding consistency`
  - `fix(prompt): anti-bootstrap system prompt tuning`
  - `feat(telemetry): transit map data foundation + event capture`
- **STATUS.md** — update after all tasks complete, close Sprint 10.6

---

## Files Summary

| Task | New Files | Modified Files |
|------|-----------|----------------|
| 1 | — | ChatSidebar.tsx |
| 2 | — | 6 API routes |
| 3 | — | chat/route.ts, ChatInterface.tsx, thread-tabs-store.ts, Message.tsx |
| 4 | density-store.ts | Message.tsx, MessageList.tsx, ChatInterface.tsx |
| 5 | ScrollToBottom.tsx | MessageList.tsx, density-store.ts |
| 6 | RecentChats.tsx | ContextPanel.tsx, ChatInterface.tsx |
| 7 | ThinkingIndicator.tsx, StreamingCursor.tsx, ProcessingStatus.tsx | MessageList.tsx, Message.tsx |
| 8 | CollapsibleBlock.tsx | Message.tsx, thread-tabs-store.ts |
| 9 | — | ChatInterface.tsx, SendButton.tsx, thread-tabs-store.ts |
| 10 | CustomScrollbar.tsx | MessageList.tsx |
| 11 | — | StatusBar.tsx, Message.tsx |
| 12 | — | Header.tsx, layout.tsx, MessageList.tsx |
| 13 | — | lib/bootstrap/index.ts |
| 14 | events/capture.ts, events/registry.ts, config/event-registry.yaml | kernl/index.ts, chat/route.ts, ChatInterface.tsx |

**Total: 8 new files, ~20 modified files across 14 tasks.**

---

## Execution Order (Recommended)

**Wave 1 — Unblock everything (Tasks 1, 2, 14):**
Fix hydration, fix API 500s, lay Transit Map schema. These are independent and unblock testing.

**Wave 2 — Foundation (Task 3):**
SSE streaming. This is the longest single task and gates 3 others.

**Wave 3 — Quick wins in parallel (Tasks 4, 6, 11, 12, 13):**
Flat messages, sidebar consolidation, cost precision, branding, prompt tuning. All independent.

**Wave 4 — Stream-dependent (Tasks 5, 7, 8, 9):**
Auto-scroll, thinking indicator, collapsible blocks, stop button. All depend on streaming.

**Wave 5 — Polish (Task 10):**
Scrollbar landmarks. Depends on scroll infrastructure from Task 5.

---

## GregLite Feature Backlog Updates

After this sprint ships, add to FEATURE_BACKLOG.md under Phase 10.6:

```
27. **Fix hydration error in ChatSidebar** [P0] — DONE (Sprint 10.6 Task 1)
28. **Fix API 500s in dev mode** [P0] — DONE (Sprint 10.6 Task 2)
29. **SSE streaming for chat responses** [P0] — DONE (Sprint 10.6 Task 3)
30. **Flat borderless messages + density toggle** [P1] — DONE (Sprint 10.6 Task 4)
31. **Auto-scroll + floating scroll-to-bottom** [P1] — DONE (Sprint 10.6 Task 5)
32. **Sidebar consolidation into context panel** [P1] — DONE (Sprint 10.6 Task 6)
33. **Thinking/processing indicator** [P1] — DONE (Sprint 10.6 Task 7)
34. **Collapsible tool & thinking blocks** [P2] — DONE (Sprint 10.6 Task 8)
35. **Stop/interrupt button** [P1] — DONE (Sprint 10.6 Task 9)
36. **Scrollbar landmarks** [P2] — DONE (Sprint 10.6 Task 10)
37. **Cost display 4 decimal places + per-message** [P1] — DONE (Sprint 10.6 Task 11)
38. **GregLite branding consistency** [P2] — DONE (Sprint 10.6 Task 12)
39. **Anti-bootstrap system prompt** [P2] — DONE (Sprint 10.6 Task 13)
40. **Transit Map data foundation** [P1] — DONE (Sprint 10.6 Task 14)
```

Items deferred to future sprints (added to backlog):
```
41. **Scrollbar landmarks: topic shift detection** [P2] — Requires embedding comparison pipeline
42. **Cross-project context bridge (@-mention)** [P1] — EPIC-77 in Gregore, design needed
43. **Conversation branching (tree navigation)** [P2] — Schema ready (Task 14), UI is Transit Map Phase D
44. **Transit Map Z2 Subway visualization** [P2] — Transit Map Phase D
45. **Transit Map Z1 Sankey visualization** [P3] — Transit Map Phase E
46. **Transit Map learning engine** [P3] — Transit Map Phase F
47. **Desktop notifications for long-running completions** [P2] — Tray bridge exists, needs completion event
48. **Keyboard density shortcuts (Ctrl+=/Ctrl+-)** [P2] — Density store exists from Task 4
49. **Context window token counter in StatusBar** [P2] — Requires token counting on message history
```
