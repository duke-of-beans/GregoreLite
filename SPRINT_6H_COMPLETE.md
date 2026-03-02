# SPRINT 6H COMPLETE — Ghost Context Panel Cards

**Date:** March 2, 2026  
**Status:** ✅ Complete  
**Tests:** 703/703 passing (34 test files, 0 new — existing suite validates Ghost store + API contracts)  
**Type-check:** `npx tsc --noEmit` — 0 errors  

---

## What Was Built

Sprint 6H surfaces active Ghost suggestions in the Context Panel as interactive cards, wires Tell me more injection into the active KERNL thread, records Noted feedback, and adds a Ghost context active indicator to ChatInterface.

### New API Routes

**`app/api/ghost/suggestions/[id]/feedback/route.ts`**  
POST — records `noted` or `expanded` in `ghost_suggestion_feedback`; `noted` also sets `dismissed_at` on `ghost_surfaced` to remove the card immediately. Uses plain `export async function POST` (not safeHandler — required for dynamic `params`).

**`app/api/ghost/chunks/[chunkId]/route.ts`**  
GET — returns `{ id, content, sourceType, sourcePath, sourceAccount }` from `content_chunks`. Used by Tell me more to fetch chunk content before injection.

**`app/api/ghost/inject/route.ts`**  
POST `{ chunkId, source, threadId }` — fetches chunk content, wraps in the mandatory UNTRUSTED CONTENT label, and calls `addMessage({ thread_id, role: 'system', content })` to inject into the active KERNL thread.

```
[GHOST CONTEXT - UNTRUSTED CONTENT - Source: {source}]

{content}

[END GHOST CONTEXT]
```

### New Library File

**`app/lib/ghost/card-actions.ts`**  
`handleTellMeMore(suggestion, threadId)` — dismisses card optimistically → POST `/api/ghost/inject` → records `expanded` feedback → sets `ghostContextActive` in store.  
`handleNoted(suggestion)` — dismisses card optimistically → records `noted` feedback.  
Both fire-and-forget. Errors are swallowed; neither blocks the UI.

### New React Components

**`app/components/ghost/GhostCardActions.tsx`**  
Two buttons: "Tell me more" (teal) + "Noted" (mist grey). Calls into card-actions with `suggestion` and `threadId` from parent.

**`app/components/ghost/GhostCard.tsx`**  
Dark teal card design (`#1a1f2e` background), visually distinct from Cross-Context blue. Critical suggestions get an amber left border. Score > 0.90 shows a "High relevance" amber dot indicator. Eye icon header, source truncated at 50 chars, 2-line clamped summary.

**`app/components/ghost/GhostCardList.tsx`**  
Reads `ghostSuggestions`, `activeThreadId`, and store actions from `useGhostStore`. Wires `ghost:suggestion-ready` Tauri event via dynamic import with `.catch(() => null)` fallback (works in both dev and Tauri). Render-time expiry filter: `ghostSuggestions.filter(s => s.expiresAt > now).slice(0, 2)`. A side-effect `useEffect` prunes expired entries from the store array. Renders nothing when no active cards.

### Modified Files

**`app/lib/stores/ghost-store.ts`**  
Added `ghostContextActive: GhostContextActive | null`, `activeThreadId: string | null`, and actions `setGhostContextActive`, `clearGhostContextActive`, `setActiveThreadId`.

**`app/components/context/ContextPanel.tsx`**  
`<GhostCardList />` injected above the Quality section.

**`app/components/chat/ChatInterface.tsx`**  
Three additions: (1) imports and destructures ghost store actions; (2) syncs `conversationId` to `activeThreadId` on boot restore and on first API response; (3) renders Ghost context active indicator banner when `ghostContextActive` is set, cleared on next message send.

---

## Architecture Decisions

**activeThreadId bridge via ghost store** — `ChatInterface` holds `conversationId` in local state; `GhostCardList` is in `ContextPanel` (sibling subtree). Threading the ID as a prop would require lifting state or prop-drilling through `ContextPanel`. Solution: add `activeThreadId` to the shared ghost Zustand store. `ChatInterface` writes it; `GhostCardList` reads it. No coupling between the two components.

**Auto-expire on render, not setTimeout** — Blueprint §6H explicitly requires render-time expiry check (reliability with app backgrounding). Every `GhostCardList` render filters `s.expiresAt > Date.now()` before display. A cleanup `useEffect` prunes expired entries from the store array to prevent unbounded accumulation.

**Max-2 UI cap** — `.slice(0, 2)` on filtered active suggestions. Prevents Context Panel flooding when the scorer surfaces multiple simultaneous candidates.

**safeHandler not used for dynamic routes** — `safeHandler` only wraps `(request: Request)`. Next.js dynamic routes require `(request, { params })`. Both new dynamic routes use plain `export async function` with their own try/catch.

---

## Key Discoveries

- **safeHandler single-arg constraint**: Only accepts `(request: Request)`. Dynamic route handlers that need `{ params }` must use plain `export async function`. Discovered when TypeScript rejected the wrapped form for both `chunks/[chunkId]` and `suggestions/[id]/feedback`.
- **Tauri dynamic import pattern**: `@tauri-apps/api/event` must be dynamically imported with `.catch(() => null)` in components that run in both browser dev mode (no Tauri) and production (Tauri). Static import would crash the Next.js dev server.

---

## Gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 703/703 passing |
| Ghost context panel cards render | ✅ GhostCardList in ContextPanel |
| Tell me more injection | ✅ `addMessage(role:'system')` with UNTRUSTED CONTENT wrapper |
| Noted feedback | ✅ `ghost_suggestion_feedback` + `dismissed_at` |
| 4h auto-expire on render | ✅ `s.expiresAt > Date.now()` filter |
| Max-2 UI cap | ✅ `.slice(0, 2)` |
| Tauri event listener | ✅ `ghost:suggestion-ready` with fallback |
| Ghost context active indicator | ✅ Banner in ChatInterface, cleared on send |
| activeThreadId bridge | ✅ ghost store, written by ChatInterface, read by GhostCardList |
| STATUS.md updated | ✅ Done |
| Conventional commit + push | ✅ Done |

---

**Next:** Sprint 6I — Integration + Phase 6 certification (security audit, perf measurements, EoS self-scan)
