# SPRINT 10.6D — EXECUTION BRIEF: Sidebar Consolidation
# Wave 3 continued: Move Recent Chats into Context Panel, kill ChatSidebar pane
# Prerequisites: Brief A complete
# Gate: No left sidebar pane. Recent Chats visible in Context Panel. Click loads thread.

---

## CONTEXT

Project root: `D:\Projects\GregLite`, App: `D:\Projects\GregLite\app`
Blueprint: `D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md` (Task 6)

---

## WHAT YOU'RE CHANGING

The current layout has a 240px collapsible ChatSidebar on the left showing recent
conversations AND a ContextPanel on the right showing project context, decisions, etc.
This creates awkward double-pane architecture.

You are:
1. Creating a RecentChats component that shows last 10 conversations
2. Adding it as a collapsible section in the existing ContextPanel
3. Removing ChatSidebar from the ChatInterface layout
4. Chat content area expands to full width

---

## STEP 1: Read existing files

Read these files to understand the current architecture:
- `D:\Projects\GregLite\app\components\chat\ChatSidebar.tsx` — component to remove from layout
- `D:\Projects\GregLite\app\components\context\ContextPanel.tsx` — where to add RecentChats
- `D:\Projects\GregLite\app\components\chat\ChatInterface.tsx` — layout to simplify

---

## STEP 2: Create RecentChats component

Create: `D:\Projects\GregLite\app\components\context\RecentChats.tsx`

```typescript
/**
 * RecentChats — Sprint 10.6 Task 6
 *
 * Collapsible section within ContextPanel showing last 10 conversations.
 * Click to load a thread. "See all" opens the full ChatHistoryPanel.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface Conversation {
  id: string;
  title: string;
  lastMessageAt: string;
  preview: string;
}

interface ApiResponse {
  data?: {
    conversations?: Conversation[];
  };
}

function timeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return '';
  }
}

export interface RecentChatsProps {
  onLoadThread: (conversationId: string) => void;
  onSeeAll: () => void;
}

export function RecentChats({ onLoadThread, onSeeAll }: RecentChatsProps) {
  const [expanded, setExpanded] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations?page=1&pageSize=10');
      if (res.ok) {
        const body = (await res.json()) as ApiResponse;
        setConversations(body.data?.conversations ?? []);
      }
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="border-b border-[var(--shadow)]">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--mist)] hover:text-[var(--frost)] transition-colors"
      >
        <span>Recent Chats</span>
        <span className="text-[var(--ghost-text)]">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="pb-2">
          {conversations.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-[var(--ghost-text)]">
              No conversations yet
            </div>
          )}

          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onLoadThread(conv.id)}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--shadow)] transition-colors"
            >
              <div className="text-[11px] font-medium text-[var(--ice-white)] truncate">
                {conv.title || 'Untitled'}
              </div>
              <div className="text-[9px] text-[var(--mist)]">
                {timeAgo(conv.lastMessageAt)}
              </div>
            </button>
          ))}

          {conversations.length > 0 && (
            <button
              onClick={onSeeAll}
              className="w-full px-3 py-1.5 text-[10px] text-[var(--cyan)] hover:text-[var(--ice-white)] transition-colors text-left"
            >
              See all (Cmd+[)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## STEP 3: Add RecentChats to ContextPanel

Read `D:\Projects\GregLite\app\components\context\ContextPanel.tsx`.

Import and render `RecentChats` as the FIRST section in the panel (before Active Projects
or whatever the current first section is).

The ContextPanel needs to accept `onLoadThread` and `onOpenHistory` props (or you can
pipe them through). Check how the panel currently receives its callbacks.

Add near the top of the panel's content area:
```typescript
<RecentChats
  onLoadThread={onLoadThread}
  onSeeAll={() => onOpenHistory?.()}
/>
```

You may need to thread `onLoadThread` and `onOpenHistory` through from ChatInterface.
Check ContextPanel's existing props interface and add what's needed.

---

## STEP 4: Remove ChatSidebar from ChatInterface layout

In `D:\Projects\GregLite\app\components\chat\ChatInterface.tsx`:

1. Remove the import: `import { ChatSidebar } from './ChatSidebar';`
2. Remove the `<ChatSidebar onLoadThread={handleLoadThread} />` from the JSX
3. The flex layout should now just be: tab content wrapper directly inside the body div

The layout changes from:
```
<div flex-1> ← body
  <ChatSidebar />  ← REMOVE
  <div flex-1>     ← tab content
    ...
  </div>
</div>
```

To:
```
<div flex-1> ← body
  <div flex-1> ← tab content (now full width)
    ...
  </div>
</div>
```

You can simplify by removing the extra wrapper div if it's now redundant.

**Do NOT delete ChatSidebar.tsx file** — just remove it from the layout. It may be
useful as reference later.

3. Pass `handleLoadThread` and a history-toggle callback to ContextPanel if not already available.

---

## FINAL GATES

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — 890+ tests passing
3. No left sidebar visible in the layout
4. Context Panel shows "Recent Chats" section at the top
5. Clicking a conversation in Recent Chats loads that thread
6. "See all" opens the ChatHistoryPanel (Cmd+[)
7. Chat content area uses full available width

## COMMITS

```
refactor(layout): consolidate sidebar into context panel — RecentChats section
```
