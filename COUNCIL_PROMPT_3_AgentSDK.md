# COUNCIL SESSION 3: CLAUDE AGENT SDK INTEGRATION + SELF-EVOLUTION MODE
**Gregore Lite Architectural Council — Round 1**  
*February 28, 2026*

---

## WHAT YOU ARE DOING

You are a member of the Gregore Lite Architectural Council. Gregore Lite is a purpose-built Tauri + Next.js 16 + React 19 + TypeScript desktop application that serves as David Kirsch's primary cognitive operating environment. It replaces Claude Desktop entirely, hits the Claude API directly, and integrates KERNL (persistent memory), SHIM (code quality analysis), AEGIS (resource management), Continuity (crash recovery), and Oktyv (browser automation) as native TypeScript modules.

This Council session addresses the entire "worker execution" architecture of the system. The original blueprint used Cowork as the execution layer. A critical discovery invalidated that design: **Cowork is a UI product with no CLI, no manifest API, and no programmatic entry point.** It cannot be spawned programmatically. Every blueprint reference to "Cowork Integration" must be replaced with **Claude Agent SDK Integration**.

This is not a minor substitution. The agent execution architecture must be redesigned from the foundation.

Self-Evolution Mode folds into this Council because it runs on the same Agent SDK infrastructure as every other worker session. The design of one constrains the design of the other.

---

## LOCKED DECISIONS — DO NOT RE-ARGUE

- **Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is the execution layer.** It supports programmatic spawn via the `query()` async function, working directory scoping via `cwd` option, custom tools as in-process MCP servers, and permission modes including `acceptEdits` and `bypassPermissions`.
- The **task manifest schema** from the previous blueprint is preserved. The JSON manifest becomes the structured system prompt injected into each Agent SDK session. The schema itself does not change — only the delivery mechanism.
- Results from Agent SDK sessions stream back into Gregore Lite's job queue via the async iterator returned by `query()`.
- Worker sessions run in parallel, 1 to 8 simultaneous sessions, scoped to specific working directories.
- The strategic thread retains exclusive authority to spawn worker sessions. Worker sessions cannot spawn other sessions.
- **Self-Evolution Mode is in scope.** Gregore Lite can open an Agent SDK session against its own source code at `D:\Projects\GregLite\`. All self-evolution runs against a staging branch, never main, until CI passes. David is always the merge gate.
- Self-evolution sessions must be distinctly tagged in KERNL logs — they are architecturally identical to regular worker sessions but must be identifiable as self-evolution in reporting and audit trails.
- **SHIM runs as a quality gate on all Agent SDK output** — both regular worker sessions and self-evolution sessions. The question of whether SHIM runs inside the session or as a post-processing step is open for this Council.

---

## BACKGROUND: HOW THE AGENT SDK WORKS

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Streaming usage (async iterator)
for await (const event of query({ prompt: "...", options: { cwd: "D:/Projects/GHM", permissionMode: "acceptEdits" } })) {
  // events include text deltas, tool calls, tool results, final result
}

// Custom tools as in-process MCP server
const response = await query({
  prompt: "...",
  tools: [myCustomMCPServer],  // in-process, no separate process needed
});
```

The manifest-as-system-prompt pattern: the structured JSON manifest (with objective, context, files, success criteria, quality gates) is serialized and injected as the beginning of the system prompt. Claude reads it as structured instructions. This is clean and requires no changes to the manifest schema.

---

## QUESTIONS FOR DELIBERATION

**Question 1: Manifest Injection — Exact Format**

How does the task manifest JSON become an effective Agent SDK system prompt?

The naive approach (JSON.stringify the entire manifest object) produces a prompt that Claude can read but may not be optimally instructed from. Design the exact injection format: What is the system prompt structure? Does the manifest serialize as raw JSON, as structured prose, as a hybrid? What framing text surrounds the manifest content to ensure Claude interprets it correctly and focuses on the right success criteria?

Provide a concrete example: take a representative manifest (e.g., "implement the commission calculation module in GHM Dashboard") and show exactly what the resulting Agent SDK system prompt looks like.

**Question 2: Streaming Results Into the Job Queue**

The Agent SDK `query()` function returns an async iterator. Gregore Lite's job queue panel needs real-time status updates. Design the complete streaming pipeline from Agent SDK event to UI:

What event types does the async iterator emit? How do you map those event types to job queue state updates (running, N tasks complete, error, done)? What is the data model for intermediate job state stored in KERNL during execution — what persists if Gregore Lite crashes mid-session and needs to reconstruct job state on restart?

How do you surface streaming text output from the worker session to David? Is there a "view live output" toggle in the job queue panel, or is all output buffered until the session completes?

**Question 3: Permission Model Per Session Type**

Different session types require different tool permissions. A code session needs to write files; a research session should be read-only; a self-evolution session needs branch management permissions.

Design the permission matrix for each session type the system will support at launch. For each type, specify: the Agent SDK `permissionMode` setting, what custom MCP tools (if any) are injected into the session, and what working directory scope is enforced.

The session types to cover: code implementation, test writing, documentation, research/analysis, self-evolution (Gregore Lite's own source), and any other types the Council identifies as needed.

**Question 4: Error Handling and Partial Completion**

Agent SDK sessions can fail midway. The failure modes include: Claude reaching a context limit mid-task, a tool call returning an unexpected error, network interruption to the Anthropic API, the task itself being impossible as specified, and Tauri process death (app crash) mid-execution.

For each failure mode, specify:
- How is the failure detected?
- What is preserved in KERNL from the partial execution?
- What does the result report contain (partial deliverables, error context, recovery suggestions)?
- What are the retry semantics — does the system attempt to resume from where it left off, or does it restart from scratch? If resume, how is "where it left off" determined?

The answer must not produce silent failures. If a session fails, David must know exactly what was completed, what was not, and what to do next.

**Question 5: Cost Accounting Per Session**

Agent SDK sessions burn tokens. Gregore Lite must track and surface per-session cost. Design the cost accounting system:

How do you capture token usage from Agent SDK session events? What is the data model for cost records in KERNL (per-session, per-project, per-time-period)? What does the cost surface look like in the UI — where does David see it, at what granularity, and what triggers a cost alert?

Are there per-session token budgets? If David spawns 6 parallel sessions, is there a total budget cap that prevents runaway API spend? Who controls that cap and where is it configured?

**Question 6: Concurrency — Managing 1 to 8 Parallel Sessions**

The system allows 1 to 8 simultaneous Agent SDK sessions. Design the concurrency management layer:
- What is the rate limiting strategy for the Anthropic API under parallel load? (Per-session token budgets, request queuing, priority ordering where the strategic thread always goes first?)
- How does KERNL handle concurrent writes from multiple active sessions without corruption? (KERNL uses SQLite with WAL mode — is that sufficient, or do you need a write queue?)
- How does AEGIS respond to 8 parallel sessions running? What workload signal does Gregore Lite send and what profile does AEGIS apply?
- Is there a session queue — if David requests session 9 but the limit is 8, what happens?

**Question 7: Self-Evolution Mode — Complete Specification**

Self-Evolution Mode allows Gregore Lite to open a Claude Agent SDK session against its own source code at `D:\Projects\GregLite\`. Design this mode completely:

*Trigger*: How does a self-evolution session get initiated? Is it David explicitly requesting it through the strategic thread, or can the Cross-Context Engine suggest self-evolution opportunities proactively?

*Branch management*: The session runs against a staging branch, never main. How is the branch created, what is its naming convention, and how does the Agent SDK session know to commit to it rather than main?

*KERNL tagging*: Self-evolution sessions must be tagged distinctly from regular sessions. Design the exact KERNL schema field(s) that distinguish self-evolution sessions, and specify what additional metadata is captured.

*CI gate*: The PR cannot merge until CI passes. How does Gregore Lite get that signal — polling GitHub API, webhook, or something else? What does David see in the UI while CI is running?

*Failure modes specific to self-evolution*: What happens if the Agent SDK session produces code that breaks the build? What happens if SHIM rejects the output? What happens if David closes Gregore Lite while a self-evolution session is mid-execution?

*Scope guardrails*: Are there parts of the Gregore Lite codebase that self-evolution sessions are prohibited from touching? Design the scope enforcement mechanism.

**Question 8: SHIM Integration — Inside the Session or Post-Processing?**

SHIM is a native TypeScript module. Agent SDK sessions are external processes. There are two integration patterns:

*Option A: Post-processing* — After the Agent SDK session completes, the Gregore Lite orchestration layer runs SHIM on the changed files and includes results in the result report. The session itself does not know about SHIM.

*Option B: In-session tool* — SHIM is exposed as a custom MCP tool injected into the Agent SDK session. Claude can call it during the session to check its own output, self-correct, and iterate until SHIM passes. David only sees the final SHIM-passing output.

Which is right, and for what session types? The answer may differ by session type. Make a recommendation with the rationale.

---

## WHAT YOUR RESPONSE MUST INCLUDE

For each question:
1. A concrete recommendation
2. The rationale
3. The failure mode if you are wrong
4. A spec, schema, or code sketch precise enough for implementation

Do not produce bullet point summaries. Write in full architectural prose. This response feeds directly into the blueprint.

---

## COUNCIL OPERATING PRINCIPLES

- Option B Perfection — the agent execution layer is the core of what makes Gregore Lite a productivity multiplier. Do not design it conservatively.
- LEAN-OUT — the Agent SDK is a battle-tested Anthropic library. Use what it provides natively before building custom infrastructure.
- Zero technical debt — the manifest schema, the permission model, and the concurrency system are all phase-1 decisions that cannot be refactored easily once sessions are running in production.
- Cost accountability is non-negotiable — if David cannot see what parallel sessions are spending, he will not trust the system.
- Self-evolution is only safe if the staging branch and CI gate are mandatory, not optional. Design enforcement into the system, not into David's discipline.

---

*Gregore Lite Architectural Council — Claude Agent SDK Integration + Self-Evolution Mode*  
*Session 3 of 3*
