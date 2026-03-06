GREGLITE SPRINT 15.0 — Bug Fixes & Quick Wins
Fix the real bugs David found on first use | March 2026

YOUR ROLE: Fix 5 specific bugs and UI issues found during first real usage of GregLite. Each is discrete, testable, and ships independently. David is CEO. Zero debt.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

---

TASK 1: Fix cost counter not updating after chat messages

BUG: The status bar shows "$0.0000" after sending and receiving messages.

ROOT CAUSE: The StatusBar polls `/api/costs/today` which reads from the `session_costs` table. This table is populated by the Agent SDK cost tracker (Sprint 7D) — it tracks costs for Agent SDK JOBS, not for the strategic chat thread. Regular chat messages through `/api/chat/route.ts` never write to `session_costs`.

FIX: After each completed assistant response in the chat route, write a cost record to `session_costs` (or a new `chat_costs` table). The data is available — the Anthropic API response includes `usage.input_tokens` and `usage.output_tokens`. Calculate cost using the same pricing logic from `lib/agent-sdk/cost-tracker.ts`. The `/api/costs/today` endpoint should aggregate both Agent SDK and chat costs.

Files to read:
- app/components/ui/StatusBar.tsx — polls /api/costs/today every 60s
- app/app/api/costs/today/route.ts — reads session_costs
- app/lib/agent-sdk/cost-tracker.ts — has pricing logic (calculateCostUsd or similar)
- app/app/api/chat/route.ts — where token usage is available after streaming

Verify: send a message, wait up to 60s, cost counter should reflect the real cost.

TASK 2: Fix decision gate false positive on "for now"

BUG: Asking "wasnt there some manual work i had to do too?" after GregLite described Covos sprint options triggered: "⚠ Decision Gate active — Detected language suggesting a temporary fix or technical debt."

ROOT CAUSE: The `sacred_principle_risk` detector in `lib/decision-gate/trigger-detector.ts` includes the phrase `'for now'` in the SACRED_PRINCIPLE_PHRASES list. This is a substring match against the last 5 messages (BOTH user AND assistant). GregLite's own response about Covos sprint options contained phrases like "good enough for now" and "just for now" — which triggered the detector on the NEXT user message.

FIX:
1. Remove `'for now'` from SACRED_PRINCIPLE_PHRASES — it's too broad. The specific variants already cover the real anti-patterns: `'just for now'`, `'good enough for now'`, `'workaround for now'`, `'hack for now'`.
2. Consider whether `sacred_principle_risk` should only scan USER messages, not assistant messages. The assistant quoting/analyzing external project descriptions shouldn't trigger a debt alarm. At minimum, it should only scan the LATEST user message + the LATEST assistant message (not all last 5).

Files:
- app/lib/decision-gate/trigger-detector.ts — SACRED_PRINCIPLE_PHRASES array + detectSacredPrincipleRisk function

Update tests in the decision gate test files to reflect the removed phrase. Add a test case: assistant message contains "fix later" in a project description context → should NOT trigger if only scanning latest user message.

TASK 3: Collapsible thinking/tool call blocks

NEED: When GregLite shows its processing — tool calls, KERNL lookups, thinking blocks — the user should be able to collapse these to see just the response text. Currently they're inline and always visible.

Implementation:
- In the message rendering component (Message.tsx or wherever tool blocks render), wrap tool call blocks and thinking blocks in a collapsible container
- Default state: expanded (show the work)
- Click to collapse → shows a single-line summary: "⚙ Used 2 tools" or "💭 Thinking..." with a chevron
- User preference (in ui-store): defaultCollapseToolBlocks: boolean (default false)
- Add to Settings → Appearance: "Collapse tool calls by default"

Files to read:
- app/components/chat/Message.tsx — find where tool_use content blocks are rendered
- Look for existing collapsible patterns in the codebase (the existing "Collapsible tool and thinking blocks" from Sprint 10.6 — this may already be partially implemented, verify)

TASK 4: Tool call visual distinction

NEED: Tool calls currently render in the same text style as message text. They should be visually distinct — different background, monospace font, subtle border.

Implementation:
- Tool call blocks should render with:
  - Background: var(--elevated) or var(--surface)
  - Font: monospace (var(--font-mono))
  - Border-left: 3px solid var(--cyan) (or a muted color)
  - Slightly smaller font size (12px vs 14px body)
  - Rounded corners, padding 8px 12px
  - The tool name should be a small badge/pill at the top: "KERNL:pm_batch_read" in cyan
  - Tool output/result should be even more muted — it's reference data, not the response

Files:
- app/components/chat/Message.tsx — tool block rendering

TASK 5: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. Verify: send messages → cost counter updates
4. Verify: normal questions don't trigger sacred principle gate
5. Verify: tool blocks have distinct styling and are collapsible
6. Update STATUS.md
7. Commit: "fix: Sprint 15.0 — cost tracking for chat, decision gate false positive, collapsible tool blocks, tool call styling"
8. Push

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. Use cmd shell (not PowerShell)
3. Read the existing code FULLY before modifying — especially Message.tsx
4. Cost tracking must use the SAME pricing model as Agent SDK (don't create a second pricing table)
5. Decision gate fix: do NOT weaken the gate broadly — only remove the overly broad phrase and tighten the scan window
