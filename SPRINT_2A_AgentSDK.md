# SPRINT 2A — Agent SDK Integration
## GregLite Phase 2 | Parallel Workstream A
**Status:** READY TO QUEUE (after Phase 1 complete)  
**Depends on:** Phase 1 complete (Sprint 1E gates passed)  
**Parallel with:** 2B, 2C, 2D, 2E  
**Estimated sessions:** 4–5

---

## OBJECTIVE

Implement the Claude Agent SDK worker session infrastructure. GregLite can spawn bounded, auditable, scoped execution sessions against a manifest. This is the "employees" layer — the workforce that runs overnight jobs, code sessions, and doc tasks.

**Success criteria:**
- Strategic thread can generate a task manifest
- Manifest spawns an Agent SDK session via `@anthropic-ai/claude-agent-sdk`
- Session writes progress events to KERNL job table
- Job queue UI shows live status
- Cost captured per session
- Session completes and writes result report to KERNL

---

## NEW FILES TO CREATE

```
app/lib/agent-sdk/
  index.ts          — public API (spawn, kill, status)
  manifest.ts       — TaskManifest builder and validator
  executor.ts       — wraps Agent SDK query(), handles streaming events
  job-tracker.ts    — writes job state to KERNL manifests table
  cost-tracker.ts   — captures token usage, computes cost via pricing.ts
  types.ts          — TaskManifest, ResultReport, JobState interfaces
  
app/components/jobs/
  JobQueue.tsx      — job list panel (right sidebar)
  JobCard.tsx       — single job with status, progress, cost
  ManifestBuilder.tsx — form to create manifest from strategic thread
```

---

## MANIFEST INJECTION FORMAT

Inject manifest as JSON in system prompt, exactly as specified in BLUEPRINT_FINAL.md §4.3.1:

```typescript
function buildAgentSystemPrompt(manifest: TaskManifest): string {
  return `You are a bounded execution worker operating inside Gregore Lite.

The following JSON is a SYSTEM CONTRACT.
It is authoritative and non-negotiable.

Rules:
- Treat all fields as binding constraints.
- Success is defined ONLY by \`success_criteria\`.
- If goals conflict with constraints, constraints win.
- You may not infer additional scope.
- You may only modify files explicitly listed in the manifest.

--- BEGIN SYSTEM MANIFEST (JSON) ---
${JSON.stringify(manifest)}
--- END SYSTEM MANIFEST ---

Execution Protocol:
- Execute deterministically.
- Do not emit chain-of-thought.
- Write files directly using provided tools.
- If blocked, stop and report precisely why.

Completion Protocol:
- Summarize changes made.
- List all modified files.
- Confirm which success criteria were met and which were not.`;
}
```

---

## JOB STATE MACHINE

```
SPAWNING → RUNNING → WORKING → VALIDATING → COMPLETED
                                           → FAILED
                                           → INTERRUPTED
```

State transitions map to Agent SDK events as per BLUEPRINT_FINAL.md §4.3.2.

---

## COST ACCOUNTING

Import `pricing.ts` from services layer (carried from Gregore). Per-session soft cap: $2 (warn at $1.60). Global daily hard cap: $15 (blocks new sessions). Caps configurable in `app/lib/agent-sdk/config.ts`.

---

## JOB QUEUE UI LAYOUT

Right panel, 25% width. Each job card shows:
- Title (from manifest)
- Status badge (color-coded)
- Task type icon
- Step count (e.g. "3/8 tasks")
- Live cost ticker
- Kill button (active while running)
- Expand → shows live log tail

---

## CONCURRENCY

Max 8 parallel sessions. Priority queue: strategic > self_evolution > code/test > docs/research. Session 9+ shows queue position. Implement as simple in-memory priority queue for Phase 2 — BullMQ upgrade is Phase 3.

---

## GATES

- [ ] Spawn a worker session from UI
- [ ] Job appears in queue with SPAWNING status immediately
- [ ] Status transitions visible in real time
- [ ] Cost captured and displayed on completion
- [ ] Result report written to KERNL manifests table
- [ ] Kill button terminates session
- [ ] pnpm type-check clean
- [ ] Commit: `sprint-2a: agent SDK integration, job queue UI`
