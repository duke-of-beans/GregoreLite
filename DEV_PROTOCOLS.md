# GREGORE LITE — DEV PROTOCOLS
**Version:** 1.0.0  
**Last Updated:** February 28, 2026  
**Purpose:** Bootstrap reference for execution sessions — resolves the dependency on D:\Dev\ files without requiring them to be in this repo

---

## §1 — DEPENDENCY MAP

Every GregLite execution session must load two files from D:\Dev\ before writing a single line of code. These files are not duplicated here because they evolve globally across all dev projects — duplicating them creates drift. This file instead documents what they contain, why they matter to GregLite specifically, and what to do if they cannot be loaded.

| File | Path | Purpose |
|---|---|---|
| Technical Standards | `D:\Dev\TECHNICAL_STANDARDS.md` | Canonical library choices — what gets used for caching, retry, logging, validation, testing, HTTP, dates, etc. All GregLite agent sessions must check this before reaching for any infrastructure library. |
| Dev Instructions | `D:\Dev\CLAUDE_INSTRUCTIONS.md` | Session management protocol — bootstrap sequence, authority protocol (7 stop triggers), quality gates, TDD cycle, checkpointing cadence, documentation sync rules, LEAN-OUT mandate. |

**Load order in every execution session:**
```
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. PROJECT_DNA.yaml (this repo)
4. STATUS.md (this repo)
5. BLUEPRINT_FINAL.md §relevant-phase (this repo)
6. TypeScript build verify: npx tsc --noEmit
```

---

## §2 — TECHNICAL STANDARDS EXTRACT (GregLite-Relevant)

What follows is a GregLite-specific extraction of the decisions in TECHNICAL_STANDARDS.md that are most likely to come up during build. This is a reference, not a replacement — when in doubt, load the source file.

### Library Decisions (Locked)

| Need | Library | Version | Notes |
|---|---|---|---|
| In-memory cache | `lru-cache` | ^11.0.0 | Single-process caching |
| Distributed cache | `ioredis` | ^5.0.0 | Multi-process shared cache |
| Retry logic | `p-retry` | ^6.0.0 | Exponential backoff, abort on non-retryable |
| Job queue | `BullMQ` | latest | + Redis. Never build custom queue. |
| Logging | `winston` | ^3.17.0 | Structured logging, always. No console.log in production. |
| Validation | `zod` | ^3.24.0 | TypeScript-first, runtime type checking |
| HTTP requests | `axios` | ^1.7.0 | With p-retry wrapper |
| Date handling | `date-fns` | ^3.0.0 | Tree-shakeable, immutable. Never moment.js. |
| Testing | `vitest` | ^2.0.0 | Vite-native. Jest-compatible. |
| Config management | `cosmiconfig` | ^9.0.0 | Used by ESLint, Prettier, Babel |
| CLI | `commander` | ^12.0.0 | If CLI tools are needed |

**GregLite-specific additions (not in TECHNICAL_STANDARDS.md v1.0.0):**
| Need | Library | Notes |
|---|---|---|
| Embeddings | `@xenova/transformers` | ONNX runtime, quantized. See BLUEPRINT §5.1. |
| Vector search | `sqlite-vec` | Rust extension. See BLUEPRINT §5.2. |
| Filesystem watch | Rust `notify` crate | Tauri-native. See BLUEPRINT §6.2. |
| App framework | Tauri + Next.js 16 + React 19 | Full stack locked in blueprint. |
| State management | Zustand | Carried from Gregore scaffold. |
| SQLite | `better-sqlite3` | With WAL mode. See BLUEPRINT §3.1. |

### Forbidden Anti-Patterns (Never Build)
- Custom queue → BullMQ
- Custom cache → lru-cache or Redis
- Custom retry → p-retry
- Custom logger → winston
- Custom validation → zod
- Custom AST → TypeScript Compiler API or ts-morph
- Date parsing by hand → date-fns
- Fetch without retries → wrap in p-retry

### TypeScript Config (Non-Negotiable)
```json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "target": "ES2022",
    "moduleResolution": "bundler"
  }
}
```

---

## §3 — AUTHORITY PROTOCOL EXTRACT (GregLite-Relevant)

From D:\Dev\CLAUDE_INSTRUCTIONS.md §3. These triggers apply to every GregLite execution session. When any trigger fires, stop and surface to David before continuing.

**Trigger 1 — Architectural Whack-A-Mole**  
Same fix applied 3+ times, or treating symptoms instead of root cause. Stop. Identify the root. Propose rebuilding properly.

**Trigger 2 — Long Operations (>8 minutes)**  
Any operation estimated >8 minutes without checkpoints. Break into checkpointed chunks. Get confirmation before starting.

**Trigger 3 — Documentation Drift**  
Critical decision made mid-session. Update STATUS.md and relevant blueprint sections immediately. Not negotiable.

**Trigger 4 — Quality Violations**  
Mocks, stubs, placeholders, missing error handling, TODOs without tickets. Blocking. Cannot proceed until fixed.

**Trigger 5 — Large File Anti-Pattern**  
File >1,000 lines + frequent queries + machine reads. Propose JSON index + split files.

**Trigger 6 — LEAN-OUT Challenge**  
Building a queue, cache, scheduler, rate limiter, or other generic infrastructure. Stop. Search npm/cargo first. Only build if domain-specific.

**Trigger 7 — Blueprint Violation**  
Implementing something without reading the relevant blueprint section first. Stop. Read the spec. Then build.

---

## §4 — QUALITY GATES (NON-NEGOTIABLE)

From D:\Dev\CLAUDE_INSTRUCTIONS.md §6. These are mandatory for every GregLite agent session.

1. TypeScript: `npx tsc --noEmit` must return 0 errors before any commit
2. No mocks or stubs in production code
3. No placeholders or TODOs without a logged KERNL task
4. Every new module has vitest tests written before implementation (TDD)
5. All tests passing (green) before commit
6. STATUS.md updated at session end with what was completed
7. Git commit message follows conventional format: `type(scope): message`
8. All Agent SDK sessions pass SHIM quality gate before result is marked complete

---

## §5 — CHECKPOINTING PROTOCOL

From D:\Dev\CLAUDE_INSTRUCTIONS.md §4. Every 2-3 tool calls during an execution session:

1. Identify decisions made since last checkpoint
2. Update affected docs (STATUS.md minimum; blueprint sections if architecture changed)
3. Git add / commit / push to remote
4. KERNL auto_checkpoint with current step, decisions, next steps

Session end:
1. TypeScript build verify (0 errors)
2. Final doc sync
3. Git commit + push
4. KERNL mark_complete

---

## §6 — FALLBACK BEHAVIOR

If `D:\Dev\CLAUDE_INSTRUCTIONS.md` or `D:\Dev\TECHNICAL_STANDARDS.md` cannot be loaded at session start:

1. Stop immediately and notify David which file failed
2. Do not proceed with assumptions
3. The condensed extracts in §2 and §3 of this file cover the most common GregLite scenarios
4. Flag that the session is operating with limited context — any infrastructure decision should be deferred or verified manually against the source files before implementation

The fallback is a safety net, not a replacement. The source files contain detail this extract does not.

---

## §7 — VERSION TRACKING

When either source file is updated, this section should be updated to reflect the version consumed during GregLite development. This creates an audit trail: if a future session loads a newer version of TECHNICAL_STANDARDS.md that changes a library decision, we can identify which GregLite sessions built against the old standard.

| File | Version Loaded | Date |
|---|---|---|
| TECHNICAL_STANDARDS.md | v1.0.0 (updated 2026-01-24) | 2026-02-28 |
| CLAUDE_INSTRUCTIONS.md | v1.3.0 (updated 2026-01-27) | 2026-02-28 |
