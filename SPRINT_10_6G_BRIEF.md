# SPRINT 10.6G — EXECUTION BRIEF: Scrollbar Landmarks + Final Gates
# Wave 5: DeepSeek-inspired scroll position markers + sprint finalization
# Prerequisites: All previous briefs (A-F) complete
# Gate: Colored ticks on scrollbar. All 14 tasks verified. STATUS.md updated.

---

## CONTEXT

Project root: `D:\Projects\GregLite`, App: `D:\Projects\GregLite\app`
Blueprint: `D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md` (Task 10)
Transit Map Spec: `D:\Projects\GregLite\TRANSIT_MAP_SPEC.md` (§5)

---

## TASK 1 — Scrollbar Landmarks (Blueprint Task 10)

### Create CustomScrollbar component

Create: `D:\Projects\GregLite\app\components\chat\CustomScrollbar.tsx`

```typescript
/**
 * CustomScrollbar — Sprint 10.6
 *
 * Renders colored tick marks overlaid on the scrollbar track to show
 * conversation landmarks: code blocks, user messages, interruptions.
 * From Transit Map spec §3.4 (DeepSeek scroll landmarks pattern).
 *
 * Positioned absolutely within the scroll container. Reads message array
 * to detect landmark types. pointer-events: none ensures no scroll interference.
 */

'use client';

import { useMemo } from 'react';
import type { MessageProps } from './Message';

interface Landmark {
  position: number;   // 0-1 fraction through the conversation
  color: string;
  height: number;     // px
  opacity: number;
  tooltip: string;
}

interface CustomScrollbarProps {
  messages: MessageProps[];
  containerHeight: number;
}

// Detect if a message contains code blocks
function hasCodeBlock(content: string): boolean {
  return /```[\s\S]*?```/.test(content);
}

export function CustomScrollbar({ messages, containerHeight }: CustomScrollbarProps) {
  const landmarks = useMemo(() => {
    if (messages.length === 0) return [];

    const result: Landmark[] = [];
    const total = messages.length;

    for (let i = 0; i < total; i++) {
      const msg = messages[i]!;
      const position = total === 1 ? 0.5 : i / (total - 1);

      // User messages — subtle density ticks
      if (msg.role === 'user') {
        result.push({
          position,
          color: 'var(--frost)',
          height: 1,
          opacity: 0.15,
          tooltip: 'User message',
        });
      }

      // Code blocks in assistant messages
      if (msg.role === 'assistant' && hasCodeBlock(msg.content)) {
        result.push({
          position,
          color: 'var(--teal-400, #2dd4bf)',
          height: 2,
          opacity: 0.5,
          tooltip: 'Code block',
        });
      }

      // Interrupted messages (streaming was stopped)
      if (msg.role === 'assistant' && msg.content.startsWith('Error:')) {
        result.push({
          position,
          color: 'var(--red-400, #f87171)',
          height: 3,
          opacity: 0.7,
          tooltip: 'Error or interruption',
        });
      }

      // Long assistant messages (potential landmarks)
      if (msg.role === 'assistant' && msg.content.length > 2000) {
        result.push({
          position,
          color: 'var(--cyan)',
          height: 2,
          opacity: 0.3,
          tooltip: 'Detailed response',
        });
      }
    }

    return result;
  }, [messages]);

  if (landmarks.length === 0 || containerHeight <= 0) return null;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-2 pointer-events-none z-10"
      aria-hidden
    >
      {landmarks.map((lm, i) => (
        <div
          key={i}
          className="absolute right-0"
          style={{
            top: `${lm.position * 100}%`,
            width: '100%',
            height: `${lm.height}px`,
            backgroundColor: lm.color,
            opacity: lm.opacity,
            borderRadius: '1px',
          }}
          title={lm.tooltip}
        />
      ))}
    </div>
  );
}
```

### Wire into MessageList.tsx

Read: `D:\Projects\GregLite\app\components\chat\MessageList.tsx`

Import `CustomScrollbar` and add it inside the scroll container:

```typescript
import { CustomScrollbar } from './CustomScrollbar';

// Add ref for container height
const [containerHeight, setContainerHeight] = useState(0);

useEffect(() => {
  if (scrollRef.current) {
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) setContainerHeight(entry.contentRect.height);
    });
    resizeObserver.observe(scrollRef.current);
    return () => resizeObserver.disconnect();
  }
}, []);
```

In the JSX, add the CustomScrollbar inside the scroll container:

```typescript
<div ref={scrollRef} className="relative flex-1 overflow-y-auto px-6 py-4" ...>
  {/* Scrollbar landmarks */}
  <CustomScrollbar messages={messages} containerHeight={containerHeight} />

  {/* ... existing content ... */}
</div>
```

---

## TASK 2 — Sprint Finalization

### Run full verification

1. `cd D:\Projects\GregLite\app`
2. `npx tsc --noEmit` — must be zero errors
3. `pnpm test:run` — must be 890+ passing (fix any broken tests)
4. `pnpm dev` — open browser, verify ALL of these:

**Checklist:**
- [ ] No hydration warnings in console (Brief A, Task 1)
- [ ] No 500 errors on page load (Brief A, Task 2)
- [ ] Messages stream progressively (Brief B)
- [ ] Thinking dots appear before first token (Brief E)
- [ ] Streaming cursor blinks during response (Brief E)
- [ ] Thinking/tool blocks collapse with summary (Brief E)
- [ ] Messages are flat, no bubbles, centered column (Brief C)
- [ ] Three density presets work (Cmd+Shift+= / Cmd+Shift+-) (Brief C)
- [ ] Density persists on reload (Brief C)
- [ ] StatusBar shows 4 decimal places for cost (Brief C)
- [ ] Per-message metadata shows model/tokens/cost/latency (Brief C)
- [ ] All UI text says "GregLite" (Brief C)
- [ ] "hey" gets conversational response (Brief C)
- [ ] No left sidebar — Recent Chats in Context Panel (Brief D)
- [ ] Click conversation in Recent Chats loads thread (Brief D)
- [ ] Auto-scroll follows at bottom, pauses when scrolled up (Brief F)
- [ ] Floating scroll button appears with bounce (Brief F)
- [ ] Stop button appears during streaming, aborts cleanly (Brief F)
- [ ] Partial content preserved on stop (Brief F)
- [ ] Colored ticks visible on scrollbar (this brief)
- [ ] `conversation_events` table exists and receives events (Brief A, Task 3)
- [ ] `messages` table has `parent_id`, `branch_index`, `is_active_branch` columns (Brief A, Task 3)

### Update STATUS.md

Read: `D:\Projects\GregLite\STATUS.md`

Add Sprint 10.6 completion entry at the top of the active section:

```markdown
- [x] **SPRINT 10.6** — Professional Cognitive Interface — **COMPLETE**
  - SSE streaming for progressive token rendering
  - Flat borderless messages with 3-tier density toggle (compact/comfortable/spacious)
  - Smart auto-scroll with floating scroll-to-bottom button
  - Thinking/processing indicators (dots → cursor → status lines)
  - Collapsible tool and thinking blocks in messages
  - Stop/interrupt button with partial content preservation
  - Scrollbar landmarks (DeepSeek pattern)
  - Sidebar consolidated into Context Panel
  - Cost display 4 decimal places + per-message metadata
  - GregLite branding consistency
  - Anti-bootstrap system prompt tuning
  - Transit Map data foundation (events table, tree columns, capture helper)
  - Fix: ChatSidebar hydration error
  - Fix: API 500s in dev mode
```

### Update FEATURE_BACKLOG.md

Read: `D:\Projects\GregLite\FEATURE_BACKLOG.md`

Add Phase 10.6 section with all 14 items marked complete (see blueprint §GregLite Feature
Backlog Updates for the exact text).

### Git commit

```bash
cd D:\Projects\GregLite
git add -A
git status
```

Verify all changes look correct, then:

```bash
git commit -m "feat(ux): scrollbar landmarks — DeepSeek-inspired conversation structure markers

Sprint 10.6G: CustomScrollbar component with colored tick marks for code blocks,
user messages, interruptions, and long responses. ResizeObserver for container
height tracking. Pointer-events: none for zero scroll interference."
```

Then a final status commit:

```bash
git add STATUS.md FEATURE_BACKLOG.md
git commit -m "docs: close Sprint 10.6 — Professional Cognitive Interface complete"
```

---

## FINAL GATES

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — 890+ tests passing
3. Full checklist above passes
4. STATUS.md updated
5. FEATURE_BACKLOG.md updated
6. All commits made with conventional format

## COMMITS

```
feat(ux): scrollbar landmarks — DeepSeek-inspired conversation structure markers
docs: close Sprint 10.6 — Professional Cognitive Interface complete
```
