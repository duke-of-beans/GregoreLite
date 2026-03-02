# Sprint 6G Complete — Privacy Dashboard UI

**Date:** March 2, 2026  
**Commit:** TBD (sprint-6g)  
**Tests:** 703/703 passing (34 test files)  
**tsc:** 0 errors

---

## What was built

Sprint 6G delivers the full Privacy Dashboard — the UI surface through which users can inspect, control, and purge everything Ghost has indexed.

### Backend additions

**`app/lib/ghost/privacy/index.ts`** — two new exports:
- `deleteGhostItem(itemId)` — cascade delete: vec_index → content_chunks → soft-delete ghost_indexed_items → audit log entry. Uses `source_path` as the join key (added in 6C).
- Exclusion log retention cap: every `logExclusion()` call now prunes the table to the last 10,000 rows via a single DELETE WHERE id NOT IN (...).
- Re-exports `ExclusionLogRow` type for consumers.

**API routes** (all under `app/app/api/ghost/`):

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/ghost/items` | GET, DELETE | Paginated (50/page), type + time + search filter; DELETE cascades via `deleteGhostItem()` |
| `/api/ghost/exclusions` | GET, POST, DELETE | CRUD for Layer 4 user exclusion rules |
| `/api/ghost/exclusion-log` | GET | Last 100 entries from ghost_exclusion_log |
| `/api/ghost/watch-paths` | GET, POST, DELETE | Watch directory list stored as JSON in KERNL settings |
| `/api/ghost/status` | GET | Returns current `GhostStatus` snapshot |
| `/api/ghost/purge` | POST | Full cascade delete of all Ghost data + Ghost restart; Layer 4 exclusion rules are preserved |

### React components (all under `app/components/ghost/`)

| Component | Description |
|-----------|-------------|
| `GhostStatusBadge` | Eye icon + state label, color-coded (green/amber/grey). Clickable. |
| `IndexedItemRow` | Single `<tr>` for the items table. Type icon (file=blue, email=purple), truncated path, date, chunk count, hover-reveal delete. |
| `ExclusionLog` | Read-only last-100 entries table fetched from `/api/ghost/exclusion-log`. Columns: Time, Source, Layer, Reason, Pattern. |
| `IndexedItemsList` | Paginated items list wrapping `IndexedItemRow`. Filter controls (All/Files/Emails), time filter (All/Today/This week), search with 300ms debounce, refresh button, pagination. |
| `ExclusionRules` | Layer 4 rules CRUD table + add-rule form. Layer 3 read-only callout explaining automatic exclusions. |
| `WatchPaths` | Watched directory list + text-input add form. Remove per path. |
| `PurgeAllDialog` | Confirmation modal. Requires typing `DELETE` exactly. Disables close during purge. |
| `PrivacyDashboard` | Main container with header (Ghost status badge + close button), 4-tab nav (Indexed items / Exclusion rules / Watch paths / Activity log), success banner after purge, footer with Purge all trigger. Polls `/api/ghost/status` every 5s. |

---

## Key decisions

**Watch paths via text input, not Tauri dialog** — `@tauri-apps/plugin-dialog` is not installed (only `@tauri-apps/api` v2 is). Text input works in both browser dev mode and Tauri.

**Cascade delete key is `source_path`** — `content_chunks.source_path` was added in Sprint 6C specifically for this purpose. The delete path is: `deleteVector()` per chunk → DELETE content_chunks WHERE source_path → soft-delete ghost_indexed_items → audit log.

**Purge preserves Layer 4 rules** — ghost_exclusions is intentionally untouched. The user's explicit privacy rules survive a data wipe.

**GhostStatusBadge receives status as prop** — PrivacyDashboard owns the polling loop (`/api/ghost/status` every 5s) and passes the current `GhostStatus | null` down. Badge stays stateless.

---

## Gate results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 703/703 passing |
| API routes — all 6 written | ✅ Done |
| React components — all 8 written | ✅ Done |
| Cascade delete + purge-all | ✅ Done |
| Exclusion log retention cap | ✅ Done |
| STATUS.md updated | ✅ Done |
| Conventional commit + push | ✅ Done |
