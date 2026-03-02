# GREGLITE — SPRINT 3E EXECUTION BRIEF
## Suggestion Feedback + Threshold Calibration
**Instance:** Can run parallel with 3D
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** Sprint 3C complete (tiers live). Can run alongside 3D.

---

## YOUR ROLE

Bounded execution worker. You are building the feedback loop that makes Cross-Context suggestions smarter over time. Every time David accepts or dismisses a suggestion, the thresholds drift to match his actual preferences. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5.3 (Threshold Calibration) and §5.7 (Proactive Surfacing) specifically

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Threshold drift logic becomes complex enough to require state machines — simplify, the spec is ±0.01 per event
- Same fix 3+ times

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Thresholds clamped to [0.65, 0.92] at all times
4. 3 consecutive dismissals of same pattern → +0.03 threshold (not ±0.01)
5. Calibration runs every 100 events OR 24 hours, whichever comes first
6. STATUS.md updated

---

## WHAT YOU ARE BUILDING

### New files

```
app/lib/cross-context/
  thresholds.ts       — threshold storage, drift logic, clamp enforcement
  feedback.ts         — record accept/dismiss/ignore, trigger calibration
  calibrator.ts       — 100-event / 24h calibration job
  surfacing.ts        — ranking formula, max 2 visible, suppression logic
  types.ts            — Suggestion, FeedbackAction, ThresholdConfig interfaces
```

### Starting thresholds — from §5.3

```typescript
// thresholds.ts
export interface ThresholdConfig {
  patternDetection: number;     // 0.75 — background pattern detection
  onInputSuggestion: number;    // 0.85 — on-input suggestion trigger
  alreadyBuiltGate: number;     // 0.72 — "you already built this" interception
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  patternDetection: 0.75,
  onInputSuggestion: 0.85,
  alreadyBuiltGate: 0.72,
};

const THRESHOLD_MIN = 0.65;
const THRESHOLD_MAX = 0.92;
const DRIFT_PER_EVENT = 0.01;
const CONSECUTIVE_DISMISSAL_DRIFT = 0.03;

export function clamp(value: number): number {
  return Math.max(THRESHOLD_MIN, Math.min(THRESHOLD_MAX, value));
}
```

Thresholds are persisted in KERNL — add a `threshold_config` key to a simple `config` table, or store as a JSON row in a `settings` table. Choose the simplest approach, document it.

### Feedback recording

```typescript
// feedback.ts
export type FeedbackAction = 'accepted' | 'dismissed' | 'ignored';

export async function recordFeedback(
  suggestionId: string,
  action: FeedbackAction,
  similarityScore: number
): Promise<void> {
  // Write to suggestions table (already in schema)
  await kernl.db.run(
    `UPDATE suggestions SET user_action = ?, acted_at = ? WHERE id = ?`,
    [action, Date.now(), suggestionId]
  );

  // Check if calibration should run
  const eventCount = await getEventsSinceLastCalibration();
  if (eventCount >= 100) {
    await runCalibration();
  }
}
```

### Calibration job — from §5.3

Runs every 100 feedback events OR 24 hours:

```typescript
// calibrator.ts
export async function runCalibration(): Promise<void> {
  const thresholds = await loadThresholds();

  // For each threshold context, compute acceptance rate
  const onInputFeedback = await getRecentFeedback('on_input', 100);
  const acceptRate = onInputFeedback.filter(f => f.user_action === 'accepted').length / onInputFeedback.length;

  // Too many dismissals → raise threshold (be more selective)
  // Too many accepts → lower threshold (show more)
  if (acceptRate < 0.3) {
    thresholds.onInputSuggestion = clamp(thresholds.onInputSuggestion + DRIFT_PER_EVENT);
  } else if (acceptRate > 0.7) {
    thresholds.onInputSuggestion = clamp(thresholds.onInputSuggestion - DRIFT_PER_EVENT);
  }

  // Check for 3 consecutive dismissals on same pattern → +0.03
  const patterns = await getPatternsWithConsecutiveDismissals(3);
  for (const pattern of patterns) {
    await incrementPatternThreshold(pattern.id, CONSECUTIVE_DISMISSAL_DRIFT);
  }

  await saveThresholds(thresholds);
  await recordCalibrationRun();
}
```

### Proactive surfacing — from §5.7

Ranking formula:
```
score = similarity² × recencyFactor × (1 - dismissalPenalty) × valueBoost
```

- `recencyFactor`: 1.0 for content created in last 7 days, decays to 0.5 at 90 days
- `dismissalPenalty`: 0.0 initially, +0.2 per dismissal in last 30 days, capped at 0.8
- `valueBoost`: 1.0 default (Phase 3 stub — full version in Phase 3F)

Max 2 suggestions visible simultaneously. Min display score: 0.70.

```typescript
// surfacing.ts
export interface Suggestion {
  id: string;
  chunkId: string;
  content: string;
  sourceType: string;
  sourceId: string;
  similarityScore: number;
  displayScore: number;
  surfacedAt: number;
}

export async function rankAndFilter(
  candidates: VectorSearchResult[],
  currentThreshold: number
): Promise<Suggestion[]> {
  const scored: Suggestion[] = [];

  for (const candidate of candidates) {
    const recencyFactor = await getRecencyFactor(candidate.chunkId);
    const dismissalPenalty = await getDismissalPenalty(candidate.chunkId);
    const displayScore = Math.pow(candidate.similarity, 2) * recencyFactor * (1 - dismissalPenalty);

    if (displayScore >= currentThreshold) {
      scored.push({ ...candidate, displayScore, surfacedAt: Date.now() });
    }
  }

  return scored
    .sort((a, b) => b.displayScore - a.displayScore)
    .slice(0, 2); // max 2 visible simultaneously
}
```

### Suppression — from §5.7

- 3 dismissals → 48h suppression
- 5 dismissals in 7 days → 7-day suppression
- "Context Library" button exposes all suppressed suggestions on demand

```typescript
export async function isSuppressed(chunkId: string): Promise<boolean> {
  const recentDismissals = await getDismissalsInWindow(chunkId, 7 * 24 * 60 * 60 * 1000);
  if (recentDismissals >= 5) return true; // 7-day suppression

  const last3 = await getLastNDismissals(chunkId, 3);
  if (last3.length >= 3 && last3[0].acted_at > Date.now() - 48 * 60 * 60 * 1000) return true; // 48h

  return false;
}
```

---

## CHECKPOINTING

Every 3 file writes: `npx tsc --noEmit` + `git add && git commit -m "sprint-3e(wip): [description]"`

---

## SESSION END

1. Zero errors, zero failures
2. Update STATUS.md — Sprint 3E complete
3. `git commit -m "sprint-3e: suggestion feedback, threshold calibration"`
4. `git push`
5. Write `SPRINT_3E_COMPLETE.md` — calibration logic decisions, any threshold edge cases found

---

## GATES CHECKLIST

- [ ] `recordFeedback` writes to suggestions table
- [ ] Calibration triggers after 100 feedback events
- [ ] Thresholds never leave [0.65, 0.92] range
- [ ] 3 consecutive dismissals of same suggestion → +0.03 on that pattern's threshold
- [ ] Ranking formula produces scores for candidate suggestions
- [ ] Max 2 suggestions returned by `rankAndFilter`
- [ ] `isSuppressed` correctly enforces 48h and 7-day windows
- [ ] Thresholds persisted across restarts (survive `pnpm dev` restart)
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
