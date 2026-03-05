# GREGORE AUDIT — Port Recommendations for GregLite

**Sprint:** 15.1 (Research)
**Date:** March 5, 2026
**Auditor:** Claude (Opus)
**Sources:** 30+ Gregore documentation files, 4 GregLite implementation files
**Output:** Research document — NO CODE

---

## Section 1: Brand Voice

### Compiled Voice Profile

David's summary: **"Deadpan professional, data-forward and approachable, a wise teacher, but also sardonic."**

Evidence compiled across all Gregore docs:

**From PRODUCT_VISION.md — Strategic Identity:**
Gregore positions itself as "The Cognitive Operating System — Where all intelligence converges." The voice is that of a high-competence platform that doesn't need to prove itself. It states facts, not promises. The tagline carries no exclamation marks, no hype words. This is a product that assumes you're smart enough to see its value.

**From UI_UX_FINAL_DIRECTION.md — Communication Philosophy:**
The Ghost communicates through *ambient awareness* (border glow), *action clarity* (send button states), and *post-detail* (receipt footer). This layered approach mirrors the brand voice itself: understated until it matters, then precise. The system never shouts. It glows.

**From SACRED_LAWS.md — Law #6 (Transparency) and Law #10 (Attention is Scarce Capital):**
Every action explains itself with What, Why, Who, When, and Evidence. But attention is treated as currency — the system won't waste yours. This creates the sardonic tension: Gregore knows more than it shows, and it respects you enough to stay quiet unless something matters.

**From UI_UX_ARCHAEOLOGY.md — What Failed:**
Biological metaphors ("membrane," "organs," "cognitive cockpit") were explicitly killed. The voice was recalibrated away from academic/quirky toward professional/cool. The Grandma Test, Freelancer Test, and Professional Test all filter for clarity over cleverness.

**From DESIGN_SYSTEM.md — Empty States and Error States:**
Empty states should be "encouraging and actionable, not just informational." Errors should be "clear, helpful, and recoverable" with "plain language explanation." No alarm, no drama. The voice stays warm even when things break.

**From Homeostasis System (HOMEOSTASIS.md):**
The behavioral profiles encode voice modulation directly: Crisis mode → "terse, protective, laser-focused." Exploration mode → "exploratory, make connections." Recovery mode → "gentle, suggest breaks." The voice adapts to cognitive state — it reads the room.

**From Greg Gate (ENGINE-F.md) — Epistemic Honesty:**
The four response modes (ASSERT / PROBABILISTIC / INVESTIGATIVE / REFUSE) define how Gregore speaks about what it knows. High confidence → strong claim with falsifiers. Low confidence → "I don't know" + shortest path to knowing. The system never bullshits. This is the sardonic core: it will confidently tell you it doesn't know.

### Voice Guide for GregLite Copy

**Tone:** Professional calm with dry wit. Think: a senior engineer who's seen everything and finds most of it mildly amusing.

**Do:**
- State facts without hedging ("Cost: $0.003" not "Your cost was approximately...")
- Use imperative mood for actions ("Send" not "Click here to send your message")
- Be specific ("3 jobs running, 1 pending" not "Some jobs are in progress")
- Show competence through brevity, not verbosity
- Use dry humor in empty states and edge cases
- Present uncertainty honestly ("I don't have enough to answer that — here's what would help")

**Don't:**
- Use exclamation marks in UI copy (one per screen, maximum, and only for genuine celebration)
- Anthropomorphize with personality quirks ("I'm thinking!" → just show a pulse)
- Use biological metaphors (membrane, organs, seam)
- Hedge when confident or overclaim when uncertain
- Use emoji in system-level communication (user messages are their business)

**Label Standards:**
- Role labels: "You" / "GregLite" (already correct in Message.tsx)
- Status: ALL CAPS for system labels ("COST TODAY:", "JOBS:", "AEGIS:", "KERNL:" — already correct in StatusBar.tsx)
- Actions: Title case ("Edit", "Regenerate", not "EDIT", "REGENERATE")
- Metadata: Lowercase, separated by dots ("sonnet · 234 tokens · $0.002 · 1.3s")

**GregLite Current State:** Partially aligned. StatusBar copy is excellent (terse, data-forward, professional). Message.tsx role labels are correct. Missing: no voice guide exists as a reference doc, and there's no receipt footer voice yet since receipts aren't implemented.


---

## Section 2: UI/UX Patterns to Port

### P0 — Must Have for Daily Driver

**2.1 Receipt Footer (Collapsed/Expanded Orchestration Details)**

*Source:* DESIGN_SYSTEM.md §3 "Receipt Footer (CRITICAL COMPONENT)", UI_UX_FINAL_DIRECTION.md Part 3
*What it is:* After each assistant message, a collapsed one-liner showing Ghost validation status, cost, and latency. Clicking expands to show full orchestration details: model selection rationale, Ghost pre/post checks, confidence score, alternative models considered.
*GregLite status:* **MISSING.** Message.tsx shows basic metadata in a footer row (model, tokens, cost, latency) but this is flat — no collapse/expand, no Ghost validation status, no orchestration detail, no "Receipt" concept. The data is there (model, tokens, costUsd, latencyMs props exist) but the presentation is a plain metadata line, not a receipt.
*Gap:* Need CollapsibleReceipt component. Collapsed: "✓ Ghost validated · $0.002 · 234ms [▸]". Expanded: model selection reasoning, Ghost checks, G-score, alternative model comparison.
*File refs:* `app/components/chat/Message.tsx` lines ~320-340 (metadata footer), DESIGN_SYSTEM.md §3 "Receipt Footer"
*Priority:* **P0** — This is the primary differentiator from Claude Desktop. Without it, GregLite is just another chat wrapper.

**2.2 Orchestration Theater (First 3-5 Messages Show Full Detail)**

*Source:* UI_UX_FINAL_DIRECTION.md Part 5 "Orchestration Theater", DESIGN_SYSTEM.md §5
*What it is:* For the first 3-5 messages of a new conversation, receipts are automatically expanded to full detail. This solves the "how is this different from ChatGPT?" question immediately. After message 5, the system prompts: "How detailed do you want orchestration info?" with options: Full / Compact (recommended) / Minimal / Hidden.
*GregLite status:* **MISSING.** No concept of message-count-based behavior, no detail preference prompt, no receipt expansion logic.
*Gap:* Requires: (a) message counter per conversation, (b) auto-expand receipts for messages 1-5, (c) preference prompt after message 5, (d) settings persistence for receipt detail level.
*Priority:* **P0** — First-run experience is everything. This is how GregLite proves its value.

**2.3 Ghost Layered Communication (Border Glow + Send Button States)**

*Source:* DESIGN_SYSTEM.md §3 "Input Field", "Send Button", UI_UX_FINAL_DIRECTION.md Part 2
*What it is:* Three-layer progressive communication: Layer 1 (ambient): input border glows cyan via ghost-pulse animation while typing. Layer 2 (action): send button cycles through states — normal → checking → approved/warning/veto. Layer 3 (detail): receipt footer after response.
*GregLite status:* **PARTIALLY IMPLEMENTED.** The ghost-pulse CSS animation exists in globals.css. SendButton component exists with state types (normal/checking/approved/warning/veto). But the Ghost *checking* phase is cosmetic — ChatInterface.tsx sets `checking` state when sending but there's no actual Ghost pre-send validation. The input field doesn't apply `ghost-pulse` class during typing.
*Gap:* (a) Wire ghost-pulse animation to input field focus state, (b) implement actual Ghost pre-send check that sets warning/veto states, (c) the Ghost approval flow is decorative, not functional.
*File refs:* `globals.css` lines 126-137, `ChatInterface.tsx` SendButton usage, `components/chat/SendButton.tsx` (not read but referenced)
*Priority:* **P0** — The Ghost is the brand. If it's decorative, the entire product identity is hollow.

### P1 — Should Have

**2.4 Adaptive Override System (Once/Always/Never Pattern)**

*Source:* UI_UX_FINAL_DIRECTION.md Part 5 "Adaptive Override System", DESIGN_SYSTEM.md §5
*What it is:* When Ghost raises a warning, users get three choices: "Just this once" (no learning), "Always allow [category]" (creates override policy), "Never warn about this" (broad category suppression). Ghost builds a personalized safety profile over time.
*GregLite status:* **MISSING.** GregLite has a DecisionGateStore and GatePanel component (visible in ChatInterface.tsx imports), but this appears to be a different pattern — a blocking gate, not a three-choice adaptive system. No override policy management exists.
*Gap:* Full implementation: override policy store, three-choice UI, settings panel for policy management.
*Priority:* **P1** — Critical for daily driver UX. Without it, Ghost warnings become annoying rather than useful.

**2.5 Memory Shimmer (Inline Context Reveals)**

*Source:* DESIGN_SYSTEM.md §3 "Memory Shimmer Effect", UI_UX_FINAL_DIRECTION.md Part 4
*What it is:* When Gregore's response draws on past conversation context, the relevant text shimmers with a cyan glow animation. Hovering shows a tooltip with the source memory. Clicking expands to show the full context chain. Creates visible "switching costs" — users see their accumulated intelligence.
*GregLite status:* **CSS EXISTS, NOT WIRED.** globals.css has `.shimmer` and `.memory-match` classes with the correct animation (lines 139-161). But nothing in Message.tsx or ChatInterface.tsx applies these classes. No memory detection or context attribution exists in the rendering pipeline.
*Gap:* (a) Backend: identify which response segments draw on prior context, (b) Frontend: wrap those segments in `.memory-match` spans, (c) tooltip/expand behavior on hover/click.
*Priority:* **P1** — This is the visible proof of memory advantage. Makes the invisible visible.

**2.6 Settings-Driven Complexity (User Chooses Detail Level)**

*Source:* UI_UX_FINAL_DIRECTION.md Part 5 "Settings-Driven Complexity", DESIGN_SYSTEM.md §5
*What it is:* Users configure how much detail they see. Budget display: Full/Simple/Hidden. Receipts: Full/Compact/Minimal/Hidden. Ghost detail: Verbose/Normal/Quiet. This respects that a power user and a casual user need different information density.
*GregLite status:* **PARTIALLY EXISTS.** ChatInterface.tsx imports `useDensityStore` with `cycleDensity` (Cmd+Shift+= / Cmd+Shift+-). This controls message spacing/padding but NOT receipt detail level or Ghost verbosity. SettingsPanel exists but its content wasn't read.
*Gap:* Settings panel needs receipt detail level, Ghost verbosity, and budget display toggles. These settings need to propagate to Message.tsx rendering.
*Priority:* **P1** — Power users will demand this within the first week of daily driving.

### P2 — Nice to Have

**2.7 Inspector Drawer Tabs (Memory / Intent / Cost / State)**

*Source:* DESIGN_SYSTEM.md §3 "Inspector Drawer", UI_UX_FINAL_DIRECTION.md Part 1
*What it is:* Cmd+I opens a right-side drawer (400px, glassmorphic backdrop blur) with four tabs showing deeper inspection of the current conversation: Memory (what context was used), Intent (query classification), Cost (token/dollar breakdown), State (homeostasis/hormones).
*GregLite status:* **PARTIALLY EXISTS.** InspectorDrawer component exists (imported in ChatInterface.tsx, toggled by Cmd+I). Its internal structure wasn't read, but it exists as a component. Unknown whether it has the four-tab structure or the glassmorphic styling.
*Gap:* Verify tab structure matches spec. Likely needs Memory and State tabs to be wired to actual data.
*Priority:* **P2** — The drawer exists; it's about content completeness, not architecture.

**2.8 Grandma Test Compliance (No Jargon in Default View)**

*Source:* DESIGN_SYSTEM.md §1 "The Grandma Test", UI_UX_ARCHAEOLOGY.md
*What it is:* Default view shows zero jargon. "AEGIS," "KERNL," "EoS" are power-user labels that violate the Grandma Test in default mode. A non-technical user opening GregLite would see "AEGIS: DEFAULT" and "KERNL: ● indexed" and have no idea what they mean.
*GregLite status:* **VIOLATING.** StatusBar.tsx exposes AEGIS, KERNL, and EoS labels by default with no option to hide them. These are meaningful to David but would confuse any other user.
*Gap:* Default density mode should hide power-user metrics. Show them in "power" or "developer" density mode only.
*File refs:* `app/components/ui/StatusBar.tsx` — all labels visible by default
*Priority:* **P2** — David is the only user right now, so this doesn't block daily driving. But it's technical debt against the Grandma Test principle.


---

## Section 3: Sacred Laws Audit

GregLite should enforce the Sacred Laws appropriate to a Claude-only, single-user app. Some laws are architecture-level (multi-model consensus) and don't apply. Others are fundamental to product identity.

### Law #1: Append-Only Events
*Gregore spec:* Everything is append-only. No deletion, only superseding. Ghost blocks deletion attempts.
*GregLite enforcement:* **PARTIALLY ENFORCED.** The database layer (better-sqlite3) stores conversation history, and the Transit Map event system (26 event types, Sprint 11.2) captures append-only events. However, Message editing (Cmd+E) in ChatInterface.tsx calls `truncate-after` on the API — this *deletes* messages from the conversation, violating append-only. The edit should supersede, not truncate.
*Should enforce?* **YES — P1.** Edit should mark old messages as superseded, not delete them. Transit Map already has the right pattern.
*Implementation:* Change edit flow to soft-delete (mark superseded) rather than hard truncate. Show superseded messages as collapsed/dimmed if user wants history.

### Law #2: Earned Autonomy by Blast Radius
*Gregore spec:* Actions tiered 0-4 by potential impact. Higher blast radius requires more explicit permission.
*GregLite enforcement:* **PARTIALLY ENFORCED.** The Decision Gate system (DecisionGateStore, GatePanel) implements a blocking gate for high-stakes actions. Agent SDK jobs appear to have validation states (SPAWNING → RUNNING → WORKING → VALIDATING). But there's no visible blast radius classification or tiered autonomy.
*Should enforce?* **YES — P1.** As Agent SDK capabilities grow, blast radius tiers become critical. A job that reads files is tier 0; a job that modifies files is tier 2; a job that sends emails is tier 3.
*Implementation:* Add blast_radius field to job definitions. Decision Gate triggers automatically at tier 2+.

### Law #3: Reversibility First
*Gregore spec:* Every action should be undoable. Ghost vetoes irreversible actions above blast radius 2.
*GregLite enforcement:* **WEAK.** Message edit/regenerate exist (Cmd+E, Cmd+R) but these are destructive rewrites, not reversible operations. No undo stack exists for Agent SDK job actions.
*Should enforce?* **YES — P2.** Not blocking for daily driver, but needed before Agent SDK does anything consequential.

### Law #4: Quality Gates (V0-V5 Verification)
*Gregore spec:* Claims progress through verification levels. Cannot skip levels.
*GregLite enforcement:* **NOT APPLICABLE in current form.** GregLite doesn't maintain a claims ledger. The Provenance Ledger (Engine H) is a multi-model concept. However, the *principle* of epistemic honesty maps to Greg Gate behavior — GregLite should communicate confidence levels.
*Should enforce?* **SPIRIT ONLY — P2.** Don't build V0-V5 infrastructure, but do communicate when the model is confident vs uncertain. This is a prompt engineering + UI problem, not an architecture problem.

### Law #5: Protect Deep Work
*Gregore spec:* BUILD mode is sacred. Interrupts have cognitive token cost.
*GregLite enforcement:* **PARTIALLY ENFORCED.** AEGIS profile system exists (shown in StatusBar). The profile names suggest workload-aware behavior. But there's no visible interrupt-cost mechanism.
*Should enforce?* **YES — P1.** David's daily driver needs focus protection. Notifications, Ghost warnings, and morning briefings should respect AEGIS mode.

### Law #6: Transparency
*Gregore spec:* Every action includes What, Why, Who, When, Evidence.
*GregLite enforcement:* **WEAK.** Message metadata shows model, tokens, cost, latency (the What and When). But no Why (model selection reasoning), no Evidence (confidence basis). This is exactly what the Receipt Footer would solve.
*Should enforce?* **YES — P0.** Receipt Footer IS Law #6 in practice.

### Law #7: Small Context Windows
*Gregore spec:* Prefer focused context. Working set 7±2 items.
*GregLite enforcement:* **NOT EXPLICITLY ENFORCED.** No visible working set limit. Prompt caching (Sprint 12.0) helps with cost but doesn't enforce cognitive focus.
*Should enforce?* **SPIRIT ONLY — P2.** Don't build a working set limiter, but do compress conversation history aggressively before sending to Claude.

### Law #8: Claims Age
*Gregore spec:* Old claims need re-verification. Exponential confidence decay.
*GregLite enforcement:* **NOT ENFORCED.** No staleness tracking.
*Should enforce?* **NO for now.** This is a multi-model feature. Single-model Claude doesn't maintain persistent claims.

### Law #9: Outcomes Win Arguments
*Gregore spec:* Results over rhetoric.
*GregLite enforcement:* **CULTURAL, not architectural.** This is a prompt engineering principle, not a UI feature.
*Should enforce?* **YES — via system prompt.** GregLite's system prompt should instruct Claude to prefer evidence over opinion.

### Law #10: Attention is Scarce Capital
*Gregore spec:* Cognitive token budget. Every interrupt has a cost. Budget enforces prioritization.
*GregLite enforcement:* **PARTIALLY ENFORCED.** Morning Briefing exists (one-per-day check in ChatInterface.tsx). StatusBar shows cost tracking. But no interrupt budget or notification throttling.
*Should enforce?* **YES — P1.** As Ghost and Agent SDK generate more events, throttling becomes essential. Don't let the system become noisy.

### Law #11: Evidence Required
*Gregore spec:* Claims need backing.
*GregLite enforcement:* **NOT ENFORCED.** No evidence chain tracking.
*Should enforce?* **SPIRIT ONLY — P2.** Prompt engineering: instruct Claude to cite sources and qualify claims.

### Law #12: Ghost Veto
*Gregore spec:* Ghost observer can halt any action. Absolute authority (only user can override).
*GregLite enforcement:* **ARCHITECTURE EXISTS, NOT FUNCTIONAL.** GhostStore exists (imported in ChatInterface.tsx). Ghost context is tracked per-thread. But the veto mechanism isn't wired — the Ghost doesn't actually block sends. SendButton state goes to 'checking' cosmetically but no real validation occurs.
*Should enforce?* **YES — P0.** The Ghost is the product. If it can't veto, it's set dressing.


---

## Section 4: Design Token Gaps

Line-by-line comparison of Gregore DESIGN_SYSTEM.md §2 vs GregLite globals.css.

### Colors — Primary Cyan Palette
| Token | Gregore Spec | GregLite globals.css | Status |
|-------|-------------|---------------------|--------|
| Primary Cyan | `#00D4E8` | `--cyan: #00d4e8` | ✅ MATCH |
| Cyan Dark | `#0891B2` | `--cyan-dark: #0891b2` | ✅ MATCH |
| Cyan Light | `#67E8F9` | `--cyan-light: #67e8f9` | ✅ MATCH |
| Cyan Bright | `#22D3EE` | `--cyan-bright: #22d3ee` | ✅ MATCH |

### Colors — Dark Mode Base
| Token | Gregore Spec | GregLite globals.css | Status |
|-------|-------------|---------------------|--------|
| Deep Space | `#0A0E14` | `--deep-space: #0a0e14` | ✅ MATCH |
| Elevated | `#1A1E24` | `--elevated: #1a1e24` | ✅ MATCH |
| Surface | `#242931` | `--surface: #242931` | ✅ MATCH |
| Ice White | `#E8F4F8` | `--ice-white: #e8f4f8` | ✅ MATCH |
| Frost | `#B8C5D0` | `--frost: #b8c5d0` | ✅ MATCH |
| Mist | `#8895A5` | `--mist: #8895a5` | ✅ MATCH |
| Shadow | `#4A5560` | `--shadow: #4a5560` | ✅ MATCH |

### Colors — Status
| Token | Gregore Spec | GregLite globals.css | Status |
|-------|-------------|---------------------|--------|
| Success | `#22C55E` | `--success: #22c55e` | ✅ MATCH |
| Warning | `#F59E0B` | `--warning: #f59e0b` | ✅ MATCH |
| Info | `#3B82F6` | `--info: #3b82f6` | ✅ MATCH |
| Error | `#EF4444` | `--error: #ef4444` | ✅ MATCH |

### Colors — Ghost States
| Token | Gregore Spec | GregLite globals.css | Status |
|-------|-------------|---------------------|--------|
| Ghost Ambient | `#00D4E8` (cyan) | `--ghost-ambient: var(--cyan)` | ✅ MATCH |
| Ghost Analyzing | `#22D3EE` (cyan bright) | `--ghost-analyzing: var(--cyan-bright)` | ✅ MATCH |
| Ghost Approved | `rgba(34, 197, 94, 0.3)` | `--ghost-approved: rgba(34, 197, 94, 0.3)` | ✅ MATCH |
| Ghost Warning | amber | `--ghost-warning: var(--warning)` | ✅ MATCH |
| Ghost Veto | red | `--ghost-veto: var(--error)` | ✅ MATCH |

### Typography
| Token | Gregore Spec | GregLite globals.css | Status |
|-------|-------------|---------------------|--------|
| Body font | Inter, system-ui, sans-serif | `--font-sans: 'Inter', system-ui, ...sans-serif` | ✅ MATCH |
| Code font | JetBrains Mono, Fira Code, monospace | `--font-mono: 'JetBrains Mono', 'Fira Code', monospace` | ✅ MATCH |
| Display font | Space Grotesk, Inter, sans-serif | `--font-display: 'Space Grotesk', 'Inter', sans-serif` | ✅ MATCH |
| Body size | 14px | `font-size: 14px` | ✅ MATCH |
| Line height | 1.6 | `line-height: 1.6` | ✅ MATCH |
| Heading weight | 600 | `font-weight: 600` | ✅ MATCH |
| Font features | rlig 1, calt 1 | `font-feature-settings: 'rlig' 1, 'calt' 1` | ✅ MATCH |

### Colors — MISSING from GregLite
| Token | Gregore Spec | GregLite Status |
|-------|-------------|-----------------|
| User message background | `rgba(0, 212, 232, 0.1)` | ❌ MISSING — Message.tsx uses cyan left border but no background tint |
| User message border | Left border 3px solid cyan | ⚠️ PARTIAL — Uses `2px solid var(--cyan)` (2px not 3px) |
| AI response background | `rgba(26, 30, 36, 0.6)` | ❌ MISSING — No background on AI messages |
| Model tier badge colors | purple-500/20, blue-500/20, green-500/20, orange-500/20 | ❌ MISSING — No model selector exists (Claude-only, but tier badges could apply to Claude model variants) |

### Spacing & Sizing — MISSING
| Token | Gregore Spec | GregLite Status |
|-------|-------------|-----------------|
| Message max-width | 80% | ❌ MISSING — Messages appear full-width (max-w-4xl on input container but not on messages) |
| Message padding | 16px | ⚠️ PARTIAL — Uses CSS custom properties `--msg-padding: 8px 0` (8px not 16px) |
| Message border radius | 8px | ❌ MISSING — No border radius on messages |
| Inspector drawer width | 400px | ❓ UNKNOWN — InspectorDrawer exists but wasn't read |
| Sidebar width | 280px | ❓ UNKNOWN — ChatHistoryPanel exists but wasn't read |
| Touch target minimum | 44x44px | ❓ UNKNOWN — Not audited at component level |

### Light Mode
| Token | Gregore Spec | GregLite Status |
|-------|-------------|-----------------|
| Light mode support | Full override palette | ✅ EXISTS — `[data-theme="light"]` block in globals.css with complete overrides |

### Summary
Core design tokens (colors, fonts) are **100% aligned** — GregLite clearly ported these from Gregore's spec. The gaps are in *component-level application* of those tokens: message styling doesn't match spec (missing backgrounds, incorrect border width, no border radius, no max-width), and message padding is half the specified value.


---

## Section 5: Animation Gaps

Comparison of Gregore DESIGN_SYSTEM.md §4 (Animation System) with GregLite's actual implementation.

### Ghost Pulse (Input Border Glow)
*Gregore spec:* 1s ease-in-out infinite cycle between cyan (opacity 0.6) and cyan-bright (opacity 1.0) on the input border while Ghost is analyzing.
*GregLite:* **CSS EXISTS.** globals.css defines `@keyframes ghost-pulse` and `.ghost-pulse` class (lines 126-137) with matching spec. However, the animation is never applied. InputField component (not read, but referenced in ChatInterface.tsx) doesn't appear to receive a `ghost-pulse` class during the checking phase. ChatInterface.tsx sets `sendButtonState` to 'checking' but doesn't set an input field class.
*Gap:* Wire `.ghost-pulse` class to input container when `sendButtonState === 'checking'`.
*Priority:* P0 — This is Ghost Layer 1. Three lines of code to activate.

### Memory Shimmer (Text Glow on Context-Aware Content)
*Gregore spec:* 2s ease-in-out infinite text-shadow cycle between 2px and 8px cyan glow. Underline with 1px cyan line. Hover makes underline opaque. Cursor: pointer.
*GregLite:* **CSS EXISTS.** globals.css defines `@keyframes shimmer`, `.shimmer`, and `.memory-match` classes (lines 139-161) with matching spec including the `::after` underline pseudo-element.
*Gap:* No code in Message.tsx applies these classes. Need backend memory attribution + frontend span wrapping.
*Priority:* P1 — Requires backend work to detect memory-influenced content.

### Breathing Glow (Logo Animation)
*Gregore spec:* 3s ease-in-out infinite cycle between opacity 0.3/scale(1) and opacity 0.7/scale(1.05). Applied to logo container.
*GregLite:* **CSS EXISTS.** globals.css defines `@keyframes breathe` and `.breathe` class (lines 163-177).
*Gap:* Unknown if Header component applies `.breathe` to logo. Header wasn't read but is imported in ChatInterface.tsx.
*Priority:* P2 — Ambient polish.

### Drawer Slide (Framer Motion Spring)
*Gregore spec:* Spring animation with stiffness: 300, damping: 30 for drawer entry. Duration 0.3s for exit. x: '100%' → x: 0 for right drawer.
*GregLite:* **LIKELY EXISTS.** InspectorDrawer, ChatHistoryPanel, SettingsPanel are all imported. GregLite uses framer-motion (in node_modules). Actual animation params weren't verified.
*Gap:* Verify spring parameters match spec (stiffness: 300, damping: 30).
*Priority:* P2 — Likely already correct; verify only.

### Micro-interactions (Button Press, Card Lift)
*Gregore spec:* `whileHover: { scale: 1.05 }`, `whileTap: { scale: 0.95 }` for buttons. Card lift: `whileHover: { y: -4, boxShadow: '...' }`.
*GregLite:* **UNKNOWN.** Buttons use CSS `transition-colors` classes (visible in StatusBar.tsx, Message.tsx) but no framer-motion scale effects visible in the audited files.
*Gap:* Add whileHover/whileTap to primary interactive elements. Low effort, high polish.
*Priority:* P2 — Polish pass.

### Receipt Expand Animation
*Gregore spec:* Spring animation (stiffness: 300, damping: 30) for collapsed → expanded receipt transition.
*GregLite:* **NOT APPLICABLE YET.** No receipt component exists.
*Gap:* Will need to be built as part of Receipt Footer implementation (P0).
*Priority:* Ships with Receipt Footer.

### Transit Map Animations
*GregLite has these that Gregore doesn't:* `station-pulse`, `slide-in-right`, `landmark-fade-in`, `transit-crossfade`, `subway-station-hover`, `war-room-pulse`. These are GregLite originals from the Transit Map system (Sprint 13.0). They should be PRESERVED — they're GregLite's own innovation.

### Reduced Motion
*Gregore spec:* Full `prefers-reduced-motion` media query disabling all animations, preserving shimmer as underline.
*GregLite:* **EXISTS AND MATCHES.** globals.css lines 183-197 implement the exact spec including the `.shimmer`/`.memory-match` underline fallback.
*Gap:* None.

### Summary
The animation *definitions* are 100% ported in CSS. The gap is *activation* — ghost-pulse and shimmer are defined but never applied to DOM elements. This is a wiring problem, not a design problem. Fixing ghost-pulse is trivial (P0). Fixing shimmer requires backend memory attribution (P1).


---

## Section 6: Skip List — What NOT to Port

### 6.1 Multi-Model Consensus Engine (Engines A, B, C, E, G, I)
*What it is:* ORACLE routing (Engine A), Global Workspace tribunal deliberation (Engine B), Phase Detector (Engine C), Anti-Gravity novelty injection (Engine E), Genius Protection outlier preservation (Engine G), Cognitive Metabolism optimization (Engine I).
*Why skip:* GregLite is Claude-only by design (PROJECT_DNA.yaml: "Claude Agent SDK replaces all Cowork references"). There's no model routing decision when there's one model. The entire multi-model orchestration stack — which is ~60% of Gregore's engine complexity — is irrelevant. The Tribunal, Workspace, Phase Detection, and Genius Protection concepts only make sense with multiple models producing competing outputs.
*Future note:* These engines are the core of Gregore Full (the multi-model product). They should NOT be ported to GregLite even partially. The product funnel is: GregLite validates UX → Gregore Full adds multi-model intelligence.

### 6.2 Three-Pane Triptych Layout
*What it is:* The deleted Cognitive Cockpit with persistent left (Context) and right (Intent) panels flanking the chat.
*Why skip:* Already rejected and deleted in Gregore itself (January 2, 2026, git commit 077f608). 2,700 lines deleted. Violated Grandma Test. GregLite correctly uses single surface + drawer architecture.
*Evidence:* UI_UX_ARCHAEOLOGY.md documents the full post-mortem.

### 6.3 Biological Metaphors
*What it is:* "Membrane" (interface boundary), "organs" (system components), "seam" (complexity dial), "Cognitive Cockpit" (triptych name).
*Why skip:* Explicitly killed in Gregore. User feedback: "can't lean too much into the biology themology...would be cringe in the actual product." The Freelancer Test forbids terminology a client would find weird.
*GregLite status:* Already clean. No biological metaphors found in audited files.

### 6.4 Homeostasis / Digital Endocrine System
*What it is:* Hormone-based state machine (cortisol, dopamine, melatonin, serotonin, oxytocin) that modulates model behavior through prompt injection.
*Why skip:* Homeostasis was designed for multi-model orchestration where different behavioral profiles drive different routing and temperature decisions. With a single Claude model, the complexity of a five-hormone simulation is unjustified. GregLite already has AEGIS profiles which serve a similar purpose at the right abstraction level.
*Preserve the spirit:* AEGIS profiles ARE the GregLite version of Homeostasis. Don't build a hormone simulator.

### 6.5 PARALLAX / Stigmergic Memory Field (Engine D)
*What it is:* Semantic embedding-based memory where past conversations exert "gravitational pull" on present queries through vector similarity.
*Why skip:* GregLite already has a vector memory system (lib/vector/, lib/embeddings/, sqlite-vec in node_modules). The PARALLAX *concept* is already implemented — it just isn't called PARALLAX. Don't rebrand existing functionality.
*GregLite equivalent:* lib/vector/ + lib/embeddings/ + KERNL integration.

### 6.6 GLACIER Long-Term Memory Tiers (T0-T4)
*What it is:* Five-tier memory storage with compression, promotion logic, and configurable retention.
*Why skip:* Over-engineered for single-user. GregLite's KERNL + SQLite approach with vector search is sufficient. The T0-T4 tier system adds complexity without proportional value when one user generates one conversation stream.
*Preserve the spirit:* KERNL's session management + vector search IS the GregLite memory system.

### 6.7 LIGHTHOUSE Model Benchmarking
*What it is:* Tracks quality, speed, cost, and domain competence across multiple models to inform routing.
*Why skip:* One model. Nothing to benchmark against. GregLite already tracks cost per query (StatusBar, CostBreakdown component).

### 6.8 World Model Claims Ledger (V0-V5)
*What it is:* Formal epistemological tracking with verification levels, contradiction quarantine, and causal graphs.
*Why skip:* Academic-grade knowledge management for a personal AI assistant is over-engineering. The Greg Gate *principle* (be honest about confidence) is valuable, but the V0-V5 infrastructure is not.

### 6.9 Notification Center / Badge System
*What it is:* Never built in Gregore either — explicitly rejected in UI_UX_ARCHAEOLOGY.md.
*Why skip:* "Creates anxiety ('did I miss something?'). Goes against attention economy principles. GREGORE should be calm, not demanding."

### 6.10 Gamification
*What it is:* Badges, achievements, streaks. Also never built — explicitly rejected.
*Why skip:* "Wrong incentive structure. This isn't Duolingo."


---

## Section 7: Recommended Sprint Sequence

Based on this audit, four follow-up sprints would close the most impactful gaps, ordered by value to the daily driver experience.

### Sprint 15.2 — Ghost Activation + Receipt Footer
**Theme:** Make the Ghost real
**Estimated effort:** 1-2 sessions
**Impact:** Transforms GregLite from "chat wrapper" to "cognitive operating system"

Tasks:
1. Wire `.ghost-pulse` animation to input field during checking state (trivial — CSS class toggle)
2. Implement actual Ghost pre-send validation (call a lightweight check endpoint before sending; the Ghost store infrastructure already exists)
3. Build CollapsibleReceipt component: collapsed one-liner ("✓ Validated · $0.002 · 234ms"), expandable to show model, Ghost checks, confidence
4. Implement Orchestration Theater: auto-expand receipts for first 5 messages per conversation, then prompt for preference
5. Fix message styling to match Gregore spec: add `rgba(0, 212, 232, 0.1)` background on user messages, `rgba(26, 30, 36, 0.6)` on AI messages, 3px left border (currently 2px), 8px border-radius, 16px padding (currently 8px), 80% max-width

Dependencies: None. All infrastructure exists.
Sacred Laws activated: #6 (Transparency), #12 (Ghost Veto)

### Sprint 15.3 — Adaptive Override + Voice Guide
**Theme:** Ghost learns; voice solidifies
**Estimated effort:** 1-2 sessions
**Impact:** Ghost warnings become useful instead of annoying; brand voice is documented

Tasks:
1. Replace Decision Gate blocking pattern with Adaptive Override three-choice pattern: "Just this once" / "Always allow [category]" / "Never warn about this"
2. Build override policy store (persisted to KERNL)
3. Add Settings → Ghost → Override Policies management panel
4. Create VOICE_GUIDE.md reference document from Section 1 of this audit
5. Audit all UI copy against voice guide (StatusBar, Message, empty states, error states)
6. Fix Law #1 violation: change message edit from truncate to soft-delete (mark superseded)

Dependencies: Sprint 15.2 (Ghost must be functional before overrides make sense)
Sacred Laws activated: #1 (Append-Only), #2 (Earned Autonomy), #10 (Attention Economy)

### Sprint 15.4 — Memory Shimmer + Settings-Driven Complexity
**Theme:** Make memory visible; let users control detail
**Estimated effort:** 2-3 sessions (backend + frontend)
**Impact:** Users see accumulated intelligence; power users get power, casual users get clarity

Tasks:
1. Backend: add memory attribution to chat responses — when Claude's response draws on prior conversation context (via KERNL/vector search), tag which segments are memory-influenced
2. Frontend: wrap memory-attributed text segments in `.memory-match` spans (CSS already exists)
3. Add hover tooltip showing source memory (conversation title, date, snippet)
4. Add click-to-expand for full context chain
5. Settings panel: add Receipt detail level (Full/Compact/Minimal/Hidden)
6. Settings panel: add Ghost verbosity (Verbose/Normal/Quiet)
7. Wire density store to actually control receipt/metadata visibility (currently only controls spacing)
8. Implement Grandma Test compliance: default density hides AEGIS/KERNL/EoS labels in StatusBar; "Power" mode shows them

Dependencies: Sprint 15.2 (receipts must exist to have detail levels)
Sacred Laws activated: #5 (Protect Deep Work via settings), #7 (Small Context via compression display)

### Sprint 15.5 — Polish Pass + Blast Radius Tiers
**Theme:** Professional finish; safety foundation for Agent SDK growth
**Estimated effort:** 1 session
**Impact:** Micro-interactions create premium feel; blast radius prevents Agent SDK incidents

Tasks:
1. Add framer-motion whileHover/whileTap to all primary buttons (scale: 1.05 / 0.95)
2. Verify Inspector Drawer has four tabs (Memory/Intent/Cost/State) matching Gregore spec
3. Verify drawer spring parameters (stiffness: 300, damping: 30)
4. Verify logo breathing animation is active
5. Add blast_radius field to Agent SDK job definitions
6. Wire Decision Gate to auto-trigger at blast_radius >= 2
7. System prompt update: instruct Claude to communicate confidence levels (Greg Gate spirit) and cite evidence (Law #11 spirit)

Dependencies: Sprints 15.2-15.4 complete
Sacred Laws activated: #2 (Earned Autonomy), #3 (Reversibility), #11 (Evidence Required)

---

## Appendix: File Reference Map

| GregLite File | Audit Relevance |
|--------------|-----------------|
| `app/app/globals.css` | Design tokens (100% match), animations (defined but not wired) |
| `app/components/chat/Message.tsx` | Message rendering (missing receipt, missing memory shimmer, wrong message styling) |
| `app/components/chat/ChatInterface.tsx` | Main layout (correct architecture, Ghost wiring incomplete) |
| `app/components/ui/StatusBar.tsx` | Bottom chrome (excellent voice, violates Grandma Test for defaults) |
| `PROJECT_DNA.yaml` | Confirms Claude-only, confirms Gregore design system carries over |

| Gregore Source | Key Insights Extracted |
|---------------|----------------------|
| `docs/UI_UX_FINAL_DIRECTION.md` | Gold standard spec: single surface + drawer, receipt footer, orchestration theater |
| `docs/DESIGN_SYSTEM.md` | Full token spec, component patterns, animation system |
| `docs/SACRED_LAWS.md` | 12 laws — 6 applicable to GregLite, 3 already partially enforced |
| `PRODUCT_VISION.md` | Strategic position, product funnel (Lite → Full) |
| `docs/UI_UX_ARCHAEOLOGY.md` | What failed and why — triptych deletion, council process |
| `docs/systems/GHOST.md` | Ghost = R > 0 self-observer, isolation principle, veto authority |
| `docs/engines/ENGINE-F.md` | Greg Gate: epistemic honesty, four response modes |
| `docs/systems/HOMEOSTASIS.md` | Behavioral profiles → spirit preserved in AEGIS, don't port literally |
| `docs/engines/ENGINE-A.md` through `ENGINE-I.md` | Multi-model engines → Skip List (not applicable to Claude-only) |

---

*End of GREGORE_AUDIT.md — Sprint 15.1 Research Output*
*No code was written. No GregLite files were modified.*
