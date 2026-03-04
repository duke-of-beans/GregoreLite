GREGLITE SPRINT 11.3 - Transit Map Phase B: Scrollbar Landmarks
First visible Transit Map feature | March 2026

YOUR ROLE: Build the scrollbar landmark system — colored ticks on the scrollbar track that show conversation structure at a glance. This is the first UI surface of the Transit Map. It reads from conversation_events (shipped in Sprint 11.2) and renders landmarks as an overlay on the message list scrollbar. Also add 3 new capture hooks (topic_shift, artifact_generated, gate_trigger). David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\TRANSIT_MAP_SPEC.md — READ §3.4 (Scrollbar Landmarks), §5 (Scrollbar Design) FULLY
4. D:\Projects\GregLite\app\lib\transit\registry.ts — the event registry you'll read from
5. D:\Projects\GregLite\app\lib\transit\types.ts — EventTypeDefinition has scrollbar config
6. D:\Projects\GregLite\app\lib\transit\capture.ts — captureEvent() you'll call from new hooks
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- The scrollbar overlay positioning depends on the scroll container in MessageList.tsx — read the full component before adding the overlay. Position must stay in sync with scroll height.
- Topic shift detection requires comparing embeddings — check if lib/embeddings/ exists. If no embedding infrastructure exists, use a simpler heuristic (e.g., cosine similarity on TF-IDF vectors, or just keyword overlap ratio). Document the approach taken.
- The CustomScrollbar must not interfere with native scrollbar behavior — use pointer-events: none on the landmark layer, with a thin hover hit area for tooltips only.
- Sonnet has failed on the same problem twice → spawn Opus subagent

FILE LOCATIONS (read before modifying):
  app/components/chat/MessageList.tsx     — scroll container to overlay on
  app/lib/transit/registry.ts             — event type scrollbar configs
  app/lib/transit/capture.ts              — captureEvent() for new hooks
  app/lib/artifacts/detector.ts           — artifact detection (hook point for cognitive.artifact_generated)
  app/lib/decision-gate/index.ts          — gate analysis (hook point for system.gate_trigger)

NEW FILES:
  app/components/transit/ScrollbarLandmarks.tsx — the landmark overlay component
  app/lib/transit/topic-detector.ts             — topic shift detection logic
  app/components/transit/__tests__/ScrollbarLandmarks.test.tsx
  app/lib/transit/__tests__/topic-detector.test.ts

---

TASK 1: ScrollbarLandmarks component

New file: app/components/transit/ScrollbarLandmarks.tsx

This component renders as a positioned overlay on the scrollbar track area of the message list.

Props:
- conversationId: string — active thread ID
- messageCount: number — total messages (for position calculation)
- scrollContainerRef: React.RefObject<HTMLElement> — the scroll container

Behavior:
1. Fetch events for the conversation via /api/transit/events GET route (create this)
2. For each event that has scrollbar.enabled = true in the registry, render a thin horizontal line
3. Position: landmark_y = (event_message_index / total_messages) * container_height
4. Color, height, opacity from the event type's scrollbar config in the registry
5. Tooltip on hover showing event type name + timestamp
6. Re-fetch events when messageCount changes (new messages may create new events)

CSS approach:
- position: absolute, right: 0, full height of scroll container
- Width: 12px (overlays the scrollbar area)
- Each landmark is a div with position: absolute, full width, height from config
- pointer-events: none on the container, pointer-events: auto on individual landmarks (for tooltip hover)
- z-index above scroll content but below any modals

New API route: app/app/api/transit/events/route.ts
```typescript
// GET /api/transit/events?conversationId=xxx
// Returns all events for a conversation, with their registry config
import { getEventsForConversation } from '@/lib/transit/capture';
import { getEventType } from '@/lib/transit/registry';

export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversationId');
  if (!conversationId) return NextResponse.json({ events: [] });
  
  const events = getEventsForConversation(conversationId);
  const enriched = events.map(e => ({
    ...e,
    config: getEventType(e.event_type as string),
  }));
  return NextResponse.json({ events: enriched });
}
```

TASK 2: Wire ScrollbarLandmarks into MessageList

File: app/components/chat/MessageList.tsx

1. Import ScrollbarLandmarks
2. Add a ref to the scroll container element (if not already present)
3. Render ScrollbarLandmarks as a sibling positioned relative to the scroll container
4. Pass conversationId (from props or context), messageCount, and scrollContainerRef
5. Wrap in a relative-positioned container so the overlay can position absolutely

The scroll container likely already has overflow-y: auto/scroll. The landmarks overlay sits on top of the scrollbar region.

TASK 3: Topic shift detection

New file: app/lib/transit/topic-detector.ts

```typescript
/**
 * Detects topic shifts between consecutive user messages.
 * Uses keyword overlap as a lightweight heuristic (no embedding model required).
 * Returns similarity score 0-1. Score < threshold = topic shift.
 */
export function detectTopicShift(
  previousMessage: string,
  currentMessage: string,
  threshold: number = 0.4
): { isShift: boolean; similarity: number; inferredTopic: string } {
  // Tokenize both messages (lowercase, split on whitespace/punctuation, remove stopwords)
  // Calculate Jaccard similarity: |intersection| / |union|
  // If similarity < threshold → topic shift detected
  // inferredTopic = first 60 chars of currentMessage
}
```

Implementation approach:
- Tokenize: lowercase, split on /\W+/, filter out common English stopwords (the, a, an, is, are, was, were, etc. — hardcode a set of ~50)
- Jaccard similarity: intersection.size / union.size
- Threshold default 0.4 (tunable — this may need adjustment)
- If either message has < 3 tokens after filtering, return { isShift: false, similarity: 1, inferredTopic: '' } (too short to judge)

TASK 4: Capture hook — flow.topic_shift

File: app/app/api/chat/route.ts (or wherever user messages are processed)

After capturing flow.message for a user message:
1. Look up the previous user message in the same thread
2. Call detectTopicShift(previousContent, currentContent)
3. If isShift: captureEvent with event_type 'flow.topic_shift', payload { similarity_score, inferred_topic_label }

This must be fire-and-forget — wrap in try/catch, don't block the response.

TASK 5: Capture hooks — cognitive + system events

1. cognitive.artifact_generated:
   File: app/lib/artifacts/detector.ts (or wherever artifacts are detected)
   After successful artifact detection, fire:
   ```typescript
   captureEvent({
     event_type: 'cognitive.artifact_generated',
     category: 'cognitive',
     conversation_id: threadId,
     message_id: messageId,
     payload: { artifact_type, language, line_count },
     tags: [], annotations: [], learning_status: 'pending',
   });
   ```

2. system.gate_trigger:
   File: app/lib/decision-gate/index.ts
   After analyze() detects a trigger, fire:
   ```typescript
   captureEvent({
     event_type: 'system.gate_trigger',
     category: 'system',
     conversation_id: threadId,
     message_id: messageId,
     payload: { gate_type, trigger_reason, severity },
     tags: [], annotations: [], learning_status: 'pending',
   });
   ```

Both fire-and-forget. Read each file fully before inserting.

TASK 6: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. New tests:
   - ScrollbarLandmarks renders landmarks for events with scrollbar.enabled
   - ScrollbarLandmarks renders nothing when no events exist
   - Topic detector: similar messages → high similarity, no shift
   - Topic detector: different messages → low similarity, shift detected
   - Topic detector: short messages → no shift (too short to judge)
4. Manual verification note: "Send messages, verify colored ticks appear on scrollbar"
5. Update STATUS.md
6. Write SPRINT_11_3_COMPLETE.md
7. Commit: "feat: Sprint 11.3 — Transit Map scrollbar landmarks + topic shift detection"
8. Push

QUALITY GATES:
1. ScrollbarLandmarks renders colored ticks from conversation_events
2. Landmarks positioned correctly relative to message positions
3. Topic shift detection fires on dissimilar consecutive user messages
4. cognitive.artifact_generated captured on artifact detection
5. system.gate_trigger captured on decision gate trigger
6. All capture hooks are fire-and-forget
7. Scrollbar overlay does not interfere with native scroll behavior
8. tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. All capture hooks fire-and-forget
3. ScrollbarLandmarks must not break existing scroll behavior
4. Use cmd shell (not PowerShell)
5. Read MessageList.tsx FULLY before modifying
6. pointer-events: none on landmark container (except thin hover areas for tooltips)
