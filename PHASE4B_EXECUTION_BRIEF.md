# GREGLITE — SPRINT 4B EXECUTION BRIEF
## Decision Gate — UI Panel + API Lock Enforcement
**Instance:** Sequential after 4A
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** Sprint 4A complete (trigger detection + lock.ts live)

---

## YOUR ROLE

Bounded execution worker. You are building the Decision Gate UI — the non-modal panel that appears when a trigger fires, and the enforcement layer that actually blocks Claude API calls while the lock is active. After this sprint, the Decision Gate is a complete, working safety mechanism. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §8 fully
6. `D:\Projects\GregLite\SPRINT_4A_COMPLETE.md` — understand what was built and what was stubbed

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- API lock enforcement causes race conditions in the streaming chat response — resolve before continuing
- The three stubbed triggers (high_tradeoff, multi_project, large_estimate) need a Claude API call structure that's unclear — design the prompt before building
- Same fix 3+ times

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. `decision_lock` actually blocks Claude API calls — verified with a test
4. Panel is non-modal (never full-screen blocker — David can still read the conversation)
5. 3 dismissals makes the gate mandatory — verified with a test
6. Every approval logged to KERNL decisions table
7. STATUS.md updated

---

## WHAT YOU ARE BUILDING

### New files

```
app/components/decision-gate/
  GatePanel.tsx         — non-modal slide-in panel above the input field
  TriggerBadge.tsx      — compact badge in status bar showing gate is active
  ContradictionView.tsx — shows the prior decision being contradicted (from KERNL)
  MandatoryOverlay.tsx  — full-width banner when dismissCount >= 3 (cannot dismiss)
  index.ts              — exports

app/lib/decision-gate/
  inference.ts          — Claude API call for high_tradeoff, multi_project, large_estimate
  kernl-logger.ts       — writes approved decisions to KERNL decisions table
```

### GatePanel layout — from §8

Non-modal. Appears as a slide-in panel above the input field, pushing the input down. Does NOT cover the conversation — David must be able to read it while deciding.

```
┌──────────────────────────────────────────────────────┐
│  ⚠ DECISION GATE                            [×]      │
│                                                       │
│  Trigger: Sacred Principle Risk                       │
│  "Detected language suggesting a temporary fix."     │
│                                                       │
│  This conflicts with Option B Perfection.            │
│  Confirm you want to proceed before Claude continues. │
│                                                       │
│  [Approve & Continue]    [Dismiss (2 left)]          │
└──────────────────────────────────────────────────────┘
```

When `isMandatory()` is true (3 dismissals), replace Dismiss button with:
```
[Approve & Continue]    [Override (write rationale required)]
```

Override requires a text input with at least 20 characters before it can be submitted. Both approval and override are logged to KERNL.

### API lock enforcement

In `app/app/api/chat/route.ts`, check `getLockState()` before making the Anthropic API call:

```typescript
// At the top of the POST handler, before building messages:
const lock = getLockState();
if (lock.locked) {
  return new Response(
    JSON.stringify({ error: 'decision_locked', reason: lock.reason, trigger: lock.trigger }),
    { status: 423, headers: { 'Content-Type': 'application/json' } }
  );
}
```

In `ChatInterface.tsx`, handle the 423 response — show the gate panel if it isn't already visible (in case user somehow sends a message while locked).

### ContradictionView

When trigger is `contradicts_prior`, fetch the specific prior decision from KERNL and show it inline in the panel:

```tsx
// ContradictionView.tsx — rendered inside GatePanel when trigger === 'contradicts_prior'
<div className="contradiction-view">
  <p className="label">Prior decision from KERNL:</p>
  <blockquote className="decision-quote">{priorDecision.decision}</blockquote>
  <p className="meta">{priorDecision.project_id} — {relativeTime(priorDecision.timestamp)}</p>
</div>
```

### KERNL logger

Every approval (and every override) writes to the `decisions` table:

```typescript
// kernl-logger.ts
export async function logGateApproval(
  threadId: string,
  trigger: GateTrigger,
  action: 'approved' | 'overridden',
  rationale?: string,          // required for overrides
): Promise<void> {
  await kernl.db.run(
    `INSERT INTO decisions (id, thread_id, decision, rationale, timestamp, project_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      nanoid(),
      threadId,
      `Decision Gate ${action}: ${trigger}`,
      rationale ?? `Gate ${action} by David`,
      Date.now(),
      activeProjectId,
    ]
  );
  releaseLock();
}
```

### Inference for the three stubbed triggers

Sprint 4A left `high_tradeoff_count`, `multi_project_touch`, and `large_build_estimate` as stubs. Now implement them via a lightweight Claude API call — NOT a full chat session, just a single-turn analysis:

```typescript
// inference.ts
export async function inferStructuredTriggers(messages: Message[]): Promise<{
  highTradeoff: boolean;
  multiProject: boolean;
  largeEstimate: boolean;
}> {
  const lastFive = messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',  // cheapest model — this runs on every message
    max_tokens: 100,
    system: 'You analyze conversations and detect decision complexity. Respond only with JSON.',
    messages: [{
      role: 'user',
      content: `Analyze this conversation excerpt and respond with ONLY this JSON, no other text:
{"highTradeoff": boolean, "multiProject": boolean, "largeEstimate": boolean}

highTradeoff: true if the conversation involves 4 or more significant architectural tradeoffs being weighed.
multiProject: true if the decision would affect 2 or more distinct codebases or projects.
largeEstimate: true if someone mentioned this would take more than 3 separate work sessions to implement.

Conversation:
${lastFive}`
    }]
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    return JSON.parse(text);
  } catch {
    return { highTradeoff: false, multiProject: false, largeEstimate: false };
  }
}
```

Wire this into the trigger detector in `app/lib/decision-gate/index.ts` — replace the three stubs. Run it as fire-and-forget alongside the other synchronous checks.

**Cost note:** Haiku is ~$0.001 per 1000 tokens. At 500 tokens per call, this is $0.0005 per message. Acceptable. Log inference cost to `session_costs`.

### TriggerBadge in status bar

When gate is active, show a badge in the bottom status bar:

```
│  COUNCIL: 1 pending  │  COST TODAY: $0.42  │  AEGIS: DEEP_FOCUS ▾  │
```

"COUNCIL: 1 pending" is the gate indicator. Click it → opens GatePanel if closed.

### Zustand store

```typescript
// In app/lib/decision-gate/index.ts — expose Zustand store for UI
export interface DecisionGateStore {
  isActive: boolean;
  triggerResult: TriggerResult | null;
  lockState: DecisionLockState;
  setTrigger: (result: TriggerResult) => void;
  approve: (rationale?: string) => Promise<void>;
  dismiss: () => void;
  clear: () => void;
}
```

---

## CHECKPOINTING

Every 3 file writes: `npx tsc --noEmit` + `git add && git commit -m "sprint-4b(wip): [description]"`

---

## SESSION END

1. Zero errors, zero failures
2. Update `D:\Projects\GregLite\STATUS.md` — Sprint 4B complete
3. `git commit -m "sprint-4b: decision gate UI, API lock enforcement"`
4. `git push`
5. Write `SPRINT_4B_COMPLETE.md` — inference cost per call measured, lock enforcement verified, any false positive patterns found in integration testing

---

## GATES CHECKLIST

- [ ] GatePanel slides in above input field when trigger fires
- [ ] Panel is non-modal — conversation remains visible and scrollable
- [ ] "Approve & Continue" releases lock and resumes Claude API
- [ ] "Dismiss" increments counter, releases lock, shows remaining dismissals
- [ ] After 3 dismissals, Dismiss replaced with Override (requires rationale text)
- [ ] Override rationale must be ≥20 chars before submission is enabled
- [ ] API returns 423 when `decision_lock` is active — verified with test
- [ ] ChatInterface handles 423 gracefully (shows gate panel)
- [ ] ContradictionView shows prior decision when trigger is `contradicts_prior`
- [ ] Every approval/override written to KERNL decisions table
- [ ] Status bar shows "COUNCIL: N pending" badge when gate is active
- [ ] Three stubbed triggers now wired to Haiku inference call
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
