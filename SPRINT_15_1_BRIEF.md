GREGLITE SPRINT 15.1 — Gregore Audit & Port Recommendations
Research sprint: what to bring from Gregore Full into GregLite | March 2026

YOUR ROLE: Audit the full Gregore codebase and design documentation. Produce a structured GREGORE_AUDIT.md recommending what to port, what to skip, and what GregLite already has. This is RESEARCH — you produce a document, not code. David is CEO.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\BLUEPRINT_FINAL.md (skim — understand what GregLite already has)
3. D:\Projects\GregLite\PROJECT_DNA.yaml

Then read the Gregore source of truth — these are your PRIMARY inputs:
4. D:\PROJECTS\Gregore\docs\UI_UX_FINAL_DIRECTION.md — the gold standard UI spec
5. D:\PROJECTS\Gregore\docs\DESIGN_SYSTEM.md — full design tokens, animation system, component patterns
6. D:\PROJECTS\Gregore\docs\SACRED_LAWS.md — 12 immutable principles
7. D:\PROJECTS\Gregore\PRODUCT_VISION.md — product identity and strategic position
8. D:\PROJECTS\Gregore\councilsynth1_ui-ux.txt — multi-LLM council synthesis on UI/UX
9. D:\PROJECTS\Gregore\docs\UI_UX_ARCHAEOLOGY.md — historical design decisions
10. D:\PROJECTS\Gregore\docs\ARCHITECTURE.md — system architecture
11. D:\PROJECTS\Gregore\docs\systems\ — read ALL files in this directory
12. D:\PROJECTS\Gregore\docs\engines\ — read ALL files in this directory
13. D:\PROJECTS\Gregore\synthesis\ — read ALL files in this directory

ALSO read the GregLite implementation to compare:
14. D:\Projects\GregLite\app\app\globals.css — current design tokens
15. D:\Projects\GregLite\app\components\chat\Message.tsx — message rendering
16. D:\Projects\GregLite\app\components\chat\ChatInterface.tsx — main layout
17. D:\Projects\GregLite\app\components\ui\StatusBar.tsx — bottom chrome

---

TASK 1: Read ALL Gregore docs

Read every file listed above. Take notes on:
- Voice and personality descriptions (look for tone, language, communication style notes — they may be embedded in council synthesis, product vision, or UI/UX docs rather than a standalone file)
- UI/UX patterns that GregLite doesn't have yet
- Design decisions that were validated through the council process
- Features that were designed but not built in Gregore
- Sacred Laws that should inform GregLite's behavior

TASK 2: Read GregLite's current implementation

Understand what GregLite already has so you can identify gaps vs duplicates:
- Design system (globals.css) — compare token-by-token with Gregore's DESIGN_SYSTEM.md
- Ghost implementation — compare with Gregore's Ghost specification
- Inspector drawer — compare with Gregore's drawer spec
- Chat interface — compare with Gregore's chat patterns (user message styling, AI response styling, receipt footer)
- Animation system — compare what exists vs what Gregore specifies (spring animations, Ghost pulse, memory shimmer)

TASK 3: Produce GREGORE_AUDIT.md

Write a structured document at D:\Projects\GregLite\GREGORE_AUDIT.md with these sections:

### Section 1: Brand Voice
Extract every note about Gregore's personality, tone, communication style from across all docs. David described it as: "Deadpan professional, data forward and approachable, a wise teacher, but also sardonic." Find the supporting evidence and compile it into a voice guide that can be applied to all GregLite copy.

### Section 2: UI/UX Patterns to Port
For each pattern, note:
- What it is
- Where it's specified in Gregore docs
- Whether GregLite has it, partially has it, or is missing it
- Priority: P0 (must have for daily driver), P1 (should have), P2 (nice to have)

Key patterns to evaluate:
- Orchestration Theater (first 3-5 messages show full detail)
- Receipt Footer (collapsed/expanded orchestration details per message)
- Ghost Pulse (ambient input border animation)
- Memory Shimmer (inline context reveals)
- Adaptive Override System (3-choice pattern: once/always/never)
- Settings-driven complexity (user chooses detail level)
- Grandma Test compliance (no jargon in default view)

### Section 3: Sacred Laws Audit
For each of the 12 Sacred Laws, assess:
- Is GregLite enforcing it? How?
- If not, should it? What would implementation look like?
- Priority

### Section 4: Design Token Gaps
Line-by-line comparison of Gregore's DESIGN_SYSTEM.md §2 with GregLite's globals.css. What's missing? What's different?

### Section 5: Animation Gaps
Compare Gregore's §4 (Animation System) with what GregLite actually renders. Ghost Pulse, Memory Shimmer, drawer slides, micro-interactions — what exists vs what's specified?

### Section 6: Skip List
Things in Gregore that should NOT be ported to GregLite:
- Multi-model Consensus (GregLite is Claude-only)
- Three-pane triptych (already rejected)
- Biological metaphors ("membrane," "organs" — explicitly deleted)
- Anything that was designed but explicitly abandoned in Gregore

### Section 7: Recommended Sprint Sequence
Based on the audit, propose 2-4 follow-up sprints to close the most important gaps, ordered by impact.

TASK 4: Commit

1. Commit: "docs: Sprint 15.1 — Gregore audit (voice, UI/UX patterns, Sacred Laws, design gaps)"
2. Push

---

NON-NEGOTIABLE RULES:
1. This sprint produces ONE document: GREGORE_AUDIT.md
2. Do NOT write any code in this sprint
3. Do NOT modify any GregLite files (except adding GREGORE_AUDIT.md)
4. Read EVERY doc listed — do not skim or skip
5. Be specific: "GregLite is missing X" with file path references, not vague recommendations
6. Use cmd shell (not PowerShell)
