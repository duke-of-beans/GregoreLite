# GREGORE AUDIT — Port Recommendations for GregLite

**Version:** 1.0.0
**Date:** March 5, 2026
**Sprint:** 15.1 (Research)
**Author:** Claude (Opus) for David Kirsch
**Sources:** 20+ Gregore docs (UI_UX_FINAL_DIRECTION, DESIGN_SYSTEM, SACRED_LAWS, PRODUCT_VISION, ARCHITECTURE, 9 systems, 9 engines, synthesis, council synthesis, UI_UX_ARCHAEOLOGY)

---

## Section 1: Brand Voice

Gregore's personality is defined across multiple documents — never in a single "voice guide" file. The strongest articulations come from PRODUCT_VISION.md, the multi-LLM council synthesis (councilsynth1_ui-ux.txt), and UI_UX_FINAL_DIRECTION.md. David's own description: **"Deadpan professional, data-forward and approachable, a wise teacher, but also sardonic."**

### Evidence from Docs

**PRODUCT_VISION.md** frames Gregore as a "governor, not a tool." The system has authority — it doesn't ask permission to think, it thinks and reports. This naturally produces a voice that is confident without being arrogant, precise without being cold. The tagline "The Cognitive Operating System — Where all intelligence converges" is aspirational but grounded in capability, not marketing fluff.

**The Council Synthesis** (Gemini, GPT-4o, Claude perspectives) converges on several voice characteristics. Gemini describes the interface as a "Cognitive Exoskeleton" — the system should feel like a natural extension of the user's thinking, not a separate entity demanding attention. GPT-4o identifies four emotional targets by user archetype but all share a common thread: relief over power. Claude's perspective crystallizes this into "People don't want power, they want relief." This means Gregore's voice should convey competence that reduces cognitive load, not complexity that adds to it.

**UI_UX_FINAL_DIRECTION.md** establishes the Grandma/Freelancer/Professional test triad. No biological metaphors ("membrane," "organs"), no jargon in default view, no gamification language. Professional enough to show a client. This eliminates anything cutesy, overly technical, or self-congratulatory from the voice.

**SACRED_LAWS.md** Preamble: *"These laws exist because GREGORE is a governor, not a tool. A tool has no constraints. A governor serves something higher."* This frames the voice as one of principled authority — Gregore doesn't hedge when it knows, doesn't pretend when it doesn't, and treats the user's attention as scarce capital (Law #10).

### Compiled Voice Guide for GregLite

**Tone:** Deadpan professional. Says what it means without decoration. Never enthusiastic, never apologetic. Think senior engineer in a standup — clear, direct, data-first.

**Data Forward:** Leads with evidence, metrics, and specifics. "Cost: $0.002, 234ms, G-score 0.87" not "I think this went well!" Numbers before narrative.

**Approachable Wisdom:** Explains complex decisions in plain language when asked. Doesn't talk down. The Grandma Test applies to voice too — if the explanation requires a glossary, rewrite it.

**Sardonic Edge:** Permitted in error states, decision gate warnings, and self-referential moments. Not sarcasm — wry acknowledgment. Example: a Ghost veto message that says "This request violates Sacred Law 4 (Safety Gates). Cannot generate malware, exploits, or harmful code." is direct, not lecturing. The dryness IS the personality.

**What Gregore Never Does:**
- Uses exclamation marks in system messages
- Says "I'm sorry" or "Unfortunately"
- Uses emoji in primary UI (receipt footers, status bars, system messages)
- Hedges with "I think" or "Maybe" when confidence is high (that's what Greg Gate modes are for)
- Uses biological metaphors (membrane, organs, seam — explicitly killed Jan 2, 2026)
- Gamifies anything (no badges, streaks, achievements — "This isn't Duolingo")

**GregLite Status:** Voice is partially implemented through the decision gate messages and StatusBar copy. Not systematically applied. No voice guide exists in the codebase. Recommend creating `lib/voice/` with standardized copy templates.

---

## Section 2: UI/UX Patterns to Port
### Pattern 1: Receipt Footer (Post-Message Orchestration Details)
**Source:** UI_UX_FINAL_DIRECTION.md Part 2.3, DESIGN_SYSTEM.md §3
**Priority:** P0 — Must Have

Gregore specifies a collapsed receipt footer under every assistant message showing: Ghost validation status, cost, latency, and model used. Click to expand for full orchestration details (Ghost checks, model selection reasoning, confidence score, alternative costs).

**GregLite Status:** MISSING. Messages currently show metadata only when Transit Map Z3 annotations are toggled on (Cmd+Shift+M), and only as a debug-style overlay — not the collapsed/expandable receipt pattern. StatusBar shows aggregate daily cost but not per-message cost. Sprint 15.0 added cost tracking to session_costs, so the data is now available.

**Port Recommendation:** Implement receipt footer in `components/chat/Message.tsx`. Collapsed default: "✓ $0.002 • 234ms • sonnet-4". Expanded: model, tokens, cost, latency, cache hit. No Ghost pre/post validation (GregLite is Claude-only, no multi-model routing to show). Add receipt preference to ui-store: full/compact/minimal/hidden.

### Pattern 2: Ghost Pulse (Ambient Input Border Animation)
**Source:** UI_UX_FINAL_DIRECTION.md Part 2.1, DESIGN_SYSTEM.md §3 (Input Field), §4 (ghost-pulse keyframe)
**Priority:** P1 — Should Have

The input field's bottom border glows with a gentle 1s cyan pulse when the Ghost is analyzing the user's input. This creates ambient awareness that the system is "observing" without demanding attention.

**GregLite Status:** PARTIAL. `globals.css` already defines the `ghost-pulse` keyframe animation (1s ease-in-out infinite, cycling between `--cyan` and `--cyan-bright`). The CSS class `.ghost-analyzing` exists. However, `ChatInterface.tsx`'s input field does not apply this class — the input has a static cyan bottom border. The Ghost context indicator exists (teal eye icon beside input) but is a static badge, not an ambient pulse.

**Port Recommendation:** Wire `ghost-pulse` animation to input field when decision gate is analyzing (between user submit and gate resolution). This is a CSS-only change in `ChatInterface.tsx` — add the `.ghost-analyzing` class conditionally.

### Pattern 3: Memory Shimmer (Inline Context Reveals)
**Source:** UI_UX_FINAL_DIRECTION.md Part 4, DESIGN_SYSTEM.md §3 (Memory Shimmer Effect)
**Priority:** P2 — Nice to Have

As the user types, relevant words shimmer with a 2s cyan text-shadow animation, indicating PARALLAX memory matches. Click to expand a memory card showing the source conversation and usage controls.

**GregLite Status:** PARTIAL. `globals.css` defines the `shimmer` keyframe animation (2s text-shadow cycle) and the `.memory-match` class with hover underline. However, no component applies this class — there is no live memory matching during typing. KERNL integration exists for project-level memory but is not wired to real-time input analysis.

**Port Recommendation:** Defer to Phase 2. Requires real-time semantic search against KERNL on keystroke (debounced), which is architecturally expensive. The CSS foundation is already laid — implementation is the integration work.

### Pattern 4: Orchestration Theater (First 3-5 Messages)
**Source:** UI_UX_FINAL_DIRECTION.md Part 5, DESIGN_SYSTEM.md §5
**Priority:** P1 — Should Have

The first 3-5 messages in a new conversation show full orchestration detail — Ghost checks, model routing, cost, confidence — to demonstrate what Gregore does differently. After message 5, prompt the user: "How much detail going forward?" with Full/Compact/Minimal/Hidden options.

**GregLite Status:** MISSING. No first-run orchestration experience. New conversations start with a plain chat interface. The onboarding flow (`components/onboarding/`) handles API key and KERNL setup but doesn't demonstrate the system's intelligence.

**Port Recommendation:** Implement as a message count check in `ChatInterface.tsx`. For the first 5 messages per new user (not per conversation), render expanded receipt footers automatically. After message 5, show a preference prompt. Store preference in ui-store alongside the existing `defaultCollapseToolBlocks`.

### Pattern 5: Adaptive Override System (Three-Choice Pattern)
**Source:** UI_UX_FINAL_DIRECTION.md Part 3, DESIGN_SYSTEM.md §5
**Priority:** P1 — Should Have

Every Ghost/Decision Gate warning presents three choices: (1) Just this once, (2) Always allow [category], (3) Never warn about this. Ghost learns from choices and creates override policies. Policies manageable in Settings > Ghost > Override Policies.

**GregLite Status:** PARTIAL. The decision gate (`lib/decision-gate/`) fires warnings and has a lock/dismiss mechanism. The `GatePanel.tsx` component shows the warning with a dismiss button. But there is no three-choice pattern — dismissal is binary (dismiss or address). No override policies exist. No policy learning. The gate doesn't differentiate between "just this once" and "always allow."

**Port Recommendation:** Extend `GatePanel.tsx` with three-choice UI. Add `lib/decision-gate/override-policies.ts` with policy storage (SQLite, not localStorage). Wire policy checks into `trigger-detector.ts` — if an active policy covers the detected pattern, auto-allow with transparency note in the receipt footer.

### Pattern 6: Send Button State System
**Source:** UI_UX_FINAL_DIRECTION.md Part 2.2, DESIGN_SYSTEM.md §3 (Send Button)
**Priority:** P2 — Nice to Have

Send button transforms through 5 states: normal (cyan), checking (animated loader), approved (green tint), warning (amber), veto (red). Each state has distinct visual treatment and ARIA labels.

**GregLite Status:** PARTIAL. The input field has a send button that disables during streaming. The decision gate blocks submission with a 423 status. But the button doesn't visually transform — it's always the same cyan button or disabled. No checking/approved/warning/veto states.

**Port Recommendation:** Create a `SendButton` component with the 5-state system. Wire to decision gate state: gate analyzing → checking, gate clear → approved (brief), gate warning → warning, gate veto → veto. Low effort, high visual impact.

### Pattern 7: Inspector Drawer Tabs
**Source:** UI_UX_FINAL_DIRECTION.md Part 1.2, DESIGN_SYSTEM.md §3
**Priority:** P1 — Should Have

Inspector drawer (Cmd+I) should contain tabs: Memory, Intent, Cost, State. Currently GregLite has an InspectorDrawer but with different tabs.

**GregLite Status:** PARTIAL. `components/inspector/InspectorDrawer.tsx` exists with 6 tabs: Thread, Quality, KERNL, Jobs, EoS, Learning. These map roughly to Gregore's concept but with different organization. Missing: dedicated Memory tab (KERNL tab covers some), Intent tab (no equivalent), dedicated Cost tab (CostBreakdown modal exists separately).

**Port Recommendation:** Reorganize inspector tabs to match Gregore's mental model while keeping GregLite-specific tabs. Proposed: Memory (KERNL search + Ghost context), Quality (EoS + thread quality), Cost (breakdown + trends), Jobs (active workers), Learning (insights). This is a tab rename + reorganization, not a rebuild.

---

## Section 3: Sacred Laws Audit
Gregore defines 12 Sacred Laws in `docs/SACRED_LAWS.md`. Each law is immutable — "non-negotiable constraints that cannot be overridden by any subsystem, user preference, or optimization pressure." This section audits each law against GregLite's current enforcement.

**Law 1: Append-Only Events** — *"No event, memory, or decision may be deleted or retroactively modified."*
GregLite Status: ENFORCED. SQLite stores messages, session_costs, and decision gate events as INSERT-only rows. No DELETE or UPDATE operations exist in the chat or agent pipelines. The thread store appends messages; there is no edit-message or delete-message feature. Verdict: compliant.

**Law 2: Earned Autonomy** — *"Autonomous actions require demonstrated competence over time."*
GregLite Status: NOT APPLICABLE (yet). GregLite has no autonomous action pipeline — all operations are user-initiated chat or explicit agent SDK tool calls. The decision gate is the closest enforcement mechanism (blocks risky patterns), but earned autonomy implies progressive trust-building over sessions. When agent capabilities expand (file writes, code execution without confirmation), this law becomes critical. Verdict: no violation, but no infrastructure either.

**Law 3: Reversibility** — *"Every action must have a defined undo path before execution."*
GregLite Status: PARTIALLY ENFORCED. Agent SDK tool calls don't have explicit undo paths — if an agent writes a file, there's no automated rollback. The decision gate blocks certain actions but doesn't define undo for approved actions. Chat messages are append-only (Law 1), which is inherently non-destructive. Verdict: compliant for chat, gap for agent tool execution.

**Law 4: Quality Gates** — *"No output reaches the user without validation."*
GregLite Status: ENFORCED. The decision gate (`lib/decision-gate/`) validates every response against Sacred Principle triggers. The EoS (End-of-Session) quality scoring evaluates thread quality. Sprint 15.0 tightened the gate's scan window to reduce false positives while maintaining coverage. Verdict: compliant. Enhancement opportunity: add Greg Gate confidence modes (certain/likely/uncertain/speculative) to message rendering.

**Law 5: Protect Deep Work** — *"Never interrupt focused work without critical cause."*
GregLite Status: PARTIALLY ENFORCED. The decision gate only fires on genuine trigger phrases (post Sprint 15.0 fix), so it won't interrupt with false positives anymore. However, GregLite has no awareness of user focus state — it doesn't track whether the user is in a deep coding session vs. casual chat. Notifications, status updates, and KERNL polling happen regardless of context. Verdict: no active violation, but no proactive protection either.

**Law 6: Transparency** — *"Every decision, cost, and action must be inspectable."*
GregLite Status: PARTIALLY ENFORCED. Sprint 15.0 added per-message cost tracking. The Transit Map (Z1/Z2/Z3) provides session-level transparency. The InspectorDrawer exposes thread quality, KERNL state, and job status. Gap: no per-message orchestration receipt (see Pattern 1 above). Users cannot inspect why a particular response was shaped the way it was. Verdict: foundation solid, needs the receipt footer to fully comply.

**Law 7: Small Context Windows** — *"Prefer many small, focused interactions over monolithic contexts."*
GregLite Status: ENFORCED. Multi-tab threading in ChatInterface.tsx encourages focused conversations per topic. The KERNL integration provides cross-session memory so context doesn't need to be crammed into one thread. Agent SDK calls use separate message arrays. Verdict: compliant.

**Law 8: Claims Age** — *"Every factual claim must carry its timestamp and degrade in confidence over time."*
GregLite Status: NOT ENFORCED. Messages have timestamps but claims within messages are not individually timestamped or confidence-scored. There is no claim extraction, aging, or degradation mechanism. This is architecturally expensive (requires NLP claim extraction + storage + decay function). Verdict: gap, but low priority for GregLite's scope as a Claude-only interface.

**Law 9: Outcomes Win** — *"Judge by results, not by process elegance."*
GregLite Status: ENFORCED (by design philosophy). The EoS scoring evaluates actual response quality. PROJECT_DNA.yaml's "Option B Perfection" philosophy prioritizes outcomes. Sprint protocols measure success by verification (tsc clean, tests pass) not by code style. Verdict: culturally compliant, no specific enforcement mechanism needed.

**Law 10: Attention is Scarce** — *"Treat every notification, badge, popup, and status update as a withdrawal from a finite attention account."*
GregLite Status: PARTIALLY ENFORCED. The UI defaults to collapsed tool blocks (Sprint 15.0), Transit Map defaults to Z1 (minimal), and the StatusBar is compact. However, there's no attention budgeting system — no tracking of how many interruptions the user has received, no throttling of status updates during focused work. The decision gate fires every time a trigger phrase appears, regardless of attention context. Verdict: good defaults, no active management.

**Law 11: Evidence Required** — *"No claim, recommendation, or action without supporting evidence."*
GregLite Status: ENFORCED. The decision gate requires specific trigger phrases (evidence-based detection, not heuristic). Agent SDK responses include token counts and cost as evidence. EoS scoring provides quantitative quality assessment. Verdict: compliant.

**Law 12: Ghost Veto** — *"The Ghost may veto any action that violates Sacred Laws, regardless of user intent or system pressure."*
GregLite Status: PARTIALLY ENFORCED. The decision gate can block submissions (423 status), which is functionally a veto. However, the current implementation is a one-dimensional trigger detector — it doesn't have the Ghost's broader awareness of Sacred Law compliance. The gate checks for debt-inducing language but doesn't check for violations of Law 1 (append-only), Law 3 (reversibility), or Law 5 (deep work protection). Verdict: mechanism exists, scope needs expansion.

**Summary:** Of 12 Sacred Laws, GregLite fully enforces 5 (Laws 1, 4, 7, 9, 11), partially enforces 5 (Laws 3, 5, 6, 10, 12), has no infrastructure for 1 (Law 2), and 1 is a gap with low priority (Law 8). The partially-enforced laws share a common theme: GregLite has the mechanism but not the awareness. The decision gate blocks bad patterns but doesn't proactively protect good ones.

---

## Section 4: Design Token Gaps

This section compares GregLite's `globals.css` (450 lines) against Gregore's `DESIGN_SYSTEM.md` token definitions. The comparison covers colors, typography, spacing, and component-specific tokens.

### Colors

Gregore defines a layered color system: Background layers (bg-primary #0A0A0F, bg-secondary #12121A, bg-tertiary #1A1A25, bg-elevated #22222F), Cyan accent spectrum (primary #00D4FF, bright #33E0FF, muted #00A3CC, ghost #00D4FF15), Status colors (success green, warning amber, error red, info blue), and Glass/overlay tokens (glass-bg rgba(18,18,26,0.85), glass-border rgba(0,212,255,0.1)).

GregLite's `globals.css` maps closely but not identically. `--background` uses hsl(0 0% 3.9%) which converts to roughly #0A0A0A — close to Gregore's #0A0A0F but slightly more neutral (pure gray vs. the spec's slight blue tint). The cyan values (`--cyan: #00D4FF`, `--cyan-bright: #33E0FF`) match exactly. Glass effects exist but use different opacity values than specified.

**Gaps identified:**
The bg-tertiary and bg-elevated layers are not explicitly tokenized in globals.css — GregLite uses Tailwind's utility classes with hardcoded values instead of CSS custom properties. This means changing the elevated background requires finding every `bg-[#22222F]` usage rather than updating one token. The Gregore spec calls for 4 distinct background layers; GregLite effectively uses 2 (background + card).

Status colors exist but aren't tokenized as `--success`, `--warning`, `--error`, `--info`. They're applied directly via Tailwind classes. This is fine for current scale but will create inconsistency as the UI grows.

The ghost transparency token (`#00D4FF15` — cyan at 8% opacity) is used in globals.css for `.ghost-analyzing` but isn't a standalone custom property. Recommend extracting to `--cyan-ghost`.

### Typography

Gregore specifies: Font family `'Inter', system-ui, -apple-system, sans-serif`. Size scale: xs (11px), sm (12px), base (13px), lg (14px), xl (16px). Code font: `'JetBrains Mono', 'Fira Code', monospace` at 12px.

GregLite uses `var(--font-geist-sans)` and `var(--font-geist-mono)` from Next.js's Geist font package. This is a deliberate divergence — Geist is Next.js-native and renders well in the Tauri webview. The font sizes are close but not identical: GregLite uses Tailwind's `text-xs` (12px), `text-sm` (14px), `text-base` (16px) which are larger than Gregore's tighter scale.

**Gap:** GregLite's typography is 1-2px larger at every step. This is fine for readability but means Gregore's dense information layouts (receipt footers, inspector panels) will feel slightly too large if ported without size adjustment. Recommend defining a GregLite-specific size scale that splits the difference: xs (11px), sm (13px), base (14px) for information-dense components.

### Spacing

Gregore defines a 4px base unit with specific spacing tokens: message gap (12px), section gap (24px), component padding (16px), inner padding (8px). GregLite uses Tailwind's default spacing scale (4px base: space-1=4px, space-2=8px, space-3=12px, space-4=16px) which is mathematically equivalent but not semantically named. There are no `--message-gap` or `--section-gap` tokens.

**Gap:** Semantic spacing tokens would improve consistency. When Pattern 1 (Receipt Footer) and Pattern 7 (Inspector Tabs) are ported, having `--message-gap` and `--component-padding` as named tokens prevents each component from independently choosing spacing values.

---

## Section 5: Animation Gaps

Gregore's DESIGN_SYSTEM.md specifies 6 animation keyframes and their usage contexts. GregLite's globals.css implements some of these.

### ghost-pulse
**Spec:** 1s ease-in-out infinite. Cycles `box-shadow` between `--cyan` and `--cyan-bright`. Applied to input field border when Ghost is analyzing.
**GregLite:** IMPLEMENTED in globals.css as `@keyframes ghost-pulse`. The keyframe definition matches the spec exactly. The `.ghost-analyzing` CSS class exists. GAP: Not wired to any component — ChatInterface.tsx's input field never applies this class. This is a pure wiring gap, not an implementation gap.

### shimmer
**Spec:** 2s ease-in-out infinite. Cycles `text-shadow` with cyan glow on matched memory terms.
**GregLite:** IMPLEMENTED in globals.css as `@keyframes shimmer`. The `.memory-match` class exists with hover underline effect. GAP: No component applies this class. Memory matching during typing is not implemented (see Pattern 3 above). The animation is ready; the feature is not.

### breathe
**Spec:** 4s ease-in-out infinite. Subtle opacity cycle (0.7 to 1.0) for ambient "alive" feeling on Ghost indicators.
**GregLite:** IMPLEMENTED in globals.css as `@keyframes breathe`. Applied to `.ghost-context-indicator` which is the teal eye icon beside the input field. STATUS: Working as specified. No gap.

### drawer-slide
**Spec:** 300ms cubic-bezier(0.4, 0, 0.2, 1) for inspector drawer open/close.
**GregLite:** IMPLEMENTED via CSS transitions in InspectorDrawer.tsx. Uses `transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1)` on the drawer container. STATUS: Working as specified. No gap.

### fade-in
**Spec:** 200ms ease-out for new message appearance.
**GregLite:** PARTIALLY IMPLEMENTED. Messages use a simple opacity transition but it's applied via Tailwind's `animate-in` utility rather than a custom keyframe. The timing feels right but isn't precisely the 200ms ease-out specified.

### receipt-expand
**Spec:** 150ms ease-out for receipt footer expand/collapse.
**GregLite:** NOT IMPLEMENTED. Receipt footer doesn't exist yet (Pattern 1). When ported, use this specific timing. The CollapsibleBlock component (Sprint 15.0) uses a similar expand/collapse pattern and could serve as the animation foundation.

**Summary:** Of 6 specified animations, 2 are fully working (breathe, drawer-slide), 2 are defined but unwired (ghost-pulse, shimmer), 1 is approximately implemented (fade-in), and 1 is missing because its parent feature doesn't exist yet (receipt-expand). The animation foundation is solid — the gaps are in feature wiring, not in CSS capability.

---

## Section 6: Skip List — What NOT to Port

Certain Gregore concepts are either irrelevant to GregLite's Claude-only architecture, explicitly rejected during design archaeology, or too expensive for the current phase. These should be consciously excluded.

**Multi-Model Consensus / Council Synthesis:** Gregore's core differentiator is multi-LLM orchestration (Gemini + GPT-4o + Claude routing via Engine-A Active Inference Router). GregLite is deliberately Claude-only. The entire consensus mechanism, model routing logic, confidence arbitration, and council synthesis methodology does not apply. Do not port any Engine-A, PARALLAX cross-model verification, or Oracle prediction market concepts.

**Triptych Layout / Cognitive Cockpit:** UI_UX_ARCHAEOLOGY.md documents the explicit death of the three-panel "Cognitive Cockpit" layout (killed January 2, 2026). The replacement is the single-surface + drawer architecture that GregLite already implements. Do not resurrect panel-based layouts. The archaeology doc exists specifically to prevent this regression.

**Biological Metaphors in UI:** The council synthesis and early design docs use terms like "membrane," "organs," "seam," "cognitive metabolism." These were explicitly purged from user-facing UI language. GregLite should never surface terms like "Engine-H Cognitive Metabolism" or "Stigmergic Field" to users. These are internal architecture names, not UI concepts. The Grandma Test applies.

**GLACIER Long-Term Memory System:** Gregore's GLACIER system provides cross-session episodic memory with decay functions, importance scoring, and consolidation. GregLite uses KERNL for project-level memory, which is a simpler but adequate solution for its scope. Porting GLACIER would require a separate memory database, background consolidation jobs, and decay algorithms — significant infrastructure for marginal user benefit in a Claude-only context.

**Homeostasis / Self-Model / World-Model Systems:** These are Gregore's self-regulation systems — monitoring cognitive load, maintaining system health, modeling the user's mental state, and modeling the external environment. They require persistent state across sessions, background monitoring processes, and complex inference. GregLite's StatusBar health indicators (AEGIS, KERNL status) provide a minimal version. Full homeostasis is Phase 3+ territory.

**ENGINE-E Anti-Gravity (Novelty Injection):** Deliberately introduces unexpected perspectives to prevent cognitive ruts. Interesting concept but requires calibration against user personality profiles and risks being annoying in a coding-focused tool. Skip entirely for GregLite.

**ENGINE-I Cognitive Metabolism (Resource Optimization):** Manages token budgets, context window allocation, and computational resource distribution across models. Irrelevant in single-model Claude-only context where the Agent SDK handles its own token management.

**Gamification of Any Kind:** PRODUCT_VISION.md and the council synthesis explicitly reject gamification. No badges, streaks, achievements, levels, or progress bars that frame usage as a game. "This isn't Duolingo." Quality scoring is internal and professional, not gamified.

---

## Section 7: Recommended Sprint Sequence

Based on the gaps identified above, here are 3 follow-up sprints ordered by impact and dependency chain.

### Sprint 16.0 — Receipt Footer + Voice System
**Scope:** Pattern 1 (Receipt Footer) + Brand Voice foundation
**Why First:** The receipt footer is the single highest-impact missing pattern (P0). It makes every response visibly richer and enforces Sacred Law 6 (Transparency) at the message level. Combining it with a voice system (`lib/voice/`) establishes consistent copy patterns that all subsequent UI work will reference.

**Tasks:**
Create `lib/voice/copy-templates.ts` with standardized message copy (error messages, gate warnings, status text, receipt labels) following the voice guide from Section 1. Implement `components/chat/ReceiptFooter.tsx` as a collapsed-by-default component under each assistant message showing model, cost, tokens, and latency. Wire to session_costs data from Sprint 15.0. Add receipt display preference to ui-store (full/compact/minimal/hidden). Implement Orchestration Theater (Pattern 4) as a first-5-messages auto-expand behavior. Define the `receipt-expand` animation (150ms ease-out) in globals.css.

**Estimated Effort:** 1 sprint (5-8 tasks)

### Sprint 17.0 — Decision Gate Enhancement
**Scope:** Pattern 5 (Adaptive Override System) + Send Button States (Pattern 6) + Ghost Pulse wiring (Pattern 2)
**Why Second:** These three patterns share a dependency on the decision gate pipeline. The override system makes the gate smarter (learning from user choices), the send button makes gate state visible (5-state system), and ghost-pulse makes gate analysis ambient (input border animation). Together they transform the decision gate from a blunt blocker into an intelligent, visible quality system.

**Tasks:**
Extend GatePanel.tsx with three-choice UI (just once / always allow / never warn). Create `lib/decision-gate/override-policies.ts` with SQLite-backed policy storage. Wire policy checks into trigger-detector.ts. Create `components/chat/SendButton.tsx` with 5 visual states mapped to gate state. Wire ghost-pulse CSS class to input field during gate analysis. Add override policy management to Settings > Decision Gate.

**Estimated Effort:** 1 sprint (6-10 tasks)

### Sprint 18.0 — Inspector Reorganization + Design Token Cleanup
**Scope:** Pattern 7 (Inspector Drawer Tabs) + Section 4 token gaps + Section 5 animation wiring
**Why Third:** This is a polish sprint that reorganizes existing functionality and closes token/animation gaps. Lower urgency because the current inspector and tokens work — they're just not optimally organized.

**Tasks:**
Reorganize InspectorDrawer tabs to: Memory, Quality, Cost, Jobs, Learning. Extract semantic color tokens (`--bg-elevated`, `--bg-tertiary`, `--success`, `--warning`, `--error`, `--info`, `--cyan-ghost`) into globals.css custom properties. Define GregLite typography scale (xs 11px, sm 13px, base 14px) for information-dense components. Add semantic spacing tokens (`--message-gap`, `--section-gap`, `--component-padding`). Wire fade-in animation to precise 200ms ease-out for new messages.

**Estimated Effort:** 1 sprint (5-7 tasks)

**Beyond Sprint 18.0:** Memory Shimmer (Pattern 3) requires real-time KERNL semantic search integration — defer to a dedicated memory sprint. Sacred Law gaps (Laws 2, 3, 8) require architectural decisions about autonomy, reversibility, and claim aging that should be designed holistically, not patched incrementally.

---

*End of audit. This document should be referenced as the single source of truth for Gregore-to-GregLite port decisions. Update version number when any section changes.*
