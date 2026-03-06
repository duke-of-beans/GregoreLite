# GREGLITE — FEATURE BACKLOG
# Updated: March 5, 2026
# Purpose: Ground-truth gap analysis. What's actually missing vs what's built.
# Source: Codebase audit (March 4, 2026), Gregore Audit (Sprint 15.1, March 5, 2026)
# Gregore Audit: D:\Projects\GregLite\GREGORE_AUDIT.md
# Sprint Roadmap: SPRINT_ROADMAP.md

---

## STATUS KEY
- ✅ SHIPPED — In codebase, tested, working
- 🔧 CSS READY — Animation/style exists in globals.css, needs wiring to components
- ❌ MISSING — Zero implementation
- 🔜 NEXT — Ready to build, brief exists

---

## ACTIVE SPRINTS

- 🔜 Sprint 15.2 — Voice, Help & Jargon Audit (brief ready, depends on 15.1 ✅)
- 🔜 Sprint 16.0 — AEGIS Embed Option A (brief ready, independent)

---

## GREGORE PORT — Patterns & Features (from GREGORE_AUDIT.md)

### P0 — Must Have for Daily Driver

#### Receipt Footer (per-message orchestration details) ❌
Source: GREGORE_AUDIT.md §2 Pattern 1, Gregore UI_UX_FINAL_DIRECTION.md Part 2.3
Every assistant message gets a collapsed footer: "✓ $0.002 · 234ms · sonnet-4"
Click to expand: model, tokens in/out, cost, latency, cache hit status
Data available since Sprint 15.0 (chat costs written to session_costs)
User preference: full / compact / minimal / hidden (ui-store)
Animation: `receipt-expand` 150ms ease-out (not yet in globals.css)
Enforces Sacred Law 6 (Transparency) at the message level
Sprint estimate: 4-5 tasks

#### Orchestration Theater (first 3-5 messages) ❌
Source: GREGORE_AUDIT.md §2 Pattern 4, Gregore DESIGN_SYSTEM.md §5
First 5 messages for a NEW USER auto-expand receipt footers to show the system's intelligence
After message 5: prompt user for receipt preference (full/compact/minimal/hidden)
Prevents "how is this different from ChatGPT?" confusion
Depends on: Receipt Footer
Sprint estimate: 2-3 tasks (small, ships with Receipt Footer)

#### Voice System / Copy Templates ❌
Source: GREGORE_AUDIT.md §1 (Brand Voice)
Create `lib/voice/copy-templates.ts` with standardized message copy
Voice: deadpan professional, data-forward, sardonic, never cutesy
Covers: error messages, gate warnings, status text, receipt labels, empty states, tooltips
Sprint 15.2 handles the jargon audit; this is the template SYSTEM underneath
Sprint estimate: 3-4 tasks

### P1 — Should Have

#### Ghost Pulse (input border animation) 🔧 CSS READY
Source: GREGORE_AUDIT.md §2 Pattern 2, Gregore DESIGN_SYSTEM.md §3+§4
`@keyframes ghost-pulse` EXISTS in globals.css — 1s ease-in-out cyan cycle
`.ghost-analyzing` CSS class EXISTS
NOT WIRED: ChatInterface.tsx input field never applies the class
Fix: add `.ghost-analyzing` className to input when decision gate is analyzing
Sprint estimate: 1 task (CSS wiring only)

#### Memory Shimmer (real-time context reveals on typing) 🔧 CSS READY → ❌ Feature Missing
Source: GREGORE_AUDIT.md §2 Pattern 3, Gregore DESIGN_SYSTEM.md §3+§4
`@keyframes shimmer` EXISTS in globals.css — 2s text-shadow cyan glow cycle
`.memory-match` CSS class EXISTS with hover underline
NOT WIRED: no component applies the class
FEATURE MISSING: real-time keystroke → KERNL FTS5 query → highlight matching tokens in input
Architecture: debounced input handler (300ms) → query KERNL `messages_fts` + `content_chunks` → identify matching terms → apply `.memory-match` spans → click span expands memory card with source conversation
Existing infrastructure: KERNL FTS5 index, Cross-Context Engine (Phase 3), Ghost scorer (Phase 6E)
This is Gregore's most distinctive UX moment — "the AI remembering in real-time"
Sprint estimate: 6-8 tasks (significant integration work)

#### Adaptive Override System (three-choice decision gate) ❌
Source: GREGORE_AUDIT.md §2 Pattern 5, Gregore UI_UX_FINAL_DIRECTION.md Part 3
Current gate is binary: dismiss or address
Gregore spec: three choices per warning:
  1. "Just this once" → no pattern learned
  2. "Always allow [category]" → creates override policy
  3. "Never warn about this" → creates broad category policy
Ghost learns from choices — policies stored in SQLite
Policy management: Settings > Decision Gate > Override Policies
Sprint estimate: 6-8 tasks

#### Send Button State System ❌
Source: GREGORE_AUDIT.md §2 Pattern 6, Gregore DESIGN_SYSTEM.md §3
5 visual states: normal (cyan) → checking (animated) → approved (green tint) → warning (amber) → veto (red)
Each state has distinct ARIA labels
Wire to decision gate state machine
Currently: static cyan button or disabled
Sprint estimate: 3-4 tasks

#### Inspector Drawer Reorganization ❌
Source: GREGORE_AUDIT.md §2 Pattern 7
Current tabs: Thread / Quality / KERNL / Jobs / EoS / Learning
Proposed: Memory (KERNL+Ghost) / Quality (EoS+thread) / Cost (breakdown+trends) / Jobs / Learning
Tab rename + content reorganization, not rebuild
Sprint estimate: 3-4 tasks

### P2 — Nice to Have

#### Glassmorphic Inspector Drawer ❌
Source: Gregore DESIGN_SYSTEM.md §3 (Inspector Drawer)
Current: solid background
Gregore spec: `rgba(10, 14, 20, 0.95)` with `backdrop-filter: blur(12px)`, cyan border glow
Sprint estimate: 1-2 tasks (CSS only)

#### Message Fade-In Animation ❌
Source: GREGORE_AUDIT.md §5
Current: approximate opacity transition via Tailwind
Gregore spec: precise 200ms ease-out fade-in for new messages
Sprint estimate: 1 task

#### Spring Animations (Framer Motion) ❌
Source: Gregore DESIGN_SYSTEM.md §4
Gregore specifies spring physics for drawers, modals, card lifts, button presses
GregLite uses CSS transitions (works but feels more mechanical)
framer-motion IS in dependencies — just not used for these interactions
Sprint estimate: 3-4 tasks

---

## SACRED LAWS GAPS (from GREGORE_AUDIT.md §3)

### Fully Enforced (no action needed)
- ✅ Law 1: Append-Only Events (SQLite INSERT-only)
- ✅ Law 4: Quality Gates (decision gate + EoS)
- ✅ Law 7: Small Context Windows (multi-tab threading)
- ✅ Law 9: Outcomes Win (Option B Perfection culture)
- ✅ Law 11: Evidence Required (evidence-based detection)

### Partially Enforced (mechanism exists, awareness doesn't)
- ⚠️ Law 3: Reversibility — agent tool calls have no undo path
- ⚠️ Law 5: Protect Deep Work — no user focus state awareness
- ⚠️ Law 6: Transparency — no per-message receipt (Receipt Footer fixes this)
- ⚠️ Law 10: Attention is Scarce — good defaults, no active budget management
- ⚠️ Law 12: Ghost Veto — gate blocks debt language but doesn't check other Sacred Laws

### Not Implemented (low priority for GregLite scope)
- ❌ Law 2: Earned Autonomy — no progressive trust infrastructure
- ❌ Law 8: Claims Age — no claim extraction or confidence decay

---

## DESIGN TOKEN GAPS (from GREGORE_AUDIT.md §4)

- ❌ Background layer tokens: `--bg-tertiary`, `--bg-elevated` (using hardcoded Tailwind values instead)
- ❌ Status color tokens: `--success`, `--warning`, `--error`, `--info` as CSS custom properties
- ❌ Ghost transparency token: `--cyan-ghost` (cyan at 8% opacity)
- ❌ Semantic spacing tokens: `--message-gap`, `--section-gap`, `--component-padding`
- ❌ GregLite typography scale for dense components: xs 11px, sm 13px, base 14px

---

## SKIP LIST — Do NOT Port from Gregore

Source: GREGORE_AUDIT.md §6

- ❌ Multi-Model Consensus / Council Synthesis (GregLite is Claude-only)
- ❌ Triptych Layout / Cognitive Cockpit (killed Jan 2, 2026)
- ❌ Biological Metaphors ("membrane," "organs," "seam")
- ❌ GLACIER Long-Term Memory System (KERNL is sufficient)
- ❌ Homeostasis / Self-Model / World-Model Systems (Phase 3+ territory)
- ❌ ENGINE-E Anti-Gravity / Novelty Injection
- ❌ ENGINE-I Cognitive Metabolism (irrelevant for single-model)
- ❌ Gamification of Any Kind ("This isn't Duolingo")

---

## COMPLETED SPRINTS (reverse chronological)

### Sprint 15.1 (commit pending) — Gregore Audit
- ✅ GREGORE_AUDIT.md — 7-section port recommendation document

### Sprint 15.0 (commit pending) — Bug Fixes & Quick Wins
- ✅ Cost counter fix (chat route writes to session_costs)
- ✅ Decision gate false positive ('for now' removed, scan window tightened)
- ✅ Collapsible thinking/tool call blocks
- ✅ Tool call visual distinction (monospace, border, pill badge)

### Sprint 14.0 (commit 983c5de) — Production Readiness
- ✅ 3 pre-existing test failures fixed (1210/1210)
- ✅ 8 dead dependencies removed
- ✅ React ErrorBoundary with recovery UI
- ✅ 6 API routes standardized with safeHandler
- ✅ DB corruption detection/recovery
- ✅ Version consistency (1.1.0)

### Sprint 13.0 (commit b825ebb) — Transit Map UX/UI Polish
- ✅ 16 new CSS variables (dark + light mode)
- ✅ 13 transit components: color tokens, typography, spacing, interactions, accessibility
- ✅ Transit-specific CSS classes + animations

### Sprint 11.6 (commit d646a68) — Transit Map Phase E: Z1 Sankey View
- ✅ Transit Map COMPLETE (all 6 phases shipped)

### Sprint 11.4+11.5 (commit dc188fd) — Z3 Annotations + Z2 Subway View
### Sprint 11.7 (commit 4b2382d) — Learning Engine
### Sprint 11.3 (commit 7c08d9f) — Scrollbar Landmarks
### Sprint 11.2 (commit 37d60af) — Transit Map Data Foundation
### Sprint 11.0+11.1 (commit 5cb2420) — Cleanup + Agent SDK Stubs
### Sprint 12.0 (commit 3ae1f0d) — API Cost Optimization
### Phase 9 (commit ac634bd) — The Full Cockpit (v1.1.0)
### Phase 8 (git tag v1.0.0) — Ship Prep
### Phases 1-7 — Foundation through Self-Evolution

---

## RECOMMENDED SPRINT SEQUENCE (from GREGORE_AUDIT.md §7, updated)

| Order | Sprint | Scope | Depends On | Estimate |
|-------|--------|-------|------------|----------|
| NOW | 15.2 | Voice, Help & Jargon Audit | 15.1 ✅ | 8 tasks |
| NOW | 16.0 | AEGIS Embed (Option A) | Independent | 7 tasks |
| NEXT | 17.0 | Receipt Footer + Orchestration Theater + Ghost Pulse wiring | 15.2 | 8-10 tasks |
| THEN | 18.0 | Memory Shimmer (real-time context reveals) | 17.0 | 6-8 tasks |
| THEN | 19.0 | Decision Gate Enhancement (3-choice + Send Button states) | 17.0 | 8-10 tasks |
| THEN | 20.0 | Inspector Reorg + Design Token Cleanup + Animation Polish | Any | 8-10 tasks |
