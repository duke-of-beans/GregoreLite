GREGLITE SPRINT 15.2 — Voice, Help & Jargon Audit
Make GregLite speak human, not developer | March 2026

YOUR ROLE: Audit and rewrite ALL user-facing text in GregLite to apply the Gregore brand voice and eliminate developer jargon. An average user who has never heard of EoS, SHIM, KERNL, or AEGIS should understand every label, tooltip, notification, and error message. David is CEO. Zero debt.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\GREGORE_AUDIT.md — READ FULLY, especially Section 1 (Brand Voice). This was produced by Sprint 15.1 and contains the compiled voice guide.
4. D:\Projects\GregLite\app\app\globals.css
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- About to change any logic, API, or data model — this is COPY ONLY
- A label change would break a test assertion — update the test
- Sonnet has failed on the same problem twice → spawn Opus subagent

---

BRAND VOICE (apply to ALL user-facing text):
- Deadpan professional: not chatty, not cold. Direct.
- Data-forward: lead with facts and numbers when relevant
- Approachable: a wise teacher who respects your time
- Sardonic: dry wit, not sarcastic. Occasional deadpan humor in empty states and error messages.
- NEVER condescending, NEVER cutesy, NEVER exclamation marks

JARGON TRANSLATION TABLE (internal name → user-facing label):
- KERNL → "Memory" (tooltips can say "Powered by KERNL" in fine print)
- EoS / Eye of Sauron → "Code Quality"
- SHIM → "Pattern Analysis"
- AEGIS → "System Monitor" or "Resource Manager"
- Decision Gate → "Safety Check" or just "Review Required"
- Sacred Principle → drop this entirely from user-facing copy
- Ghost → keep "Ghost" (it's a branded feature name, not jargon)
- Transit Map → keep (it's a user feature name)
- Haiku/Sonnet/Opus → keep (users understand model names)

---

TASK 1: Status bar copy audit

File: app/components/ui/StatusBar.tsx

Current: "COST TODAY: $0.0000 · JOBS: 0 active · AEGIS: IDLE · KERNL: ●"

Rewrite to be human-readable. Examples:
- "AEGIS: IDLE" → "System: Idle" or just show an icon with tooltip
- "KERNL: ●" → "Memory: Ready" with tooltip "KERNL memory index is up to date"
- Cost and Jobs are fine — they're already clear

TASK 2: Inspector drawer tab labels

File: app/components/inspector/InspectorDrawer.tsx (or wherever tabs are defined)

Current tabs: Thread / KERNL / Quality / Jobs / Costs / Learning

Rewrite:
- "KERNL" → "Memory"
- "Quality" is fine but add a tooltip: "Code quality analysis powered by Eye of Sauron"
- "Learning" is fine — it's clear enough
- All tab contents: scan for jargon in headers, labels, empty states

TASK 3: Settings panel copy audit

File: app/components/settings/ (all files)

Scan every label, description, and placeholder. Common issues:
- AEGIS port / connection test → "System Monitor" section
- EoS references → "Code Quality"
- SHIM references → "Pattern Analysis"
- Technical labels without explanation → add subtitle text

TASK 4: Onboarding wizard copy

Files: app/components/onboarding/OnboardingStep*.tsx

The 4-step wizard is a user's first impression. Every step needs:
- Clear, non-technical language
- Brief explanation of WHY each step matters (not what the technology is)
- Step 1 (API Key): fine as-is
- Step 2 (KERNL): should say "Memory Setup" — "GregLite remembers your conversations, decisions, and context across sessions."
- Step 3 (AEGIS): should say "System Monitor" — "Optionally connect to resource monitoring for intelligent workload management." Make it clear this is OPTIONAL.
- Step 4 (Ready): should set the right expectation

TASK 5: Error messages and empty states

Scan ALL components for error messages, empty states, and fallback text:
- Apply brand voice: deadpan, helpful, occasionally sardonic
- Example empty state (War Room, no jobs): "Nothing running. The workers are on break." (sardonic)
- Example error: "Couldn't reach the API. Check your key in Settings." (direct, actionable)
- NO generic "An error occurred" messages — every error should say what happened and what to do

Search for: "error", "empty", "no data", "loading", "failed", "not found" across all components.

TASK 6: Decision Gate copy

Files: app/lib/decision-gate/ (messages), app/components/ (gate UI)

Current: "⚠ Decision Gate active — Detected language suggesting a temporary fix or technical debt. This conflicts with Option B Perfection."

Rewrite: "⚠ Review Required — This looks like a temporary fix. Want to reconsider?" (or similar — direct, not preachy, no internal jargon like "Option B Perfection")

Each gate trigger type should have a human-readable message:
- repeated_question → "You've asked about this a few times. Want me to dig deeper?"
- sacred_principle_risk → "This looks like a shortcut. Proceed?"
- irreversible_action → "This can't be undone. Confirm?"
- low_confidence → "I'm not confident about this. Want me to verify?"
- contradicts_prior → "This contradicts a previous decision. Review?"

TASK 7: Tooltips and help text

Add tooltips to every technical indicator that a new user would see:
- Status bar items (each one gets a tooltip)
- Inspector drawer section headers
- Transit Map controls (zoom indicator, metadata toggle)
- Settings panel items
- Context panel sections

Use the `title` attribute for simple tooltips or a Tooltip component if one exists.

TASK 8: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing (update test assertions for changed copy)
3. Read through the app as a new user — does every label make sense without context?
4. Update STATUS.md
5. Commit: "copy: Sprint 15.2 — voice, jargon, and help audit (Gregore brand voice, user-friendly labels, tooltips)"
6. Push

---

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. This is COPY ONLY — do NOT change any logic, APIs, data models, or component structure
3. Every label visible to a user must be understandable by someone who has never heard of KERNL/EoS/SHIM/AEGIS
4. Brand voice: deadpan professional, data-forward, sardonic. NOT cutesy, NOT generic.
5. Use cmd shell (not PowerShell)
6. Read GREGORE_AUDIT.md Section 1 (Brand Voice) BEFORE starting any changes
