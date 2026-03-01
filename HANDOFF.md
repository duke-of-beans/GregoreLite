# GREGORE LITE — SESSION HANDOFF
**Created:** February 28, 2026  
**From:** Architectural deliberation session (Council synthesis + Q&A)  
**To:** Next session — write Council prompts, finalize blueprint amendments  
**Status:** Context preserved. Ready to resume without loss.

---

## WHAT THIS SESSION ACCOMPLISHED

Two phases of work happened in this session.

**Phase 1 — Council Synthesis:**
David ran Round 1 of the Gregore Lite Council across multiple LLMs (Gemini, Gemini 2, DeepSeek, DeepSeek 2, GPT, GPT 2, Claude). All Round 1 outputs were synthesized into a final blueprint by Claude. That synthesis is saved at `D:\Downloads\greglite synth.md` — it is the authoritative foundation.

**Phase 2 — Q&A and Amendments:**
David asked seven critical questions that revealed gaps and updates needed in the blueprint. Each is resolved below.

---

## THE SEVEN AMENDMENTS (Apply to Blueprint Before Proceeding)

### Amendment 1: Session End Detection
**Gap:** Blueprint assumed David would signal session end. He never does.  
**Fix:** Session end is inferred from three triggers:
1. Tauri `on_window_event` fires on app close (hard stop, always fires)
2. Idle timeout — no user input for configurable period (default: 20 minutes)
3. Explicit thread close action from UI

All three feed the same end sequence: final checkpoint → decision extraction → session summary via dedicated API call → write to KERNL → AEGIS: SUSPEND or LOW_POWER.

### Amendment 2: Dev Protocols Must Be Loaded at Bootstrap
**Gap:** Blueprint did not incorporate David's established development standards.  
**Fix:** Phase 1 bootstrap sequence must load these files as first-class inputs alongside KERNL context:
- `D:\Dev\TECHNICAL_STANDARDS.md` — LEAN-OUT mandate, library choices, forbidden anti-patterns, vitest/winston/zod/p-retry/BullMQ standards
- `D:\Dev\CLAUDE_INSTRUCTIONS.md` — authority protocol, quality gates, TDD cycle, four-pillar doc sync, checkpointing protocol

These are not optional reference docs. They define how Gregore Lite gets built. Every Cowork/Agent SDK session working on the codebase loads them.

### Amendment 3: Borrow Gregore Scaffold Aggressively
**Gap:** Blueprint treated Gregore as inspiration. It should be the starting point.  
**Fix:** The first Cowork/Agent SDK session audits `D:\Projects\Gregore\app\` before writing a single new line. What carries over directly:

**Stack (identical, zero changes):**
- Tauri + Next.js 16 + React 19 + TypeScript strict
- Zustand (state), SQLite via better-sqlite3, BullMQ + Redis
- Vercel AI SDK (`@ai-sdk/anthropic` already installed)
- Vitest, Husky, Prettier, ESLint — full dev toolchain

**UI/Design (direct copy):**
- CSS variable system (`--deep-space`, etc.)
- Breathing animation patterns, dark theme, Geyser G branding
- Design philosophy: Grandma Test, Progressive Disclosure, Keyboard-First
- Shortcut patterns, command palette approach

**Components (reusable directly or with adaptation):**
- `ChatInterface.tsx` → becomes strategic thread surface
- `MessageList.tsx`, `Message.tsx`, `InputField.tsx`, `SendButton.tsx`
- `Header.tsx`, `KeyboardShortcuts.tsx`
- Ghost integration patterns from `ChatInterface.tsx`

**Estimated time savings:** 40-60% of Phase 1 work already exists.

### Amendment 4: Cowork Cannot Be Programmatically Spawned
**Critical discovery — changes the blueprint significantly.**  
**Gap:** Blueprint assumed `cowork --manifest path/to/manifest.json` was possible.  
**Reality:** Cowork is a UI product. It has no CLI, no manifest API, no programmatic entry point.  
**Fix:** Replace all "Cowork Integration" references with **Claude Agent SDK Integration**.

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is what Cowork is built on. It supports:
- Programmatic spawn with `query()` async function
- Working directory scoping (`cwd` option)
- Custom tools as in-process MCP servers (no separate process needed)
- Permission modes: `acceptEdits`, `bypassPermissions`
- Bidirectional interactive conversations via `ClaudeSDKClient`

**How the manifest protocol adapts:**
- Manifest schema stays exactly as designed — it becomes the structured system prompt injected into each Agent SDK session
- Spawn mechanism changes from "write a file and watch for it" to calling `claude_agent_sdk.query()` with manifest as context
- Results stream back into Gregore Lite's job queue via the async iterator
- This is cleaner, more reliable, and eliminates the file-watching hack

**LEAN-OUT check:** Satisfied. Agent SDK is a battle-tested Anthropic library.

### Amendment 5: Ghost Thread — Expanded Scope
**Update:** David explicitly approved full context access.  
**Ghost now has access to:**
- Full disk (all drives — file system watcher across everything)
- All email/inbox (IMAP or OAuth — Gmail, Outlook)
- Eventually: SMS and phone calls (needs separate design session — bridge required)

**Architectural implication:** Ghost cannot read everything every time it surfaces something. Needs a delta-based ingest model:
- New content (files created/modified, new emails) → chunked → embedded → written to vector index
- Ghost queries the index, not raw files
- This affects Phase 1 data model decisions and belongs in Ghost Council session

### Amendment 6: War Room is Phase 2, Schema is Phase 1
**Update:** War Room Dependency Visualization moves from "cut" to Phase 2.  
**Requirement:** Phase 1 manifest schema must carry dependency graph fields from day one.
- `dependencies: string[]` field in every manifest is **required, not optional**
- Job queue stores parent/child relationships in SQLite from Phase 1
- No schema migration required when Phase 2 builds the visualization

### Amendment 7: Self-Evolution Mode — In Scope, Not Cut
**Update:** David wants to discuss before nixing. Decision: it's in scope.  
**Concept:** Gregore Lite can open a Claude Agent SDK session against its own source code at `D:\Projects\GregLite\`. That session reads the codebase, designs an upgrade, runs it through SHIM quality gates, produces a PR-ready diff. David reviews in GitHub and merges. The session runs on the same manifest schema as any other worker session.  
**Why it's distinctly David:** Gregore Lite evolves through the same workflow it uses to build everything else. David is always the merge gate.  
**Risk:** Requires mature quality gates. Mandatory staging — all self-evolution runs against a branch, never main, until CI passes.  
**Placement:** Phase 5 or post-launch. But manifest schema and KERNL logs must distinguish self-evolution sessions from regular sessions from Phase 1.

---

## THREE COUNCIL SESSIONS NEEDED

The next session's primary job is writing these three Council prompts. Each is a standalone deliberation.

### Council Session 1: Cross-Context Engine
**Why a dedicated Council:** This is the soul of the system — what separates Gregore Lite from a prettier Claude Desktop. It has more unsolved design questions than anything else and is the feature most likely to be underbuilt under time pressure.

**Questions that need architectural decisions:**
- What embedding model? (`all-MiniLM-L6-v2` via transformers.js? A hosted API? Something else?)
- How do we handle years of conversation history without performance collapse at query time?
- How does the vector index scale? (`sqlite-vec`? FAISS? What are the tradeoffs at 1M+ messages?)
- How does Ghost Thread feed the index vs. query from it? (producer vs. consumer role)
- How do we tune thresholds (0.80 for "you already built this", 0.85 for "you asked this") before we have empirical data?
- What is the "you already built this" gate — a hard block on manifest generation or a suggestion?
- What does the proactive surfacing UI actually look like in practice? When does it become noise?
- Background thread cadence — how often, what triggers, how much compute?
- Cold start performance — how do we warm the index fast enough for the <60s boot target?

### Council Session 2: Ghost Thread Full Architecture
**Why a dedicated Council:** David approved full disk + email + eventual phone access. The data ingestion architecture, delta-index strategy, privacy/security model for sensitive data, and connector architecture for email/SMS are all unresolved and affect Phase 1 schema decisions.

**Questions that need architectural decisions:**
- Delta-based ingest model — exactly how does new content flow from filesystem watcher → chunker → embedder → index?
- Email/inbox integration — IMAP vs. OAuth? How do we handle Gmail vs. Outlook vs. other providers?
- Privacy model — what never gets indexed? (Passwords, financial credentials, medical records — what is the exclusion policy?)
- Ghost's interrupt logic — the "2 per day hard limit" needs more precise design. What determines interrupt-worthy? How is the threshold computed, not just declared?
- Phone/SMS bridge — this needs a separate architecture sketch even if it's a later phase
- Security — all of this sensitive data lives in the KERNL vector index locally. What is the encryption model? (Gregore already has AES-256 SQLite — carry that forward)
- Ghost's identity — does it run as a background Claude API session? How is it different from the pattern detection background thread? Are these the same thing or two distinct processes?

### Council Session 3: Claude Agent SDK Integration + Self-Evolution Mode
**Why a dedicated Council:** Now that we know Cowork cannot be programmatically spawned, the entire "worker session" architecture needs a proper design pass with Agent SDK as the foundation. Self-Evolution Mode folds in because it runs on the same infrastructure.

**Questions that need architectural decisions:**
- Exact manifest injection pattern — how does the JSON manifest become a Claude Agent SDK system prompt? What format? What's the injection schema?
- Streaming results back to job queue — how does the `query()` async iterator feed into Gregore Lite's real-time job queue UI?
- Permission model — what tools does each session type get? (`acceptEdits` for code sessions, read-only for research sessions, etc.)
- Error handling — what happens when an Agent SDK session fails midway? How does the result report reflect partial completion?
- Cost accounting — Agent SDK sessions burn tokens. How does Gregore Lite track and surface per-session cost?
- Concurrency — 1-8 simultaneous workers. What does concurrent Agent SDK session management look like? Rate limiting?
- Self-Evolution Mode specifics — staging branch requirement, KERNL log tagging for self-evolution sessions, the CI gate before David can merge
- SHIM integration — how does SHIM run as a quality gate on Agent SDK output? Is it a post-processing step or does it run inside the session as a tool?

---

## BUILD ORDER (Confirmed Final)

**Phase 0 — Scaffold Setup (Day 1, ~2 hours)**
Copy `D:\Projects\Gregore\app\` to `D:\Projects\GregLite\app\`. Strip Gregore-specific features. Verify TypeScript builds clean. This is not a Cowork session — this is a manual copy + audit.

**Phase 1 — Foundation (3-5 sequential sessions, days 1-3)**
Tauri shell, SQLite schema with WAL mode, Claude API client with streaming, KERNL native module integration, single strategic thread UI, Continuity diff checkpoint on every response.
Completion gate: conversation survives app restart.

**Phase 2 — Parallel workstreams (all simultaneous after Phase 1)**
- 2A: Claude Agent SDK Integration — manifest schema, session spawn, result ingestion, job queue UI (4-5 sessions)
- 2B: Context Panel + KERNL Surface — session bootstrap, recent decisions display (3-4 sessions)
- 2C: AEGIS Integration — workload signal sender, override UI, signal log (2-3 sessions)
- 2D: Artifact Rendering — Monaco, Sandpack, markdown, artifact panel (3-4 sessions)
- 2E: War Room Foundation — job dependency graph in SQLite, schema ready for Phase 2 visualization

**Phase 3 — Intelligence Layer (after Phase 2)**
sqlite-vec + FTS5, embeddings, three indexes (pattern/artifact/decision), proactive suggestion banners, background thread, passive ingestion bridge for Deep Research

**Phase 4 — Council System**
Trigger detection, Council mode UI, decision record writer, escalation lock

**Phase 5 — Quality Layer**
SHIM native integration, Eye of Sauron scheduler, quality gate enforcement in manifest flow, health scores in context panel

**Phase 6 — Ghost Thread**
Silent Claude Agent SDK background instance, full disk + email ingest pipeline, delta-index model, interrupt threshold engine, context panel card surface

**Phase 7 — Self-Evolution Mode**
Agent SDK sessions against GregLite own source, staging branch enforcement, KERNL self-evolution tagging, CI gate integration

---

## WHAT THE NEXT SESSION MUST DO

1. Load this file: `D:\Projects\GregLite\HANDOFF.md`
2. Load the Council synthesis: `D:\Downloads\greglite synth.md` (skim — the final synthesis from DeepSeek 2 and Claude sections are the primary reference)
3. Load `D:\Projects\GregLite\PROJECT_DNA.yaml`
4. Write the three Council prompts and save them to `D:\Projects\GregLite\COUNCIL_PROMPTS.md`
5. Write the amended final blueprint incorporating all seven amendments and save to `D:\Projects\GregLite\BLUEPRINT_FINAL.md`
6. Create `D:\Projects\GregLite\STATUS.md` with initial build status

Do NOT start building yet. Council prompts first, then blueprint amendment, then execution.

---

## KEY FILES REFERENCE

| File | Location | Purpose |
|------|----------|---------|
| Council synthesis (all 6 members) | `D:\Downloads\greglite synth.md` | Primary source of truth for architecture |
| This handoff | `D:\Projects\GregLite\HANDOFF.md` | Resume context |
| Project DNA | `D:\Projects\GregLite\PROJECT_DNA.yaml` | Project identity |
| Gregore scaffold | `D:\Projects\Gregore\app\` | Starting point for build |
| Gregore design system | `D:\Projects\Gregore\docs\DESIGN_SYSTEM.md` | UI/UX carry-over |
| Gregore UI spec | `D:\Projects\Gregore\docs\UI_UX_FINAL_DIRECTION.md` | Full UI direction |
| Dev standards | `D:\Dev\TECHNICAL_STANDARDS.md` | LEAN-OUT, library choices |
| Dev instructions | `D:\Dev\CLAUDE_INSTRUCTIONS.md` | Protocols, quality gates |
| AEGIS | `D:\Dev\aegis\` | Resource manager — HTTP API for workload signals |

---

## CONVERSATION TRANSCRIPT

The full conversation that produced this handoff is archived at:
`/mnt/transcripts/2026-03-01-05-13-21-gregore-lite-council-architecture.txt`

This transcript contains:
- The full Council Round 1 prompt (both versions)
- The Round 2 synthesis prompt
- The complete Q&A session with all seven amendments
- All architectural deliberation context

If anything in this handoff seems incomplete, the transcript is the definitive source.
