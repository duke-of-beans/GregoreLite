# GREGLITE — SPRINT ROADMAP
# Created: March 4, 2026
# Purpose: Dependency-ordered sprint sequence covering all remaining work.
# Source: Ground truth codebase audit (March 4, 2026)
# All sprints are Cowork-executable unless marked [DAVID ONLY].

---

## DEPENDENCY GRAPH

```
Sprint 11.0 (Cleanup)          ← no dependencies, runs first
Sprint 11.1 (SDK Stubs)        ← no dependencies, can parallel with 11.0
Sprint 11.2 (Transit Map A)    ← depends on 11.0 (clean routes)
Sprint 11.3 (Transit Map B)    ← depends on 11.2 (events table + capture hooks)
Sprint 11.4 (Transit Map C)    ← depends on 11.2 (event metadata on messages)
Sprint 11.5 (Transit Map D)    ← depends on 11.3 + 11.4 (landmarks + annotations)
Sprint 11.6 (Transit Map E)    ← depends on 11.5 (subway view must exist for zoom transitions)
Sprint 11.7 (Transit Map F)    ← depends on 11.2 (needs captured events to learn from)
Sprint 12.0 (Cost Optimization) ← no dependencies, can run anytime
```

**Parallelism:** 11.0 ∥ 11.1 ∥ 12.0 can all run simultaneously. 11.3 ∥ 11.4 can run simultaneously after 11.2. 11.7 can run after 11.2 (doesn't need UI).

---

## SPRINT 11.0 — CLEANUP & VERIFICATION — ✅ COMPLETE (commit 5cb2420)

**Goal:** Remove dead code, consolidate duplicate routes, verify Phase 8, clean stale comments.
**Estimated tasks:** 8
**Can parallel with:** 11.1, 12.0

### Wave 1 — Phase 8 Verification [DAVID ONLY for file audit]

**Task 1: Audit Phase 8 Ship Prep files**
BLUEPRINT_FINAL.md claims Phase 8 shipped: NSIS installer, tauri-plugin-updater, first-run onboarding, security hardening. No Phase 8 commits between 9b5789d (Phase 7) and ac634bd (Phase 9). Verify:
- [ ] `build-installer.bat` exists and is functional
- [ ] `tauri.conf.json` has updater config
- [ ] First-run onboarding component exists (4-step wizard)
- [ ] `execFileSync` used instead of `execSync` (security)
- [ ] HMAC auth on merge route (`/api/agent-sdk/jobs/[id]/merge`)
- [ ] keytar or credential manager integration exists
Document findings. If items are missing, create follow-up tasks.

### Wave 2 — Route Consolidation

**Task 2: Remove /api/conversations routes**
`/api/conversations/route.ts` and `/api/conversations/[id]/route.ts` use the broken ConversationRepository layer. `/api/threads` and `/api/threads/[id]` use KERNL directly and are the correct implementation.
- [ ] Search all components for `fetch('/api/conversations` — redirect to `/api/threads`
- [ ] Delete `app/api/conversations/route.ts`
- [ ] Delete `app/api/conversations/[id]/route.ts`
- [ ] Verify no imports reference ConversationRepository from components

**Task 3: Audit /api/jobs vs /api/agent-sdk/jobs**
Both route trees exist. Determine:
- Which is canonical (likely `/api/agent-sdk/jobs` as it has full CRUD + kill/merge/restart)
- What `/api/jobs` adds (if anything)
- Remove the duplicate or redirect
- [ ] Search all components for `fetch('/api/jobs` to find consumers
- [ ] Consolidate to single route tree

**Task 4: Remove ConversationRepository if unused**
After Task 2, check if `lib/database/connection.ts` and related ConversationRepository code is still imported anywhere. If not:
- [ ] Delete `lib/database/connection.ts`
- [ ] Delete `lib/database/` directory if empty
- [ ] Remove any `gregore.db` references (KERNL uses `greglite.db`)

### Wave 3 — Dead Code Cleanup

**Task 5: Clean decision gate dead stubs**
`lib/decision-gate/trigger-detector.ts` has 3 functions that always return false, replaced by Haiku inference in `analyze()`:
- `detectHighTradeoff()` (line ~196)
- `detectMultiProject()` (line ~207)
- `detectLargeEstimate()` (line ~218)
- [ ] Verify `analyze()` no longer calls these functions
- [ ] Remove the 3 stub functions
- [ ] Remove their imports from `index.ts` if present
- [ ] Update `types.ts` comments that reference "STUB — 4B"

**Task 6: Update stale Sprint reference comments**
Search codebase for comments referencing sprints that are complete:
- `// stub — Phase 7G implements this` on `detectShimLoop()` → update to `// STUB — not yet implemented, see Sprint 11.1`
- `// NOT IMPLEMENTED — available in Sprint 7G` on stub tools → update to `// NOT IMPLEMENTED — see Sprint 11.1`
- `// Sprint 4B` references on dead stubs → remove after Task 5
- [ ] Run: `findstr /s /r /i "Sprint.7G\|Sprint.4B\|Sprint.7H.*stub" *.ts *.tsx` (excluding node_modules)
- [ ] Update all stale references

**Task 7: Remove MORNING_BRIEFING.md**
This file is a Phase 1 session handoff doc from March 1, 2026. No longer relevant — morning briefings are auto-generated in the app. Delete the file to reduce confusion.

**Task 8: Verify test suite still passes**
After all cleanup:
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm test:run` — all passing
- [ ] Commit: `chore: Sprint 11.0 cleanup — dead routes, stale stubs, Phase 8 audit`

---

## SPRINT 11.1 — AGENT SDK STUB COMPLETION — ✅ COMPLETE (commit 5cb2420)

**Goal:** Implement the 4 stub tools + detectShimLoop so Agent SDK self-evolution has full capability.
**Estimated tasks:** 6
**Can parallel with:** 11.0, 12.0
**Prerequisite:** None (standalone)

**Task 1: Implement test_runner tool**
File: `lib/agent-sdk/tool-injector.ts` (replace stub at line 106)
New file: `lib/agent-sdk/tools/test-runner.ts`
Behavior:
- Run `pnpm test:run` (or vitest) in the project directory
- Parse output for pass/fail counts, failure details
- Return structured result: `{ passed: number, failed: number, total: number, failures: Array<{test: string, error: string}> }`
- Timeout: 120s
- [ ] Remove `_stub: true` from TOOL_DEFINITIONS
- [ ] Wire into `query.ts` execution path (replace NOT_IMPLEMENTED branch)
- [ ] Tests: happy path, timeout, parse errors

**Task 2: Implement shim_readonly_audit tool**
File: `lib/agent-sdk/tools/shim-readonly-audit.ts`
Behavior:
- Run EoS engine scan on target path (`lib/eos/engine.ts` → `scanFiles()`)
- Return: `{ healthScore: number, grade: string, issues: Array<HealthIssue>, fileCount: number }`
- Read-only — no modifications applied
- [ ] Import and call `scanFiles()` from `lib/eos/engine.ts`
- [ ] Remove `_stub: true` from TOOL_DEFINITIONS
- [ ] Tests: scan on known file, empty directory, nonexistent path

**Task 3: Implement markdown_linter tool**
File: `lib/agent-sdk/tools/markdown-linter.ts`
Behavior:
- Scan markdown files in target path
- Check for: missing headers, broken links (relative), inconsistent list markers, trailing whitespace, missing blank lines
- Return: `{ violations: Array<{file: string, line: number, rule: string, message: string}> }`
- [ ] Simple rule-based linter (no external dependency needed)
- [ ] Remove `_stub: true` from TOOL_DEFINITIONS
- [ ] Tests: clean file, file with violations

**Task 4: Implement kernl_search_readonly tool**
File: `lib/agent-sdk/tools/kernl-search.ts`
Behavior:
- Query KERNL FTS5 index (`messages_fts` table) with search query
- Return top N results: `{ results: Array<{threadId: string, messageId: string, content: string, score: number}> }`
- Read-only — no writes
- [ ] Use existing `searchThread()` or raw FTS5 query from `session-manager.ts`
- [ ] Remove `_stub: true` from TOOL_DEFINITIONS
- [ ] Tests: search with results, empty results, special characters

**Task 5: Implement detectShimLoop()**
File: `lib/agent-sdk/failure-modes.ts` (replace stub at line 107)
Behavior per spec:
- Input: array of `{ file: string, score: number }` representing consecutive SHIM calls
- If 3+ consecutive calls on same file with no score improvement → return true (BLOCKED)
- "No improvement" = score delta ≤ 0 between consecutive calls on same file
- [ ] Implement the loop detection logic
- [ ] Wire into `query.ts` agentic loop (check after each shim_check call)
- [ ] On BLOCKED: transition job to BLOCKED state, surface escalation banner
- [ ] Tests: no loop (scores improve), loop detected (3 flat scores), mixed files (no false positive)

**Task 6: Verify and commit**
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm test:run` — all passing (expect ~10-15 new tests)
- [ ] Verify no remaining `_stub: true` entries in tool-injector.ts
- [ ] Verify `isStubTool()` returns false for all 4 tools
- [ ] Update `permission-config.ts` comments (remove "STUB → 7G" references)
- [ ] Commit: `feat: Sprint 11.1 — Agent SDK stub tools implemented`

---

## SPRINT 11.2 — TRANSIT MAP PHASE A: DATA FOUNDATION

**Goal:** Build the event capture infrastructure. No UI — pure data layer.
**Estimated tasks:** 8
**Prerequisite:** Sprint 11.0 (clean routes, consolidated DB)
**Spec reference:** TRANSIT_MAP_SPEC.md §2, §4

**Task 1: Create conversation_events table**
File: `lib/kernl/schema.sql`
Add the table from §4.1:
```sql
CREATE TABLE IF NOT EXISTS conversation_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  payload TEXT NOT NULL DEFAULT '{}',
  schema_version INTEGER NOT NULL DEFAULT 1,
  tags TEXT DEFAULT '[]',
  annotations TEXT DEFAULT '[]',
  learning_status TEXT DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_events_conversation ON conversation_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON conversation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_category ON conversation_events(category);
CREATE INDEX IF NOT EXISTS idx_events_message ON conversation_events(message_id);
```

**Task 2: Add tree columns to messages**
File: `lib/kernl/schema.sql` (via ALTER TABLE in migrations section) + `lib/kernl/database.ts` (runMigrations)
```sql
ALTER TABLE messages ADD COLUMN parent_id TEXT DEFAULT NULL;
ALTER TABLE messages ADD COLUMN branch_index INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN is_active_branch INTEGER DEFAULT 1;
```
Wrap in try/catch for `duplicate column name` (idempotent migration pattern from Sprint 7A).

**Task 3: EventMetadata types**
New file: `lib/transit/types.ts`
- `EventMetadata` interface (§2.3 — id, event_type, timestamp, message_id, conversation_id, payload, tags, annotations, learning_status, schema_version)
- `EventCategory` union type
- `EventTypeDefinition` interface (§4.3)
- `MarkerShape`, `MarkerSize` types

**Task 4: Event registry config**
New file: `lib/transit/registry.ts`
- Load initial event type definitions from a static config object (not a separate file — keep it simple)
- Include all event types from §2.2 (flow.*, quality.*, system.*, context.*, cognitive.*)
- `getEventType(id: string): EventTypeDefinition | undefined`
- `getAllEventTypes(): EventTypeDefinition[]`
- `getEventTypesByCategory(category: EventCategory): EventTypeDefinition[]`

**Task 5: Event writer helper**
New file: `lib/transit/capture.ts`
- `captureEvent(event: Omit<EventMetadata, 'id' | 'timestamp' | 'schema_version'>): string` — writes to conversation_events, returns event_id
- Uses nanoid for id generation
- Validates event_type exists in registry (warn but don't block if unknown)
- Fail-open: capture errors are logged, never block the chat flow

**Task 6: Capture hook — flow.message**
File: `app/api/chat/route.ts`
After `addMessage()` call, fire `captureEvent()` with:
- event_type: `flow.message`
- payload: `{ role, token_count, model, latency_ms }`
- message_id: the just-persisted message ID
- conversation_id: active thread ID

**Task 7: Capture hooks — quality events**
Files: `components/chat/ChatInterface.tsx`
- `quality.interruption` — in stop button handler, capture `{ partial_content_length, tokens_generated_before_stop, time_to_interrupt_ms }`
- `quality.regeneration` — in regenerate handler (Cmd+R), capture `{ original_message_id }`
- `quality.edit_resend` — in edit handler (Cmd+E), capture `{ original_prompt_length, edited_prompt_length }`
All fire-and-forget (don't block UI).

**Task 8: Verify and commit**
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm test:run` — all passing
- [ ] New tests: event capture write + read, registry lookup, tree column migration
- [ ] Manual: send a message, verify conversation_events row created in DB
- [ ] Commit: `feat: Sprint 11.2 — Transit Map data foundation (events table, tree columns, capture hooks)`

---

## SPRINT 11.3 — TRANSIT MAP PHASE B: SCROLLBAR LANDMARKS

**Goal:** First visible Transit Map feature — colored ticks on the scrollbar showing conversation structure.
**Estimated tasks:** 6
**Prerequisite:** Sprint 11.2 (conversation_events table + capture hooks)
**Spec reference:** TRANSIT_MAP_SPEC.md §3.4, §5

**Task 1: CustomScrollbar component**
New file: `components/chat/CustomScrollbar.tsx`
- Renders as an overlay on the native scrollbar track area
- Queries conversation_events for the active thread
- Calculates landmark positions: `landmark_y = (message_index / total_messages) * scrollbar_height`
- Thin horizontal colored lines, `pointer-events: none`
- Tooltip on hover (thin hit area)

**Task 2: Scrollbar landmark config**
File: `lib/transit/registry.ts` — extend EventTypeDefinition with scrollbar config
Each event type can specify: `{ enabled: boolean, color: string, height: number, opacity: number }`
Wire the initial config from §3.4 (topic_shift = cyan, artifact = teal, interruption = red, gate = amber, etc.)

**Task 3: Wire CustomScrollbar into MessageList**
File: `components/chat/MessageList.tsx`
- Position CustomScrollbar as an overlay on the scroll container
- Pass active thread ID + message count
- Re-render landmarks on message list changes

**Task 4: Capture hook — flow.topic_shift**
New file: `lib/transit/topic-detector.ts`
- After each user message, compare embedding similarity with previous user message
- If similarity < threshold (start with 0.6, tunable): fire `flow.topic_shift` event
- payload: `{ similarity_score, inferred_topic_label }` (label = first 50 chars of new message as placeholder)
- Uses existing `embedText()` from `lib/embeddings/model.ts`

**Task 5: Capture hooks — cognitive + system events**
- `cognitive.artifact_generated` — in artifact detector (`lib/artifacts/detector.ts`), after successful detection
- `system.gate_trigger` — in `lib/decision-gate/index.ts` after `analyze()` detects a trigger
Both fire-and-forget via `captureEvent()`.

**Task 6: Verify and commit**
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm test:run` — all passing
- [ ] Manual: send several messages, trigger a topic shift, verify colored ticks appear on scrollbar
- [ ] Performance: <500 messages renders all landmarks; >500 should cluster (note for future)
- [ ] Commit: `feat: Sprint 11.3 — Transit Map scrollbar landmarks`

---

## SPRINT 11.4 — TRANSIT MAP PHASE C: Z3 DETAIL ANNOTATIONS

**Goal:** Per-message metadata overlay — model badge, token count, cost, latency, event markers.
**Estimated tasks:** 6
**Prerequisite:** Sprint 11.2 (event metadata stored per message)
**Can parallel with:** Sprint 11.3
**Spec reference:** TRANSIT_MAP_SPEC.md §3.7

**Task 1: Message metadata display**
File: `components/chat/Message.tsx`
Add subtle inline metadata below each assistant message:
- Model badge (small pill: "sonnet" / "haiku" / "opus")
- Token count (input + output)
- Cost (4 decimal places)
- Latency (ms)
Read from message metadata or from conversation_events for that message_id.

**Task 2: Event marker rendering**
File: `components/chat/Message.tsx` or new `components/transit/EventMarkers.tsx`
- Query conversation_events for the message_id
- Render marker icons per category (§3.2): ● flow, ◆ quality, ■ system, ▲ context, ⬡ cognitive
- Color by severity: green/frost/amber/red/cyan
- Stacked vertically if multiple events on same message

**Task 3: Event detail panel**
New file: `components/transit/EventDetailPanel.tsx`
- Click a marker → slide-out or popover showing full event metadata
- Event type name, timestamp, full payload
- Links to related events (e.g., regeneration links to original message)
- Learning status indicator (pending/processed/skipped)

**Task 4: User annotation support**
- Add "Add Note" action to event detail panel
- Writes to `annotations` JSON array on the conversation_events row
- Display annotations inline on the message

**Task 5: Toggle visibility**
Settings or keyboard shortcut to show/hide message metadata overlay. Default: hidden (clean view). Toggle: Cmd+Shift+M or setting in AppearanceSection.

**Task 6: Verify and commit**
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm test:run` — all passing
- [ ] Manual: send messages, verify metadata appears, click markers, add annotation
- [ ] Commit: `feat: Sprint 11.4 — Transit Map Z3 detail annotations`

---

## SPRINT 11.5 — TRANSIT MAP PHASE D: Z2 SUBWAY VIEW

**Goal:** The subway map visualization — named stations, linear route, branch rendering.
**Estimated tasks:** 8
**Prerequisite:** Sprint 11.3 (scrollbar landmarks) + Sprint 11.4 (event markers)
**Spec reference:** TRANSIT_MAP_SPEC.md §3.3, §3.6

**Task 1: Station auto-generation**
New file: `lib/transit/stations.ts`
- Read conversation_events for a thread
- Apply station triggers from registry (§3.3): topic_shift → station, artifact_generated → station, gate_trigger → station, branch_fork → station, session_boundary → station
- Generate station names from payload fields
- Return ordered station list with positions

**Task 2: Subway line renderer**
New file: `components/transit/SubwayMap.tsx`
- SVG or Canvas renderer
- Horizontal layout (default for wide screens)
- Single line with stations spaced proportionally to message count
- Station icons from registry (emoji or SVG)
- Between-station markers for non-station events

**Task 3: Branch rendering**
- Fork visualization: track splits at fork point
- Active branch continues straight, alternatives angle off
- Abandoned branches in gray dashed
- Each branch gets its own stations

**Task 4: Click-to-scroll navigation**
- Click a station → scroll MessageList to that message
- Highlight the target message briefly (flash animation)
- Sync: scrolling in MessageList updates active station in SubwayMap

**Task 5: Manual station creation**
- Right-click any message → "Mark as Landmark"
- Opens a small form: station name + optional icon
- Writes to conversation_events as a manual station event

**Task 6: SubwayMap placement**
- Determine where it lives: dedicated tab, drawer, or overlay
- Wire into ChatInterface layout
- Keyboard shortcut to toggle

**Task 7: Pan and zoom interaction**
- Drag to pan along the route
- Scroll to zoom (toward Z1 or Z3 conceptually, but actual Z1/Z3 transitions in later sprints)

**Task 8: Verify and commit**
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm test:run` — all passing
- [ ] Manual: have a multi-topic conversation, verify stations appear, click to navigate
- [ ] Commit: `feat: Sprint 11.5 — Transit Map Z2 subway view`

---

## SPRINT 11.6 — TRANSIT MAP PHASE E: Z1 SANKEY VIEW

**Goal:** Full conversation topology as a directed flow graph.
**Estimated tasks:** 6
**Prerequisite:** Sprint 11.5 (subway view for zoom transitions)
**Spec reference:** TRANSIT_MAP_SPEC.md §3.5

**Task 1: Sankey data model**
New file: `lib/transit/sankey.ts`
- Group messages into segments (between stations)
- Calculate token volume per segment
- Build directed graph: nodes = segments, edges = flows

**Task 2: Sankey renderer**
New file: `components/transit/SankeyView.tsx`
- D3-based or custom SVG sankey renderer
- Left-to-right flow (time axis)
- Edge width proportional to token volume
- Color reflects dominant quality signal in segment

**Task 3: Branch visualization**
- Forks shown as flow splitting downward
- Abandoned branches fade to gray
- Active branch highlighted

**Task 4: Sankey interaction**
- Hover segment → tooltip with metrics (message count, tokens, cost, model)
- Click segment → zoom to Z2 centered on that segment
- Click fork → highlight both branches

**Task 5: Zoom transitions (Z1 ↔ Z2 ↔ Z3)**
- Smooth continuous zoom (pinch/scroll)
- Cmd+0 = Z2 (default), Cmd+- = toward Z1, Cmd+= = toward Z3
- Transition animations between zoom levels

**Task 6: Verify and commit**
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm test:run` — all passing
- [ ] Manual: long conversation with branches, verify sankey renders, zoom transitions work
- [ ] Commit: `feat: Sprint 11.6 — Transit Map Z1 sankey view`

---

## SPRINT 11.7 — TRANSIT MAP PHASE F: LEARNING ENGINE — ✅ COMPLETE (March 4, 2026)

**Goal:** Recursive self-improvement from conversation telemetry.
**Estimated tasks:** 7 → **SHIPPED: 11 tasks (types + schema + pipeline + 3 detectors + insights + registry + barrel + UI + API + 5 test files)**
**Result:** 148 new tests all passing | TSC clean | 1152/1155 total
**Prerequisite:** Sprint 11.2 (events table with captured data)
**Can start after:** 11.2 (doesn't need UI sprints)
**Spec reference:** TRANSIT_MAP_SPEC.md §6

**Task 1: Learning pipeline infrastructure**
New file: `lib/transit/learning/pipeline.ts`
- Batch processor: query conversation_events WHERE learning_status = 'pending' AND learnable = true
- Run on session end or on schedule (configurable)
- Mark processed events as `learning_status: 'processed'`

**Task 2: Pattern detector — verbosity**
New file: `lib/transit/learning/verbosity.ts`
- Analyze `quality.interruption` events
- Pattern: "Responses over N tokens on topic X get interrupted M% of the time"
- Minimum sample: 10 events
- Output: suggested max_tokens adjustment per topic

**Task 3: Pattern detector — regeneration rate**
New file: `lib/transit/learning/regeneration.ts`
- Analyze `quality.regeneration` events
- Pattern: "First response on [task type] gets regenerated N% of the time"
- Minimum sample: 10 events
- Output: quality flags for task types with high regen rates

**Task 4: Insight generator**
New file: `lib/transit/learning/insights.ts`
- Receives patterns from detectors
- Assigns confidence score (0-100%)
- Below 70%: flag as experimental, don't auto-apply
- Store in `learning_insights` table (new)

**Task 5: Human approval gate**
- Insights that would modify system prompts or model routing surface to David
- UI: InsightReviewPanel in Inspector drawer
- Approve → apply, Dismiss → mark skipped, Rollback → revert to before

**Task 6: Insight registry with rollback**
New file: `lib/transit/learning/registry.ts`
- Every applied insight logged with before/after state
- One-click rollback from InsightReviewPanel
- 90-day decay: insights without reconfirmation fade to experimental

**Task 7: Verify and commit**
- [x] `npx tsc --noEmit` — 0 errors (Sprint 11.7 files)
- [x] `pnpm test:run` — 1152/1155 passing (148 new, all green)
- [x] Tests: pipeline, verbosity, regeneration, insights, registry (5 files, 148 tests)
- [x] Commit: `feat: Sprint 11.7 — Transit Map learning engine`

---

## SPRINT 12.0 — API COST OPTIMIZATION — ✅ COMPLETE (commit 3ae1f0d)

**Goal:** Reduce Claude API costs through caching, batching, and smart routing.
**Estimated tasks:** 5
**Prerequisite:** None (standalone)
**Can parallel with:** Any sprint

**Task 1: Prompt caching**
File: `app/api/chat/route.ts` + `lib/bootstrap/context-builder.ts`
- Use Anthropic's prompt caching API for the system prompt (bootstrap context + KERNL injection)
- System prompt is ~2-4K tokens and changes rarely — 90% savings on repeated context
- Add `cache_control` headers to system message blocks

**Task 2: Batch API for Agent SDK**
File: `lib/agent-sdk/executor.ts`
- Non-urgent jobs (scheduled scans, background tasks) use Anthropic's batch API
- 50% cost discount, results returned asynchronously
- Add `batch: boolean` option to manifest config
- Queue batch jobs, poll for completion

**Task 3: Smart Haiku routing**
File: `app/api/chat/route.ts` + `lib/agent-sdk/query.ts`
- Classification tasks use Haiku instead of Sonnet: auto-title, decision gate triggers, Ghost summaries
- Already partially done (decision gate uses Haiku) — extend to other classification points
- Model selection in manifest config

**Task 4: Cost monitoring dashboard**
File: `components/costs/CostDashboard.tsx` (extends existing cost breakdown)
- Show cached vs uncached token breakdown
- Batch vs real-time cost comparison
- Projected monthly spend at current rate

**Task 5: Verify and commit**
- [ ] Verify prompt caching reduces system prompt costs
- [ ] Verify batch API works for background jobs
- [ ] Commit: `feat: Sprint 12.0 — API cost optimization (caching, batch, Haiku routing)`

---

## EXECUTION SUMMARY

| Sprint | Name | Tasks | Dependencies | Status |
|--------|------|-------|-------------|--------|
| 11.0 | Cleanup & Verification | 8 | None | ✅ COMPLETE (5cb2420) |
| 11.1 | Agent SDK Stubs | 6 | None | ✅ COMPLETE (5cb2420) |
| 11.2 | Transit Map A: Data | 8 | 11.0 | ✅ COMPLETE (37d60af) |
| 11.3 | Transit Map B: Scrollbar | 6 | 11.2 | READY — can parallel with 11.4 |
| 11.4 | Transit Map C: Z3 Detail | 6 | 11.2 | READY — can parallel with 11.3 |
| 11.5 | Transit Map D: Subway | 8 | 11.3 + 11.4 | Blocked on 11.3+11.4 |
| 11.6 | Transit Map E: Sankey | 6 | 11.5 | Blocked |
| 11.7 | Transit Map F: Learning | 7 | 11.2 | READY — can parallel with 11.3–11.6 |
| 12.0 | Cost Optimization | 5 | None | ✅ COMPLETE (3ae1f0d) |

**Total remaining tasks:** ~60
**Critical path:** 11.0 → 11.2 → 11.3/11.4 → 11.5 → 11.6
**Max parallelism:** 3 simultaneous sprints (11.0 + 11.1 + 12.0, then 11.3 + 11.4 + 11.7)
