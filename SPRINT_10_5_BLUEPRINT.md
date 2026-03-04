# SPRINT 10.5 — UX Polish & Daily Friction Fixes
**Date:** March 3, 2026
**Phase:** Phase 10.5 — Post-v1.1.0 Polish
**Status:** PLANNED
**Estimated effort:** ~2 sprints (5 tasks, sequential)

---

## Overview

Five P1/P2 items identified during live testing after Phase 9 v1.1.0 shipped. All are UX friction or wiring gaps — no new architecture. Order is by dependency chain and daily-impact priority.

---

## Sprint Order

### Task 1 — Dev Mode API Route Fix (output: "export" conflict)
**Priority:** P0 (blocks all other dev testing)
**Problem:** `next.config.ts` has `output: 'export'` which disables API routes in `next dev`. Every `/api/*` endpoint returns 500 in dev mode. The app works in Tauri (static export + Rust backend) but dev iteration is broken.
**Solution:** Conditional config — only set `output: 'export'` when building for production/Tauri. In dev mode, omit it so API routes work normally.
**File:** `D:\Projects\GregLite\app\next.config.ts`
**Implementation:**
```typescript
const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  images: { unoptimized: true },
  serverExternalPackages: ['better-sqlite3', 'keytar', 'sqlite-vec'],
};
```
**Gate:** `pnpm dev` → all API routes return 200 (not 500). `pnpm build` still produces static export.

### Task 2 — Chat History Visible in Left Pane
**Priority:** P1
**Problem:** Past conversations not showing in the left panel. ChatHistoryPanel exists (S9-12) but is a slide-in drawer triggered by Cmd+[. There is no persistent sidebar showing recent chats. The left panel area doesn't exist in the current layout — ChatInterface is full-width with no sidebar.
**Solution:** Add a collapsible left sidebar (240px default) to ChatInterface that shows recent conversations inline — always visible, not just on Cmd+[. The sidebar should:
- Show last 20 conversations, most recent first
- Each row: title (or "Untitled" if none), date, message preview
- Click loads thread into current/new tab (reuse `handleLoadThread`)
- Collapse/expand via a caret button at top-left
- Collapsed state persists in localStorage (or KERNL settings)
- Cmd+[ still toggles the full ChatHistoryPanel drawer for search/pinned
**Files:**
- NEW: `app/components/chat/ChatSidebar.tsx` — persistent left sidebar
- MODIFY: `app/components/chat/ChatInterface.tsx` — wrap body in flex layout with sidebar
- USES: `listConversations` from `lib/api/conversation-client.ts`
- API: `GET /api/conversations?page=1&pageSize=20` (already exists)
**Gate:** Sidebar visible on load with recent conversations. Click loads thread. Collapse/expand works. Cmd+[ still opens full history drawer.

### Task 3 — Left Panel Collapse/Expand Carets Both at Top
**Priority:** P1
**Problem:** When collapsing the sidebar, the expand caret appears at the bottom of the collapsed strip. Both collapse and expand carets should be at the top for consistent UX.
**Solution:** In ChatSidebar.tsx (from Task 2), ensure the collapsed state renders the expand caret at the top of the collapsed strip, not the bottom. This is a CSS/layout concern — the collapsed strip should be a narrow column with the caret button pinned to the top.
**File:** `app/components/chat/ChatSidebar.tsx` (same component from Task 2)
**Gate:** Collapse caret at top. Expand caret at top. No layout jump.

### Task 4 — Use Actual Gregore Logo
**Priority:** P1
**Problem:** Header shows a hardcoded cyan "G" square as the logo. The real Gregore logo exists at `D:\Projects\Gregore\Logos\gregore-logo.png` (9KB).
**Solution:**
1. Copy `gregore-logo.png` to `app/public/gregore-logo.png`
2. Update Header.tsx — replace the cyan "G" div with an `<img>` tag loading `/gregore-logo.png`
3. Replace `app/app/favicon.ico` with a favicon generated from the logo (or just use the PNG as favicon via metadata)
4. Update `app/src-tauri/icons/icon.ico` with the logo (for tray icon)
**Files:**
- COPY: `D:\Projects\Gregore\Logos\gregore-logo.png` → `D:\Projects\GregLite\app\public\gregore-logo.png`
- MODIFY: `app/components/ui/Header.tsx` — replace "G" block with `<img src="/gregore-logo.png">`
- MODIFY: `app/app/layout.tsx` or metadata — update favicon reference
- COPY: logo to `app/src-tauri/icons/` for Tauri tray
**Gate:** Logo visible in Header. Favicon shows logo. Tray icon shows logo.

### Task 5 — Auto-Name Chat Instances
**Priority:** P1
**Problem:** Conversations appear unnamed in the sidebar and tab bar. No auto-titling from first message.
**Solution:** After the first assistant response in a new conversation (conversationId just assigned), fire a background Haiku call to generate a 3-6 word title from the first user message. Store via `PATCH /api/conversations/:id` (update title). Update the tab name in thread-tabs-store. The sidebar re-fetches on next poll.
**Implementation:**
1. NEW: `app/lib/chat/auto-title.ts` — `generateTitle(firstUserMessage: string): Promise<string>` — calls Haiku with a tight prompt: "Summarize this message as a 3-6 word conversation title. Return only the title, nothing else."
2. MODIFY: `app/components/chat/ChatInterface.tsx` — in `handleSubmit`, after receiving the first assistant response on a new conversation, call `generateTitle()` in the background and update the tab + API.
3. MODIFY: `app/lib/stores/thread-tabs-store.ts` — add `renameTab(tabId: string, title: string)` action if not already present.
4. API: `PATCH /api/conversations/:id` with `{ title }` — check if this route exists, create if not.
**Gate:** Send first message in new thread → tab auto-renames within 2-3 seconds. Sidebar shows title on next refresh. No UI stutter during title generation (fully async, fire-and-forget).

---

## Cross-Cutting Concerns

- **TSC clean** after every task — `npx tsc --noEmit` must pass
- **No test regressions** — `pnpm test:run` must stay at 890+
- **Conventional commits** — one commit per task, format: `fix(ux): task description`
- **STATUS.md** — update after all 5 tasks complete, close Phase 10.5 items in FEATURE_BACKLOG.md

## Files Summary

| Task | New Files | Modified Files |
|------|-----------|----------------|
| 1 | — | next.config.ts |
| 2 | components/chat/ChatSidebar.tsx | ChatInterface.tsx |
| 3 | — | ChatSidebar.tsx (from Task 2) |
| 4 | public/gregore-logo.png | Header.tsx, layout.tsx, src-tauri/icons/ |
| 5 | lib/chat/auto-title.ts | ChatInterface.tsx, thread-tabs-store.ts |

## Key Technical Notes

- **output: 'export' conflict**: This is the root cause of ALL 500 errors in dev mode. Next.js static export mode disables server-side API routes entirely. The fix is trivial (conditional config) but blocks all other dev testing.
- **ChatSidebar vs ChatHistoryPanel**: The sidebar is a persistent narrow panel showing recent chats (always visible). ChatHistoryPanel (S9-12) is a full-featured slide-in drawer with search, pinned sections, and pagination. Both should coexist — sidebar for quick access, drawer for deep browsing.
- **Auto-title Haiku call**: Use the same Anthropic SDK pattern from the chat route. Model: `claude-haiku-4-5-20251001`. Max tokens: 20. Temperature: 0. System prompt: "You generate concise conversation titles. Return only the title text, 3-6 words, no quotes or punctuation."
- **Logo assets**: `gregore-logo.png` is 9KB, suitable for web. For favicon, either convert to .ico or use PNG favicon via Next.js metadata. For Tauri tray icon, the .ico in src-tauri/icons/ needs to be replaced.
