# SPRINT 10.8 — Database Unification & Runtime Polish

**Goal**: Fix the last 500 error, unify the dual-database problem, suppress dev noise, and harden the runtime for daily use.
**Branch**: Continue on `master` (commit on top of 19fee2c).
**Estimated tasks**: 10 across 3 waves.

---

## CONTEXT

GregLite currently has TWO separate SQLite database layers:
1. **KERNL** (`lib/kernl/database.ts`) — Works. Stores threads, messages, decisions, checkpoints, embeddings. Initialized at import time via `getDatabase()` which calls `_db.exec(schema)`.
2. **ConversationRepository** (`lib/database/connection.ts`) — Broken. Requires `initializeDatabase()` to be called explicitly. Never called in dev mode. Uses a separate `gregore.db` file. Backs `/api/conversations` and its child routes.

The conversations route is the ONLY remaining 500 error. Additionally, the dev server is extremely noisy — the `@tauri-apps/plugin-shell` warning repeats on every single route compilation (30+ times per page load).

This sprint fixes both and addresses remaining UX issues from the 10.7 bug list.

---

## WAVE 1 — Database Unification (Tasks 1-4)

### Task 1: Auto-initialize ConversationRepository database
**File**: `app/lib/database/connection.ts`
**Problem**: `getDatabase()` throws "not initialized" because `initializeDatabase()` is never called.
**Fix**: Make `getDatabase()` auto-initialize like KERNL does. Two options:
- **Option A** (preferred): Replace the lazy async `initializeDatabase()` with synchronous initialization on first `getDatabase()` call. Use `process.cwd() + '/data/gregore.db'` as the path (skip the Tauri `appDataDir()` async call — that's only needed for production builds).
- **Option B**: Call `initializeDatabase()` during bootstrap sequence in `lib/bootstrap/index.ts`.

Choose Option A. Change `getDatabase()` to:
```ts
export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbFile = join(process.cwd(), 'data', 'gregore.db');
    // Ensure data directory exists
    const { mkdirSync } = require('fs');
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    
    dbInstance = new Database(dbFile, { timeout: 5000 });
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('synchronous = NORMAL');
  }
  return dbInstance;
}
```

Remove the `@tauri-apps/api/path` import (causes issues in Node.js context).
Keep `initializeDatabase()` as an optional override for Tauri production builds.

### Task 2: Run ConversationRepository schema migrations on first connect
**File**: `app/lib/database/connection.ts` (or new `app/lib/database/schema.ts`)
**Problem**: Even after Task 1 connects, the DB file has no tables. The migration runner exists but is never invoked.
**Fix**: After auto-creating the DB in `getDatabase()`, check if the `conversations` table exists. If not, run the migration sequence:
```ts
const tableExists = dbInstance.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'"
).get();
if (!tableExists) {
  runMigrations(dbInstance); // from lib/database/migrations/runner.ts
}
```

Also create the missing tables referenced in server logs: `session_costs`, `budget_config`. Either add them to the existing migration files or create migration 006.

### Task 3: Verify /api/conversations returns 200
**Test**: After Tasks 1-2, restart dev server, hit `localhost:3000/api/conversations?page=1&pageSize=10`. Should return `{"success":true,"data":{"items":[],...}}` not 500.

Also verify: `/api/conversations/[id]` (PATCH route that fails on auto-title save).

### Task 4: Wire Recent Chats in Context Panel to real data
**File**: `app/components/context/RecentChats.tsx`
**Problem**: Context panel shows "No conversations yet" even though KERNL has threads. The RecentChats component may be hitting the broken `/api/conversations` route instead of KERNL's `listThreads()`.
**Fix**: Verify data source. If it uses `/api/conversations`, wire it to KERNL's thread list instead (which works). The context panel already imports from `@/lib/context/context-provider` which polls `/api/context`.

---

## WAVE 2 — Dev Noise Suppression (Tasks 5-6)

### Task 5: Suppress @tauri-apps/plugin-shell warning
**File**: `app/lib/ghost/email/oauth.ts` (line 135)
**Problem**: Dynamic import of `@tauri-apps/plugin-shell` logs a Turbopack "Module not found" warning on EVERY route compilation. The import is inside a try/catch (correct), but Turbopack still resolves it at build time and warns.
**Fix**: Use `require()` inside the try/catch instead of `await import()`. Or conditionally skip the import entirely when not in Tauri context:
```ts
// Only attempt Tauri shell in actual Tauri runtime
if (typeof window !== 'undefined' && '__TAURI__' in window) {
  const { open } = await import('@tauri-apps/plugin-shell');
  await open(url);
} else {
  // Node.js fallback
  const { exec } = require('child_process');
  exec(`start ${url}`);
}
```

The key is preventing Turbopack from trying to resolve the module at all during dev server compilation.

### Task 6: Suppress missing table warnings for non-critical routes
**Files**: `app/api/settings/route.ts`, `app/api/costs/today/route.ts`, `app/api/morning-briefing/route.ts`
**Problem**: These routes log `SqliteError: no such table: session_costs` / `budget_config` on every poll cycle. The errors are caught and return 200 with defaults, but they fill the server log.
**Fix**: Change the catch blocks to use `console.debug()` instead of `console.warn()` for expected "table doesn't exist" errors. Or check table existence before querying:
```ts
const hasTable = db.prepare(
  "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?"
).get('session_costs');
if (!hasTable) return successResponse({ total: 0 });
```

---

## WAVE 3 — UX Polish (Tasks 7-10)

### Task 7: Settings page — convert drawer to full page with dark/light toggle
**Files**: `app/components/settings/SettingsPanel.tsx`, `app/components/settings/AppearanceSection.tsx`
**Problem**: User reported "Settings page missing" — the settings panel exists as a slide-in drawer but may not be discoverable. The dark/light/system toggle exists in AppearanceSection.
**Fix**: 
- Add a visible settings gear icon to the Header (not just Cmd+,)
- Add density controls (compact/comfortable/spacious) to AppearanceSection
- Ensure the dark/light toggle actually applies the theme (verify `useUIStore.setTheme()` updates CSS variables on `<html>`)

### Task 8: Density controls in settings
**File**: `app/components/settings/AppearanceSection.tsx`
**Fix**: Add a density selector (compact/comfortable/spacious) below the theme toggle. Wire to `useDensityStore`. Currently density is only controllable via Cmd+Shift+/-. Add visual buttons matching the theme toggle pattern.

### Task 9: Verify scroll behavior with multiple messages
**Files**: `app/components/chat/MessageList.tsx`, `app/components/chat/ChatInterface.tsx`
**Test**: Send 10+ messages in a conversation. Verify:
- Messages stay visible (not cut off)
- Auto-scroll follows new messages
- Manual scroll up works and pauses auto-scroll
- Scroll-to-bottom button appears when scrolled up
- IntersectionObserver sentinel is within the scrollable container

If scroll is still broken after the `flex flex-col` fix from Sprint 10.7, the issue may be that `overflow-y-auto` on MessageList conflicts with the parent's `overflow-hidden`. Debug by checking computed heights in DevTools.

### Task 10: Header settings gear + keyboard shortcut hints
**File**: `app/components/ui/Header.tsx`
**Fix**: Add a settings gear icon button next to the Cmd+K button. On click, toggle settings panel. Also add tooltip hints showing keyboard shortcuts on the existing header buttons.

---

## EXECUTION INSTRUCTIONS

Use Desktop Commander tools for ALL file reads, writes, edits, and shell commands.
Do NOT use KERNL pm_read_file. Do NOT use Filesystem MCP tools.

Read these files for context before starting:
- `D:\Projects\GregLite\SPRINT_10_6_BLUEPRINT.md` — architecture context
- `D:\Projects\GregLite\SPRINT_10_7_BRIEF.md` — what was already fixed

Execute waves in order: Wave 1 (Tasks 1-4), then Wave 2 (Tasks 5-6), then Wave 3 (Tasks 7-10).

After ALL tasks:
1. Run `cd /d D:\Projects\GregLite\app && npx tsc --noEmit` — must be ZERO errors
2. Delete `.next`, run `pnpm dev`, verify:
   - No 500 errors on any route
   - `@tauri-apps/plugin-shell` warning appears 0 times
   - Server log is clean (no SqliteError spam)
3. Stage and commit: `git add -A && git commit -m "fix: Sprint 10.8 — database unification + runtime polish"`

---

## FILES TOUCHED

| # | File | Change |
|---|------|--------|
| 1 | `app/lib/database/connection.ts` | Auto-init, remove Tauri path dep |
| 2 | `app/lib/database/connection.ts` or new schema.ts | Run migrations on first connect |
| 3 | `app/api/conversations/route.ts` | Verify 200 (may need no change) |
| 4 | `app/components/context/RecentChats.tsx` | Wire to KERNL threads |
| 5 | `app/lib/ghost/email/oauth.ts` | Suppress Tauri import warning |
| 6 | `app/api/settings/route.ts`, `costs/today/route.ts`, `morning-briefing/route.ts` | Quiet missing-table logs |
| 7 | `app/components/settings/SettingsPanel.tsx` | Discoverable settings |
| 8 | `app/components/settings/AppearanceSection.tsx` | Density controls |
| 9 | `app/components/chat/MessageList.tsx` | Scroll verification/fix |
| 10 | `app/components/ui/Header.tsx` | Settings gear icon |

---

## VERIFICATION CHECKLIST

After all 10 tasks:
1. `npx tsc --noEmit` — zero errors
2. `pnpm dev` — server starts clean
3. Browser: zero 500 errors in console
4. Server log: no `@tauri-apps/plugin-shell` warnings
5. Server log: no `SqliteError` spam
6. `/api/conversations` returns 200 with empty array
7. Context panel shows recent threads from KERNL
8. Settings panel opens from header gear icon
9. Dark/light/system theme toggle works
10. Density selector works in settings
11. Scroll works correctly with 10+ messages
12. Cmd+, still opens settings
