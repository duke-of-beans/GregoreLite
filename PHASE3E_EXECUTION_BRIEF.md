# GREGLITE — SPRINT 3E EXECUTION BRIEF
## Suggestion Feedback + Threshold Calibration
**Instance:** Phase 3, Workstream E
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Prerequisite:** Sprint 3D complete (background indexer running)

---

## YOUR ROLE

Bounded execution worker. You are building the feedback loop that makes the Cross-Context Engine smarter over time. David dismisses a suggestion → threshold rises. David accepts → confidence increases. The system learns what's useful. David is CEO. Zero debt.

---

## MANDATORY BOOTSTRAP

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\PROJECT_DNA.yaml`
5. `D:\Projects\GregLite\STATUS.md`
6. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5.3 (Threshold Calibration) and §5.7 (Proactive Surfacing)
7. `D:\Projects\GregLite\SPRINT_3D_COMPLETE.md`

Verify baseline before touching anything.

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Threshold drift clamped to [0.65, 0.92]
4. STATUS.md updated

---

## WHAT YOU ARE BUILDING

### New files

```
app/lib/cross-context/
  suggestion-engine.ts   — generate suggestions from vector search results
  feedback.ts            — record user actions, update suggestion rows
  calibrator.ts          — threshold recalculation job
  thresholds.ts          — current threshold state, load/save to KERNL

app/components/context/
  SuggestionSlot.tsx     — UPDATE this (was a stub in 2B, now it's real)
  SuggestionCard.tsx     — single suggestion: summary, source, Accept / Dismiss
```

### Threshold schema (in KERNL)

Add a simple key-value table for threshold persistence if not already present:

```sql
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Starting thresholds (from BLUEPRINT §5.3):

| Context | Key | Default |
|---------|-----|---------|
| Background pattern detection | `threshold.pattern` | 0.75 |
| On-input suggestion | `threshold.suggestion` | 0.85 |
| "Already built" gate | `threshold.built` | 0.72 |

### Threshold calibration rules

```typescript
// app/lib/cross-context/calibrator.ts

// Runs every 100 feedback events OR every 24 hours
// Max drift: ±0.01 per adjustment
// Clamp range: [0.65, 0.92]
// Pattern-specific: 3 consecutive dismissals → +0.03 on that pattern's threshold

export async function runCalibration(): Promise<void> {
  const thresholds = await loadThresholds();

  // Check acceptance rate for suggestion threshold
  const recent = db.prepare(`
    SELECT user_action, COUNT(*) as count
    FROM suggestions
    WHERE surfaced_at > ? AND user_action IS NOT NULL
    GROUP BY user_action
  `).all(Date.now() - 24 * 60 * 60 * 1000) as any[];

  const accepted = recent.find(r => r.user_action === 'accepted')?.count ?? 0;
  const dismissed = recent.find(r => r.user_action === 'dismissed')?.count ?? 0;
  const total = accepted + dismissed;

  if (total < 10) return; // not enough data

  const acceptanceRate = accepted / total;

  // Too many dismissals → raise threshold (be more conservative)
  if (acceptanceRate < 0.3) {
    thresholds.suggestion = Math.min(0.92, thresholds.suggestion + 0.01);
  }
  // Too many accepts → lower threshold slightly (surface more)
  if (acceptanceRate > 0.7) {
    thresholds.suggestion = Math.max(0.65, thresholds.suggestion - 0.01);
  }

  await saveThresholds(thresholds);
}
```

### Suggestion engine

Called after every user message (non-blocking, like embedding):

```typescript
// app/lib/cross-context/suggestion-engine.ts

export async function generateSuggestions(
  userMessage: string,
  threadId: string
): Promise<void> {
  const thresholds = await loadThresholds();
  const results = await findSimilarToText(userMessage, 5, thresholds.suggestion);

  // Max 2 suggestions visible at once (BLUEPRINT §5.7)
  const top2 = results.slice(0, 2);

  for (const result of top2) {
    // Don't resurface if already shown in last 24h
    const alreadyShown = db.prepare(`
      SELECT id FROM suggestions
      WHERE source_content = ? AND surfaced_at > ?
    `).get(result.chunkId, Date.now() - 24 * 60 * 60 * 1000);

    if (alreadyShown) continue;

    db.prepare(`
      INSERT INTO suggestions (id, suggestion_type, similarity_score, source_content, target_thread, surfaced_at)
      VALUES (?, 'cross_context', ?, ?, ?, ?)
    `).run(nanoid(), result.similarity, result.chunkId, threadId, Date.now());
  }
}
```

### Feedback recording

```typescript
// app/lib/cross-context/feedback.ts

export type SuggestionAction = 'accepted' | 'dismissed' | 'ignored';

export async function recordFeedback(
  suggestionId: string,
  action: SuggestionAction
): Promise<void> {
  db.prepare(`
    UPDATE suggestions SET user_action = ?, acted_at = ? WHERE id = ?
  `).run(action, Date.now(), suggestionId);

  // Check if calibration should run (every 100 feedback events)
  const count = db.prepare(`SELECT COUNT(*) as c FROM suggestions WHERE user_action IS NOT NULL`).get() as any;
  if (count.c % 100 === 0) {
    runCalibration().catch(console.warn);
  }
}
```

### Suppression rules (BLUEPRINT §5.7)

- 3 dismissals of same suggestion type → 48h suppression
- 5 dismissals in 7 days → 7-day suppression
- Implemented as a check in `generateSuggestions()` before surfacing

### SuggestionSlot.tsx — activate the 2B stub

Replace the placeholder from Sprint 2B with a real component. Reads from the `suggestions` table via a `/api/kernl/suggestions` endpoint. Polls every 60 seconds (not 30 — suggestions don't need to be that fresh).

Each `SuggestionCard` shows:
- One-sentence summary of the similar content (first 120 chars of `content_chunks.content`)
- Source label (e.g. "from 3 days ago", "from GHM thread")
- **Tell me more** → opens the full chunk in a modal
- **Noted** → records `dismissed`, removes card

Max 2 cards visible at once. If 0 suggestions meet threshold, SuggestionSlot shows nothing (no empty state needed).

### Wire into chat route

After embedding fires (non-blocking), queue suggestion generation:

```typescript
generateSuggestions(body.message, threadId).catch(console.warn);
```

---

## SESSION END

1. `npx tsc --noEmit` — zero errors
2. `pnpm test:run` — zero failures
3. Manual test: send a message similar to a previous message, verify suggestion appears in context panel
4. Update STATUS.md
5. Commit: `sprint-3e: suggestion feedback, threshold calibration`
6. Push
7. Write `SPRINT_3E_COMPLETE.md`

---

## GATES

- [ ] Suggestions appear in context panel SuggestionSlot after similar message
- [ ] Max 2 suggestions shown at once
- [ ] "Noted" dismissal recorded in `suggestions` table
- [ ] "Tell me more" opens full chunk content
- [ ] Threshold calibration runs after 100 feedback events
- [ ] Threshold drift clamped to [0.65, 0.92]
- [ ] 3 consecutive dismissals of same type → 48h suppression
- [ ] Suppressed suggestions don't reappear
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
