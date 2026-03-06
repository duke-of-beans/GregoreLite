GREGLITE MEGA-SPRINT 17.0 — The Gregore Port
Receipt Footer + Ghost Pulse + Send Button States + Orchestration Theater + Voice Templates | March 2026

YOUR ROLE: Build the core Gregore UX patterns into GregLite's message layer. This is the biggest visual upgrade since Phase 9 — every assistant message gets a receipt footer, the input field pulses during analysis, the send button transforms through 5 states, and the first 5 messages for new users show full orchestration detail. Also create the voice template system that all copy references. David is CEO. Zero debt, Option B Perfection.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\GREGORE_AUDIT.md — READ FULLY. Sections 1 (Brand Voice), 2 (Patterns 1-6), 5 (Animation Gaps)
4. D:\Projects\GregLite\app\app\globals.css — existing animations (ghost-pulse, shimmer, breathe already defined)
5. D:\Projects\GregLite\app\components\chat\Message.tsx — READ FULLY before modifying
6. D:\Projects\GregLite\app\components\chat\ChatInterface.tsx — READ FULLY. Input field, send button, gate integration
7. D:\Projects\GregLite\app\components\chat\MessageList.tsx — event data flow
8. D:\Projects\GregLite\app\lib\decision-gate\index.ts — gate state machine
9. D:\Projects\GregLite\app\lib\decision-gate\lock.ts — lock/dismiss/override
10. D:\Projects\GregLite\app\lib\stores\ui-store.ts — user preferences
11. D:\Projects\GregLite\app\components\transit\MessageMetadata.tsx — existing per-message metadata (Transit Map Z3)
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- Receipt footer conflicts with Transit Map MessageMetadata — they should coexist. Receipt is always visible (collapsed), MessageMetadata is toggle-on only (Cmd+Shift+M). Do NOT merge them.
- The send button state system requires reading gate state from Zustand — check what's already exposed in the decision-gate store before creating new state.
- Ghost pulse animation already exists in globals.css — do NOT redefine it. Just wire the class.
- Sonnet has failed on the same problem twice → spawn Opus subagent

---

BRAND VOICE (apply to ALL new copy in this sprint):
Deadpan professional. Data-forward. Sardonic edge in empty states. No exclamation marks. No "I'm sorry." No emoji in system messages. Lead with numbers. See GREGORE_AUDIT.md §1 for full voice guide.

---

═══════════════════════════════════════════════════════════════════════════════
PHASE 1: VOICE TEMPLATE SYSTEM (Tasks 1-2)
═══════════════════════════════════════════════════════════════════════════════

TASK 1: Create voice template system

New file: app/lib/voice/copy-templates.ts

Centralized copy for all system-facing text. Every component that needs user-facing strings imports from here instead of hardcoding.

```typescript
export const VOICE = {
  // Receipt footer
  receipt: {
    collapsed: (model: string, cost: string, latency: string) =>
      `✓ ${cost} · ${latency} · ${model}`,
    expand: 'Details',
    collapse: 'Less',
    cached: 'cached',
    tokens: (input: number, output: number) =>
      `${input.toLocaleString()} in · ${output.toLocaleString()} out`,
  },

  // Decision gate
  gate: {
    repeated_question: "You've circled back to this topic. Want a deeper look?",
    sacred_principle_risk: "This looks like a shortcut. Proceed anyway?",
    irreversible_action: "This can't be undone. Confirm?",
    low_confidence: "Confidence is low on this one. Want verification?",
    contradicts_prior: "This contradicts a previous decision. Review?",
    high_tradeoff_count: "Multiple trade-offs detected. Worth a pause.",
    multi_project_touch: "This spans multiple projects. Tread carefully.",
    large_build_estimate: "This is a large build. Break it down first?",
    dismiss: 'Proceed',
    address: 'Reconsider',
  },

  // Status bar
  status: {
    system_idle: 'Idle',
    system_active: 'Active',
    memory_ready: 'Ready',
    memory_indexing: 'Indexing',
    memory_error: 'Error',
  },

  // Empty states (sardonic edge permitted here)
  empty: {
    war_room: 'Nothing running. Workers are on break.',
    jobs: 'No active jobs. Quiet shift.',
    insights: 'No insights yet. Run the pipeline to find patterns.',
    transit_no_data: 'No conversation data. Start talking.',
    search_no_results: 'Nothing matched. Try different terms.',
  },

  // Errors (direct, actionable)
  error: {
    api_key_invalid: "API key rejected. Check Settings.",
    api_unreachable: "Can't reach the API. Network issue or key problem.",
    db_corrupted: "Database integrity check failed. Recovery options available.",
    generic: (detail: string) => `Something broke: ${detail}`,
  },
} as const;
```

New file: app/lib/voice/index.ts — barrel export

TASK 2: Create receipt animation

Add to globals.css:

```css
@keyframes receipt-expand {
  from { max-height: 0; opacity: 0; }
  to { max-height: 200px; opacity: 1; }
}

.receipt-footer {
  overflow: hidden;
  transition: max-height 150ms ease-out, opacity 150ms ease-out;
}

.receipt-footer[data-expanded="false"] {
  max-height: 28px;
}

.receipt-footer[data-expanded="true"] {
  max-height: 200px;
}
```

═══════════════════════════════════════════════════════════════════════════════
PHASE 2: RECEIPT FOOTER (Tasks 3-5)
═══════════════════════════════════════════════════════════════════════════════

TASK 3: ReceiptFooter component

New file: app/components/chat/ReceiptFooter.tsx

Collapsed default (single line, always visible under assistant messages):
```
✓ $0.0021 · 1.2s · sonnet-4
```

Expanded (click to toggle):
```
✓ $0.0021 · 1.2s · sonnet-4          [Less]
  Tokens: 247 in · 1,842 out
  Cache: hit (system prompt cached)
  Model: claude-sonnet-4-5-20250929
```

Props:
```typescript
interface ReceiptFooterProps {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  latencyMs?: number;
  cacheHit?: boolean;
}
```

Style: text-xs (10px), var(--mist) text, var(--frost) for the checkmark. Expanded section gets var(--elevated) background with subtle left border. Use the VOICE.receipt templates for all copy.

The receipt footer is SEPARATE from Transit Map's MessageMetadata (which shows event markers, shapes, etc.). Receipt = per-message cost/performance. MessageMetadata = conversation telemetry events. They can coexist — receipt always visible when preference is not "hidden", MessageMetadata only on Cmd+Shift+M toggle.

TASK 4: Wire ReceiptFooter into Message.tsx

File: app/components/chat/Message.tsx

After assistant message content, render ReceiptFooter. The data comes from:
- flow.message event in messageEvents (already passed down from MessageList) — payload has model, token_count, latency_ms
- session_costs row for cost (Sprint 15.0 added chat cost tracking)
- OR: check if the SSE streaming response already includes usage data in the message props

Add receipt display preference to ui-store:
```typescript
receiptDetail: 'full' | 'compact' | 'minimal' | 'hidden'  // default: 'compact'
```
- full: always expanded
- compact: collapsed, click to expand (DEFAULT)
- minimal: just the checkmark and cost, no expand
- hidden: no receipt footer at all

Add to Settings > Appearance: "Message receipts" with the 4 options.

TASK 5: Orchestration Theater (first 5 messages)

In ChatInterface.tsx or a new hook:
- Track message count for the current user (store in KERNL settings or ui-store)
- For messages 1-5 of a NEW USER (not per conversation — across all conversations):
  - Auto-expand receipt footers (override 'compact' default)
  - After message 5, show a one-time inline prompt: "How much detail going forward?" with the 4 receipt options
- Store the user's choice, never show the prompt again
- Check: `getSetting('orchestration_theater_complete')` — if true, skip

═══════════════════════════════════════════════════════════════════════════════
PHASE 3: GHOST PULSE + SEND BUTTON (Tasks 6-8)
═══════════════════════════════════════════════════════════════════════════════

TASK 6: Wire Ghost Pulse to input field

File: app/components/chat/ChatInterface.tsx

The `@keyframes ghost-pulse` and `.ghost-analyzing` class ALREADY EXIST in globals.css. They just need to be applied.

When the decision gate is analyzing (between user submit and gate resolution):
1. Add className `ghost-analyzing` to the input field's container or border element
2. Remove it when gate resolves (approved, dismissed, or timeout)

Read the decision gate store to get the current state. The gate fires asynchronously after message submit — check `lib/decision-gate/index.ts` for the state lifecycle.

This should be a very small change — possibly just adding a conditional className.

TASK 7: SendButton component

New file: app/components/chat/SendButton.tsx

5 visual states per Gregore DESIGN_SYSTEM.md §3:

```typescript
type SendButtonState = 'normal' | 'checking' | 'approved' | 'warning' | 'veto';
```

Visual treatments:
- normal: var(--cyan) background, white text, "Send" label
- checking: var(--cyan) background, animated spinner icon, "Checking..." label, opacity 0.8
- approved: linear-gradient(135deg, var(--cyan), var(--success)) background, "✓ Send" label — shows briefly (500ms) then returns to normal
- warning: var(--warning) background, "⚠ Review" label
- veto: var(--error) background, "Override?" label

Each state has a distinct ARIA label per Gregore's accessibility spec.

Wire to decision gate state:
- no gate → normal
- gate analyzing → checking (+ ghost-pulse on input)
- gate clear → approved (flash 500ms, then normal)
- gate warning → warning
- gate mandatory (3+ dismissals) → veto

Extract the current send button from ChatInterface.tsx into this component.

TASK 8: Wire SendButton into ChatInterface

Replace the existing inline send button in ChatInterface.tsx with <SendButton>.
Wire the state prop to the decision gate Zustand store.
Verify: submit a message → button shows "checking" briefly → shows "approved" flash → returns to normal.
Verify: trigger a gate → button shows "warning" → dismissing returns to normal.

═══════════════════════════════════════════════════════════════════════════════
CHECKPOINT: After Task 8, verify:
  npx tsc --noEmit — 0 errors
  pnpm test:run — all passing
  Commit: "feat: Sprint 17.0 Phase 1-3 — receipt footer, ghost pulse, send button states"
  Push, then continue to Phase 4.
═══════════════════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════════════════
PHASE 4: DESIGN TOKENS + ANIMATION WIRING (Tasks 9-11)
═══════════════════════════════════════════════════════════════════════════════

TASK 9: Add missing design tokens to globals.css

From GREGORE_AUDIT.md §4, add these CSS custom properties with BOTH dark and light mode values:

```css
:root {
  /* Background layers */
  --bg-tertiary: #1A1A25;
  --bg-elevated: #22222F;

  /* Status colors as tokens */
  --status-success: var(--success);
  --status-warning: var(--warning);
  --status-error: var(--error);
  --status-info: var(--info);

  /* Ghost transparency */
  --cyan-ghost: rgba(0, 212, 232, 0.08);

  /* Semantic spacing */
  --message-gap: 12px;
  --section-gap: 24px;
  --component-padding: 16px;
  --inner-padding: 8px;

  /* Dense typography scale */
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 14px;
}

[data-theme="light"] {
  --bg-tertiary: #E8EDF2;
  --bg-elevated: #FFFFFF;
  --cyan-ghost: rgba(8, 145, 178, 0.06);
}
```

Do NOT change any existing token values — only add new ones.

TASK 10: Wire message fade-in animation

In globals.css, add:
```css
@keyframes message-enter {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-enter {
  animation: message-enter 200ms ease-out forwards;
}
```

In Message.tsx: apply `.message-enter` class to newly rendered messages. Check if there's an existing animation — replace with this precise timing if so.

TASK 11: Glassmorphic Inspector Drawer

File: app/components/inspector/InspectorDrawer.tsx

Update drawer background to match Gregore spec:
```css
background: rgba(10, 14, 20, 0.95);
backdrop-filter: blur(12px);
border-left: 1px solid rgba(0, 212, 232, 0.15);
box-shadow: -4px 0 32px rgba(0, 0, 0, 0.5);
```

This is a CSS-only change to the drawer container. Verify it doesn't break in light mode.

═══════════════════════════════════════════════════════════════════════════════
PHASE 5: INSPECTOR REORG (Tasks 12-13)
═══════════════════════════════════════════════════════════════════════════════

TASK 12: Reorganize Inspector tabs

File: app/components/inspector/InspectorDrawer.tsx

Current tabs: Thread / Quality / KERNL / Jobs / EoS / Learning

New tabs (per GREGORE_AUDIT.md §2 Pattern 7):
- **Memory** — merges KERNL content (search, status) + Ghost context
- **Quality** — merges EoS (code quality) + thread quality metrics
- **Cost** — elevates CostBreakdown from a separate modal into a permanent tab
- **Jobs** — unchanged (active workers, job queue)
- **Learning** — unchanged (insights, pipeline)

This is a tab rename + content reorganization. The underlying data and components don't change — you're moving content between tabs and renaming headers.

Remove the CostBreakdown modal from StatusBar — cost clicks now open Inspector to the Cost tab instead.

TASK 13: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. Verify: receipt footer appears on assistant messages (collapsed by default)
4. Verify: ghost pulse on input during gate analysis
5. Verify: send button cycles through states
6. Verify: orchestration theater on first 5 messages (reset by deleting setting)
7. Verify: inspector tabs reorganized
8. Update STATUS.md
9. Write SPRINT_17_0_COMPLETE.md
10. Commit: "feat: Sprint 17.0 — Gregore port (receipt footer, ghost pulse, send button, voice system, inspector reorg, design tokens)"
11. Push

---

QUALITY GATES:
 1. ReceiptFooter renders under every assistant message (compact default)
 2. Receipt shows real cost/tokens/model from session_costs or event data
 3. Receipt expand/collapse animates smoothly (150ms ease-out)
 4. Orchestration Theater auto-expands receipts for first 5 messages
 5. Ghost pulse activates on input border during gate analysis
 6. Send button shows all 5 states correctly (normal → checking → approved flash → normal)
 7. Send button warning state matches gate trigger
 8. Voice templates used for all new copy (no hardcoded strings)
 9. Design tokens added with both dark and light mode values
10. Message fade-in at 200ms ease-out
11. Inspector drawer has glassmorphic background
12. Inspector tabs: Memory / Quality / Cost / Jobs / Learning
13. tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. Receipt footer is SEPARATE from Transit Map MessageMetadata — they coexist
3. Ghost pulse uses the EXISTING @keyframes ghost-pulse — do NOT redefine it
4. Voice templates from lib/voice/copy-templates.ts for ALL new copy
5. Use cmd shell (not PowerShell)
6. Read Message.tsx, ChatInterface.tsx, InspectorDrawer.tsx FULLY before modifying
7. Mid-sprint checkpoint commit after Phase 3 before starting Phase 4
8. Do NOT change existing design token values — only add new ones
