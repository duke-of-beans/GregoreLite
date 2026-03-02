GREGLITE SPRINT 6G - Ghost Thread Privacy Dashboard UI
Phase 6, Sprint 7 of 9 | Sequential after 6F | March 2, 2026

YOUR ROLE: Build the Privacy Dashboard - the UI where David controls everything the Ghost sees, removes indexed content, configures exclusions, and audits what has been indexed. This is a trust interface - it must be clear, complete, and non-alarming. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - section 6.3 (Privacy Model) and 6.7 (Build Sequence)
7. D:\Projects\GregLite\SPRINT_6F_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- Deleting a ghost_indexed_item requires also deleting content_chunks and vec_index entries - design the cascade delete before building the UI button
- The exclusion log grows unbounded - add a retention policy (keep last 10,000 rows) before shipping
- pnpm test:run failures after adding new routes or components
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] API routes: items/route.ts (GET list + DELETE), exclusions/route.ts (GET/POST/DELETE), exclusion-log/route.ts (GET last 100), watch-paths/route.ts (GET/POST/DELETE), status/route.ts (GET) → all specs fully defined, mechanical scaffolding
[HAIKU] React components: IndexedItemRow.tsx, ExclusionLog.tsx, GhostStatusBadge.tsx → layouts fully specified, mechanical
[HAIKU] PurgeAllDialog.tsx → spec is detailed (typing DELETE to confirm), mechanical
[HAIKU] Add exclusion log retention policy (DELETE WHERE id NOT IN last 10,000) → SQL specified, mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 6G complete, write SPRINT_6G_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] deleteGhostItem(itemId): cascade delete across content_chunks, vec_index, ghost_indexed_items soft-delete
[SONNET] PrivacyDashboard.tsx: container with data fetching, state management, filter controls
[SONNET] IndexedItemsList.tsx: pagination, search, filter by type/date
[SONNET] ExclusionRules.tsx: Layer 4 rules table + add rule form + Layer 3 read-only reference
[SONNET] WatchPaths.tsx: Tauri dialog API folder picker integration
[SONNET] POST /api/ghost/purge: multi-table cascade + Ghost lifecycle restart
[OPUS] Escalation only if Sonnet fails twice on the same problem

QUALITY GATES:
1. Dashboard shows total indexed items count, breakdown by type (files vs emails)
2. David can delete any indexed item and confirm its chunks are removed from content_chunks and vec_index
3. David can add/remove Layer 4 exclusion rules
4. Exclusion audit log visible (last 100 rejections)
5. Watch paths configurable - add/remove directories
6. One-click purge all Ghost data with confirmation dialog
7. Dashboard accessible from main nav or context panel Ghost status click

FILE LOCATIONS:
  app/components/ghost/
    PrivacyDashboard.tsx     - main dashboard container
    IndexedItemsList.tsx     - paginated list of ghost_indexed_items
    IndexedItemRow.tsx       - single row with delete button
    ExclusionRules.tsx       - Layer 4 rules management (add/remove)
    ExclusionLog.tsx         - last 100 entries from ghost_exclusion_log
    WatchPaths.tsx           - configure watch directories
    PurgeAllDialog.tsx       - confirmation modal for purge all
    GhostStatusBadge.tsx     - small status indicator (used in context panel)

  app/app/api/ghost/
    items/route.ts           - GET (list), DELETE /:id
    exclusions/route.ts      - GET (list), POST (add), DELETE /:id
    exclusion-log/route.ts   - GET (last 100)
    watch-paths/route.ts     - GET, POST (add), DELETE /:path
    purge/route.ts           - POST (purge all)
    status/route.ts          - GET (GhostStatus)

CASCADE DELETE:
When David deletes an indexed item, the system must:
  1. Delete all content_chunks WHERE metadata->source_path = item.source_path AND source_type = 'ghost'
  2. Delete corresponding vec_index entries (chunk_ids from step 1)
  3. Soft-delete the ghost_indexed_items row (set deleted = 1, deleted_at = now)
  4. Write to ghost_exclusion_log with reason 'user_deleted'

Build a deleteGhostItem(itemId) function in app/lib/ghost/privacy/index.ts that performs this cascade. The API route calls this function - do not put cascade logic in the route handler.

INDEXED ITEMS LIST:
Paginated, 50 per page. Columns: Type (file/email icon), Source (path or subject), Date Indexed, Chunk Count, Delete button.

For email items, show: email icon, subject line (truncated at 60 chars), sender, date.
For file items, show: file icon, relative path from watch root, last modified, date indexed.

Filter controls: All | Files | Emails | Today | This Week

Search: basic substring match on source_path or email subject.

EXCLUSION RULES PANEL:
Show current Layer 4 rules in a table: Type, Pattern, Added Date, Note, Remove button.
Add rule form: select type (path_glob / domain / sender / keyword / subject_contains), enter pattern, optional note, Add button.
Show Layer 3 contextual defaults as read-only reference (greyed out, labeled "Built-in defaults").

EXCLUSION LOG:
Show last 100 entries: timestamp, source (path/email subject truncated), layer (1/2/3/4), reason, pattern that triggered. Read-only.
Add note: "These items were filtered before indexing. No content from these sources was stored."

WATCH PATHS PANEL:
List of currently watched directories. Remove button on each. Add path input with folder picker (use Tauri dialog API: open({ directory: true })).

PURGE ALL:
Button labeled "Purge all Ghost data". On click, open PurgeAllDialog with:
  "This will permanently delete all [N] indexed items, all exclusion rules, and all Ghost suggestions. Ghost will restart with a clean index. This cannot be undone."
Two buttons: "Cancel" and "Delete Everything". Require typing "DELETE" to enable the confirm button.

On confirm, call POST /api/ghost/purge which:
  1. DELETE FROM content_chunks WHERE source_type = 'ghost'
  2. DELETE entries from vec_index corresponding to those chunks
  3. DELETE FROM ghost_indexed_items
  4. DELETE FROM ghost_surfaced
  5. DELETE FROM ghost_suggestion_feedback
  6. DELETE FROM ghost_exclusion_log
  7. Keep ghost_exclusions (Layer 4 rules) - David probably wants to keep their custom exclusions
  8. Restart Ghost lifecycle (stop + start)

DASHBOARD ACCESSIBILITY:
Open via: Settings menu > "Ghost & Privacy" item. Also accessible by clicking the Ghost status badge in the context panel footer.

The Ghost status badge shows: a small eye icon + state label (Running / Paused / Degraded / Off). Color: green running, amber paused/degraded, grey off. Clicking it opens the Privacy Dashboard.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 6G complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-6g: Privacy Dashboard, exclusion rules, cascade delete, purge all)
5. git push
6. Write SPRINT_6G_COMPLETE.md: cascade delete verified end-to-end, purge tested with live data, exclusion rule round-trip verified

GATES CHECKLIST:
- Privacy Dashboard opens from Settings menu
- Indexed items list loads with correct counts (files vs emails)
- Delete item: content_chunks removed, vec_index entries removed, ghost_indexed_items soft-deleted
- Add exclusion rule: appears in Layer 4, triggers on next ingest
- Remove exclusion rule: no longer triggers
- Exclusion log shows last 100 entries
- Add watch path via folder picker works
- Remove watch path removes from KERNL settings, watcher stops watching that dir
- Purge all: requires typing DELETE, executes full cascade, Ghost restarts cleanly
- Ghost status badge in context panel shows correct state
- Badge click opens Privacy Dashboard
- pnpm test:run clean
- Commit pushed via cmd -F flag
