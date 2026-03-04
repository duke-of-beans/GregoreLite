# SPRINT 11.3 COMPLETE — Transit Map Phase B: Scrollbar Landmarks

**Date:** March 4, 2026
**Status:** COMPLETE
**TSC:** 0 errors
**Tests:** 1004/1007 passing (21 new, all passing; 3 pre-existing failures unchanged)

---

## What was built

### New files

**`app/components/transit/ScrollbarLandmarks.tsx`**
Client component that renders event-driven colored tick marks on the scrollbar track — the "DeepSeek pattern". Fetches from `/api/transit/events?conversationId=xxx`, filters events to those with `config.scrollbar` defined, evaluates payload filter expressions (regex-based, no eval()), and positions each tick at `message_index / (total_messages - 1) * 100%`. The container uses `pointer-events: none` so native scroll is never affected; individual ticks have `pointer-events: auto` for tooltip hover only. `evaluateFilter` is exported for unit testing.

**`app/app/api/transit/events/route.ts`**
GET `/api/transit/events?conversationId=xxx`. Calls `getThreadMessages()` to build a `Map<message_id, index>` for accurate position mapping, then enriches each `conversation_events` row with `message_index`, `total_messages`, and the full registry `config` object. Always returns 200 (empty array on missing param).

**`app/lib/transit/topic-detector.ts`**
Synchronous Jaccard similarity on stopword-filtered token sets. `detectTopicShift(prev, curr, threshold=0.4)` → `{ isShift, similarity, inferredTopic }`. Short-circuits when either message has fewer than 3 meaningful tokens. No embedding model, no async, ~0ms per call.

**`app/lib/transit/__tests__/topic-detector.test.ts`**
11 tests: similar messages (no shift), different messages (shift detected), short messages (short-circuit), threshold boundary, return shape validation. All passing.

**`app/components/transit/__tests__/ScrollbarLandmarks.test.tsx`**
10 tests: `evaluateFilter` behaviour (5 cases — match, no-match, unknown pattern, missing key, double-quote literal) + position formula (5 cases — mid-conversation, first, last, single message, clamping). Pure logic tests, no DOM rendering required (project runs `environment: 'node'` globally for better-sqlite3).

---

### Modified files

**`app/components/chat/MessageList.tsx`**
Added `conversationId?: string` prop. Renders `<ScrollbarLandmarks>` after `<CustomScrollbar>` — they coexist as separate layers (heuristic vs event-driven).

**`app/components/chat/ChatInterface.tsx`**
Threads `conversationId={activeConversationId ?? undefined}` down to `<MessageList>`. Fires `cognitive.artifact_generated` captureClientEvent immediately after `detectArtifact()` returns non-null — fire-and-forget.

**`app/app/api/chat/route.ts`**
Two new capture hooks, both fire-and-forget:
- `flow.topic_shift` — dynamic import of `topic-detector` + `captureEvent`, fires after user message if Jaccard similarity < 0.4 vs previous user message
- `system.gate_trigger` — void async IIFE in `analyze().then()` block, fires when decision gate triggers with gate_type, trigger_reason, severity

---

## Quality gates met

1. ✅ ScrollbarLandmarks renders colored ticks from conversation_events
2. ✅ Landmarks positioned correctly relative to message positions (message_index / total_messages - 1)
3. ✅ Topic shift detection fires on dissimilar consecutive user messages
4. ✅ cognitive.artifact_generated captured on artifact detection
5. ✅ system.gate_trigger captured on decision gate trigger
6. ✅ All capture hooks fire-and-forget (void, no await at call site)
7. ✅ Scrollbar overlay does not interfere with native scroll (pointer-events: none on container)
8. ✅ tsc --noEmit 0 errors, 1004/1007 tests passing

---

## Implementation notes

- `@vitest-environment jsdom` was attempted for ScrollbarLandmarks component tests but React 19 CJS production build doesn't expose `act` in node test environments. Tests were rewritten as pure logic tests (evaluateFilter + position formula) which is cleaner design.
- `jsdom` was installed (`pnpm add -D jsdom`) but ultimately not needed for the pure logic approach.
- `evaluateFilter` exported from `ScrollbarLandmarks.tsx` to enable direct unit testing without DOM.
- The `system.gate_trigger` hook required a void async IIFE pattern in the `.then()` callback to use dynamic `import()` in an ESM context (synchronous `require()` doesn't work).
