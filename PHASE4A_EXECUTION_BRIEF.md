# GREGLITE — SPRINT 4A EXECUTION BRIEF
## Decision Gate — Trigger Detection
**Instance:** Sequential, first Phase 4 sprint
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Phase 3 baseline:** 374/374 tests passing, Cross-Context Engine live

---

## YOUR ROLE

Bounded execution worker. You are building the trigger detection layer for the Decision Gate — the system that watches the strategic thread conversation and detects when David is approaching a high-stakes decision that needs to be paused and confirmed. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — read §8 (Decision Gate) fully before writing any code
6. `D:\Projects\GregLite\SPRINT_3H_COMPLETE.md` — review Phase 4 dependencies noted there

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```
Both must be clean before touching anything.

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Trigger detection produces >20% false positive rate in manual testing — recalibrate before continuing
- `decision_lock` implementation is ambiguous in its interaction with the chat route — resolve before building
- Same fix 3+ times

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Each trigger condition has an independent unit test
4. No trigger fires on normal conversation (false positive rate acceptable)
5. STATUS.md updated

---

## WHAT YOU ARE BUILDING

### New files

```
app/lib/decision-gate/
  index.ts            — public API: analyze(messages), getDecisionLock(), releaseLock()
  trigger-detector.ts — evaluates all 8 trigger conditions against conversation
  contradiction.ts    — checks proposed decision against KERNL decision log
  lock.ts             — decision_lock state, blocks/releases API calls
  types.ts            — TriggerResult, DecisionLockState, GateTrigger interfaces
```

### The 8 trigger conditions — from §8

All OR logic — any one fires the gate:

```typescript
export type GateTrigger =
  | 'repeated_question'        // same architectural question in 3+ messages
  | 'high_tradeoff_count'      // decision involves ≥4 major tradeoffs
  | 'multi_project_touch'      // decision touches ≥2 projects
  | 'sacred_principle_risk'    // forbidden phrases detected
  | 'irreversible_action'      // delete, deploy to prod, breaking schema change
  | 'large_build_estimate'     // build time >3 Agent SDK sessions for one decision
  | 'contradicts_prior'        // contradicts a KERNL-logged decision
  | 'low_confidence';          // Claude expresses confidence <60%
```

### Trigger implementations

**repeated_question**: Scan the last 10 messages. Extract noun phrases from user messages. If the same core topic appears in 3+ user messages, trigger. Use simple keyword overlap — not embeddings, too expensive on every message.

```typescript
function detectRepeatedQuestion(messages: Message[]): boolean {
  const userMessages = messages.filter(m => m.role === 'user').slice(-10);
  if (userMessages.length < 3) return false;

  // Extract 3-5 word key phrases from each message
  const phrases = userMessages.map(m => extractKeyPhrases(m.content));

  // Count shared phrases across messages
  const phraseCounts = new Map<string, number>();
  for (const msgPhrases of phrases) {
    for (const phrase of msgPhrases) {
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
    }
  }

  return [...phraseCounts.values()].some(count => count >= 3);
}
```

**sacred_principle_risk**: Exact string match against forbidden phrase list.

```typescript
const SACRED_PRINCIPLE_PHRASES = [
  'temporary fix', 'temp fix', 'quick fix',
  'technical debt', 'tech debt',
  'mvp of', 'mvp version',
  'just for now', 'for now',
  'we can do this later', 'fix later',
  'good enough for now', 'ship it and fix',
];

function detectSacredPrincipleRisk(messages: Message[]): boolean {
  const recent = messages.slice(-5).map(m => m.content.toLowerCase()).join(' ');
  return SACRED_PRINCIPLE_PHRASES.some(phrase => recent.includes(phrase));
}
```

**irreversible_action**: Keyword detection in the last assistant message.

```typescript
const IRREVERSIBLE_PATTERNS = [
  /drop table/i, /delete from/i, /truncate/i,
  /deploy to prod/i, /push to main/i, /merge to main/i,
  /breaking change/i, /breaking schema/i,
  /remove the.*column/i, /rename the.*table/i,
];

function detectIrreversibleAction(messages: Message[]): boolean {
  const lastAssistant = messages.filter(m => m.role === 'assistant').at(-1);
  if (!lastAssistant) return false;
  return IRREVERSIBLE_PATTERNS.some(p => p.test(lastAssistant.content));
}
```

**contradicts_prior**: Use Phase 3's `findSimilarChunks` against the KERNL decision log. If a proposed action is semantically close to a prior decision but the action appears to go against it, flag it.

```typescript
async function detectContradiction(messages: Message[]): Promise<boolean> {
  const lastUser = messages.filter(m => m.role === 'user').at(-1);
  if (!lastUser) return false;

  // Search decisions table for related prior decisions
  const similar = await findSimilarChunks(lastUser.content, 5, 0.80);
  const decisionChunks = similar.filter(c => c.sourceType === 'decision');
  return decisionChunks.length > 0; // Sprint 4A: flag any similar decision. Sprint 4B refines with UI to show the conflict.
}
```

**low_confidence**: Scan last assistant message for confidence signals.

```typescript
const LOW_CONFIDENCE_PHRASES = [
  "i'm not sure", "i'm uncertain", "i'm not confident",
  "this might not", "this could break", "i'd need to verify",
  "not 100%", "approximately", "roughly speaking",
  "you may want to double-check", "worth verifying",
];

function detectLowConfidence(messages: Message[]): boolean {
  const lastAssistant = messages.filter(m => m.role === 'assistant').at(-1);
  if (!lastAssistant) return false;
  const lower = lastAssistant.content.toLowerCase();
  return LOW_CONFIDENCE_PHRASES.filter(p => lower.includes(p)).length >= 2;
}
```

**high_tradeoff_count**, **multi_project_touch**, **large_build_estimate**: These three require NLP inference — too complex for keyword matching. For Sprint 4A, implement as stubs that always return false. Sprint 4B will wire these to a lightweight Claude API call that analyzes the conversation context and returns structured judgment on these three.

```typescript
// Stubs — Sprint 4B implements these properly
async function detectHighTradeoffCount(_messages: Message[]): Promise<boolean> { return false; }
async function detectMultiProjectTouch(_messages: Message[]): Promise<boolean> { return false; }
async function detectLargeEstimate(_messages: Message[]): Promise<boolean> { return false; }
```

Document the stubs clearly in the code and in SPRINT_4A_COMPLETE.md.

### Main analyzer

```typescript
// index.ts
export interface TriggerResult {
  triggered: boolean;
  trigger: GateTrigger | null;
  reason: string;        // human-readable explanation shown in gate panel
}

export async function analyze(messages: Message[]): Promise<TriggerResult> {
  if (detectRepeatedQuestion(messages)) {
    return { triggered: true, trigger: 'repeated_question', reason: 'The same architectural question has come up 3+ times. Worth pausing to make a decision.' };
  }
  if (detectSacredPrincipleRisk(messages)) {
    return { triggered: true, trigger: 'sacred_principle_risk', reason: 'Detected language suggesting a temporary fix or technical debt. This conflicts with Option B Perfection.' };
  }
  if (detectIrreversibleAction(messages)) {
    return { triggered: true, trigger: 'irreversible_action', reason: 'The proposed action appears irreversible. Confirm before proceeding.' };
  }
  if (await detectContradiction(messages)) {
    return { triggered: true, trigger: 'contradicts_prior', reason: 'This may contradict a prior decision logged in KERNL. Review before proceeding.' };
  }
  if (detectLowConfidence(messages)) {
    return { triggered: true, trigger: 'low_confidence', reason: 'Claude expressed uncertainty multiple times. Worth confirming direction before continuing.' };
  }
  return { triggered: false, trigger: null, reason: '' };
}
```

### Wire into chat route

After every assistant response, run `analyze()` against the full conversation. Fire-and-forget — do not delay the response. Store the result in a Zustand store (`decisionGateStore`).

```typescript
// In chat route, after streaming completes:
analyze(fullConversation)
  .then(result => {
    if (result.triggered) {
      decisionGateStore.setTrigger(result);
      // Sprint 4B renders the UI panel
    }
  })
  .catch(err => logger.warn('[decision-gate] analyze failed', { err }));
```

### decision_lock — from §8

`decision_lock` blocks all Claude API calls while active. Implement the state in `lock.ts` now, even though the UI to enforce it comes in Sprint 4B.

```typescript
// lock.ts
export interface DecisionLockState {
  locked: boolean;
  trigger: GateTrigger | null;
  reason: string;
  dismissCount: number;  // 3 dismissals = mandatory (cannot be dismissed again)
  lockedAt: number | null;
}

let state: DecisionLockState = { locked: false, trigger: null, reason: '', dismissCount: 0, lockedAt: null };

export function acquireLock(trigger: GateTrigger, reason: string): void
export function releaseLock(): void   // David approves — logs to KERNL, unblocks
export function dismissLock(): void   // David dismisses — increments counter, unblocks IF count < 3
export function getLockState(): DecisionLockState
export function isMandatory(): boolean  // dismissCount >= 3
```

---

## CHECKPOINTING

Every 3 file writes: `npx tsc --noEmit` + `git add && git commit -m "sprint-4a(wip): [description]"`

---

## SESSION END

1. Zero errors, zero failures
2. Update `D:\Projects\GregLite\STATUS.md` — Sprint 4A complete
3. `git commit -m "sprint-4a: decision gate trigger detection"`
4. `git push`
5. Write `SPRINT_4A_COMPLETE.md` — which triggers are live, which are stubs, false positive rate observed in manual testing

---

## GATES CHECKLIST

- [ ] `repeated_question` fires after 3 same-topic user messages
- [ ] `sacred_principle_risk` fires on "temporary fix", "just for now", "technical debt" phrases
- [ ] `irreversible_action` fires on "deploy to prod", "drop table", "merge to main"
- [ ] `contradicts_prior` fires when user message is semantically similar to a prior decision
- [ ] `low_confidence` fires when assistant message contains 2+ uncertainty phrases
- [ ] `high_tradeoff_count`, `multi_project_touch`, `large_build_estimate` are stubs returning false (documented)
- [ ] `acquireLock` / `releaseLock` / `dismissLock` implemented in `lock.ts`
- [ ] `isMandatory()` returns true after 3 dismissals
- [ ] `analyze()` runs fire-and-forget after every assistant response
- [ ] Each trigger condition has unit tests
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
