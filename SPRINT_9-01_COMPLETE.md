# Sprint S9-01: Multi-Thread Tabs — COMPLETE

**Commit:** 585df1f
**Quality:** tsc clean, 890/890 tests passing

## What was built
Per-tab state isolation for multi-thread support. Each tab holds its own messages, conversationId, ghost context, and artifact state independently. ChatInterface now reads from the active tab entry instead of local useState.

## New files (5)
- `lib/kernl/thread-tabs.ts` — KERNL persistence helpers (saveTabLayout, loadTabLayout, restoreTabMessages)
- `lib/stores/thread-tabs-store.ts` — Zustand store: tabs[], activeTabId, all per-tab actions
- `components/chat/ThreadTab.tsx` — Individual tab with double-click rename, status badges
- `components/chat/ThreadTabBar.tsx` — Horizontal tab strip with [+] button, near-limit warning
- `app/api/settings/thread-tabs/route.ts` — GET/PUT for KERNL settings persistence

## Modified (1)
- `components/chat/ChatInterface.tsx` — Rewritten to consume thread-tabs-store, Cmd+N handler

## Key decisions
- Max 8 tabs, warning at 6
- Tab layout persisted to KERNL settings table (key: 'thread_tabs')
- Messages restored from KERNL threads on reload
- ThreadTabBar only visible when >1 tab open
- Artifact state is per-tab (removed useArtifactStore dependency from ChatInterface)