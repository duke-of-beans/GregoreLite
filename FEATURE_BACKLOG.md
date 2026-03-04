# GREGLITE — FEATURE BACKLOG
# Updated: March 4, 2026
# Purpose: Ground-truth gap analysis. What's actually missing vs what's built.
# Source: Codebase audit (March 4, 2026) + TRANSIT_MAP_SPEC.md + manual testing
# Sprint Roadmap: SPRINT_ROADMAP.md

---

## STATUS KEY
- ✅ SHIPPED — In codebase, tested, working
- ⚠️ STUB — Code exists but returns NOT_IMPLEMENTED or placeholder
- ❌ MISSING — Zero implementation despite being in spec or claimed shipped
- 🔧 BROKEN — Exists but has known issues

---

## BUCKET A — CLEANUP & VERIFICATION (Sprint 11.0)

### A1 — Phase 8 File Verification [P1]
BLUEPRINT_FINAL.md claims Phase 8 shipped: NSIS installer, tauri-plugin-updater, first-run onboarding wizard, security hardening (execSync→execFileSync, HMAC auth, OS keychain). No Phase 8 commits visible in git log between Phase 7 (9b5789d) and Phase 9 (ac634bd). Needs targeted file audit to confirm what actually exists.

### A2 — Dead Route Consolidation [P1]
Two pairs of duplicate routes serve the same data:
- `/api/conversations` (ConversationRepository) + `/api/threads` (KERNL) — threads is correct, conversations should be removed or redirected
- `/api/jobs` + `/api/agent-sdk/jobs` — need to determine which is canonical and remove the other

### A3 — Decision Gate Dead Stubs [P2]
`trigger-detector.ts` has 3 functions marked `[STUB — Sprint 4B]`: `detectHighTradeoff()`, `detectMultiProject()`, `detectLargeEstimate()`. Sprint 4B's Haiku inference path in `analyze()` replaced these. The stubs are dead code — clean up.

### A4 — Stale Comments Audit [P3]
Multiple files reference "Sprint 7G" or "Sprint 4B" on work that's already complete. Comments like `// stub — Phase 7G implements this` on `detectShimLoop()` which is still a stub should be updated to reflect actual status.

---

## BUCKET B — AGENT SDK STUB COMPLETION (Sprint 11.1)

### B1 — test_runner Tool [P2] ⚠️ STUB
`tool-injector.ts` line 106. Returns NOT_IMPLEMENTED. Should run vitest and capture structured results (pass/fail count, failures list).

### B2 — shim_readonly_audit Tool [P2] ⚠️ STUB
`tool-injector.ts` line 124. Returns NOT_IMPLEMENTED. Should run EoS scan on target path without modifications, return score + issues.

### B3 — markdown_linter Tool [P3] ⚠️ STUB
`tool-injector.ts` line 139. Returns NOT_IMPLEMENTED. Should lint markdown files, return violation list.

### B4 — kernl_search_readonly Tool [P2] ⚠️ STUB
`tool-injector.ts` line 154. Returns NOT_IMPLEMENTED. Should search KERNL FTS index read-only, return matching context.

### B5 — detectShimLoop() [P2] ⚠️ STUB
`failure-modes.ts` line 107. Always returns false. Spec: 3 consecutive SHIM calls on same file with no score improvement → BLOCKED state + escalation to strategic thread.

---

## BUCKET C — TRANSIT MAP (Sprints 11.2–11.7) ❌ MISSING

Full spec: TRANSIT_MAP_SPEC.md (829 lines). Zero implementation exists despite Sprint 10.6 claiming "data foundation shipped."

### C1 — Phase A: Data Foundation (Sprint 11.2) ❌
- `conversation_events` table in KERNL schema (§4.1)
- `parent_id`, `branch_index`, `is_active_branch` columns on messages (§4.2)
- EventMetadata TypeScript types + write helper (§2.3)
- Event registry config file (§4.3)
- Capture hooks: flow.message, quality.interruption, quality.regeneration, quality.edit_resend (§4.4)

### C2 — Phase B: Scrollbar Landmarks (Sprint 11.3) ❌
- CustomScrollbar component reading from conversation_events (§5.1)
- Landmark rendering — colored ticks on scrollbar track (§5.2)
- Capture hooks: flow.topic_shift (embedding comparison), cognitive.artifact_generated, system.gate_trigger (§4.4)

### C3 — Phase C: Z3 Detail Annotations (Sprint 11.4) ❌
- Per-message inline metadata: model badge, token count, cost, latency (§3.7)
- Event marker rendering on messages (§3.2)
- Event detail panel on marker click
- User annotation support

### C4 — Phase D: Z2 Subway View (Sprint 11.5) ❌
- Station auto-generation from events (§3.3)
- Subway line renderer (horizontal, with markers) (§3.6)
- Branch rendering — fork/merge visualization (§3.1)
- Click-to-scroll navigation from stations to messages
- Manual station creation (right-click → "Mark as Landmark")

### C5 — Phase E: Z1 Sankey View (Sprint 11.6) ❌
- Sankey flow graph renderer (§3.5)
- Token volume → edge width mapping
- Quality color coding on segments
- Zoom transition animations (Z1 ↔ Z2 ↔ Z3)

### C6 — Phase F: Learning Engine (Sprint 11.7) ❌
- Batch processor for learnable events (§6.1)
- Pattern detector — verbosity calibration, regeneration rate, model routing (§6.2)
- Insight generator with confidence scoring (§6.3)
- Human approval gate for system prompt modifications
- Insight registry with rollback support

---

## BUCKET D — COST OPTIMIZATION (Sprint 12.0)

### D1 — Prompt Caching [P2]
90% savings on repeated context (bootstrap system prompt, KERNL context). Anthropic API supports this natively.

### D2 — Batch API [P3]
50% discount for non-urgent Agent SDK jobs. Queue non-critical jobs for batch processing.

### D3 — Smart Haiku Routing [P2]
Use Haiku for classification tasks (decision gate triggers, auto-title, Ghost summaries) instead of Sonnet. Already partially done for decision gate Haiku inference.

---

## COMPLETED — Phase 9 (all items shipped, verified in codebase)

The following items from the original backlog were ALL shipped in Phase 9 (22 sprints):

- ✅ A1 — Command Palette (Cmd+K) — CommandPalette.tsx, fuzzy search, command registry
- ✅ A2 — Notification Display — ToastStack, NotificationBell, all events wired
- ✅ A3 — Status Bar — cost/jobs/AEGIS/KERNL live polling
- ✅ A4 — Settings Panel (Cmd+,) — theme, budget caps, AEGIS, Ghost cadence
- ✅ A5 — Inspector Drawer (Cmd+I) — 5 tabs: Thread/KERNL/Quality/Jobs/Costs
- ✅ A6 — Chat History Panel (Cmd+[) — search, load thread, pin/archive
- ✅ A7 — Edit Last Message / Regenerate (Cmd+E / Cmd+R) — hover actions, truncate API
- ✅ A8 — Memory Modal — DEPRECATED (Cmd+M removed, Cmd+K search + Cmd+D decision browser covers it)
- ✅ B1 — Multi-Thread Tabs (Cmd+N) — per-tab Zustand state isolation, ThreadTabBar
- ✅ B2 — Decision Browser (Cmd+D) — filter, FTS, markdown export, thread links
- ✅ C1 — Morning Briefing — auto-generated from KERNL, once per day, 6 sections
- ✅ C2 — Ghost Teach Me — ghost_preferences table, scorer boost_factor, Privacy Dashboard Preferences tab
- ✅ C3 — Push Notifications / Tray — tauri-plugin-notification, Windows native toasts, tray icon + badge
- ✅ C4 — Manifest Templates — save-as-template, template picker, quick-spawn from Workers tab
- ✅ C5 — Artifact Library (Cmd+L) — cross-session browse, filter by type/language/project, re-attach
- ✅ C6 — In-Thread Search (Cmd+F) — client highlight, server-side FTS5 fallback
- ✅ C7 — EoS Sparkline — SVG trend from eos_reports, delta, color thresholds, EoSHistoryPanel
- ✅ C8 — Cost Breakdown by Project — today/week/all tabs
- ✅ C9 — Job Retry/Edit — Edit & Retry on failed jobs, ManifestBuilder pre-fill, superseded status
- ✅ C10 — KERNL Health Panel — full DB stats in Inspector KERNL tab
- ✅ C11 — Project Quick-Switcher — context panel popover + command palette registration

## COMPLETED — Sprint 10.x (all items shipped)

- ✅ SSE streaming, flat messages, density toggle, auto-scroll, thinking indicators
- ✅ Collapsible blocks, stop button, scrollbar landmarks, sidebar consolidation
- ✅ Cost display 4dp, branding consistency, anti-bootstrap prompt
- ✅ ChatSidebar hydration fix, API 500 fixes, dev mode API fix
- ✅ Gregore logo in header/favicon/tray, auto-title
- ✅ Database unification (getDatabase auto-init, /api/threads route)
- ✅ Settings gear icon, AppearanceSection density selector
- ✅ Thread rename/delete, decision dismiss, context panel hierarchy
- ✅ Light mode CSS, ThemeSync DOM wiring
- ✅ War Room firstTick fix, StatusBar event wiring, 404 route stubs
- ✅ Collapsed panel caret position, context-provider poll noise reduction
