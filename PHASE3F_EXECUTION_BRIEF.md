# GREGLITE — SPRINT 3F EXECUTION BRIEF
## "You Already Built This" Gate UI
**Instance:** Sequential after 3E
**Created:** March 1, 2026
**Project:** D:\Projects\GregLite\
**Depends on:** Sprint 3E complete (ranking/suppression live), Sprint 3B complete (vec_index queryable)

---

## YOUR ROLE

Bounded execution worker. You are building the manifest interception gate — when David is about to spawn an Agent SDK job, GregLite checks if he's already built something similar and surfaces it in a modal before the manifest is finalized. This is the highest-value Cross-Context feature. David is CEO. Execute as COO-level engineer. Zero debt, complete implementation.

---

## MANDATORY BOOTSTRAP

Load in order:

1. `D:\Dev\CLAUDE_INSTRUCTIONS.md`
2. `D:\Dev\TECHNICAL_STANDARDS.md`
3. `D:\Projects\GregLite\DEV_PROTOCOLS.md`
4. `D:\Projects\GregLite\STATUS.md`
5. `D:\Projects\GregLite\BLUEPRINT_FINAL.md` — §5.4 (The "You Already Built This" Gate) specifically

Baseline check:
```powershell
cd D:\Projects\GregLite\app
npx tsc --noEmit
pnpm test:run
```

---

## AUTHORITY PROTOCOL — STOP WHEN:

- Monaco diff view has SSR issues (use `dynamic(..., { ssr: false })` — same as Sprint 2D)
- Gate interception point in the manifest flow is unclear — read Sprint 2A's manifest builder code before building
- Same fix 3+ times

---

## QUALITY GATES

1. `npx tsc --noEmit` — zero new errors
2. `pnpm test:run` — zero failures
3. Gate fires BEFORE manifest is submitted to Agent SDK
4. 3 overrides on same pattern → +0.05 threshold auto-increment
5. Monaco diff view loads correctly (no SSR crash)
6. STATUS.md updated

---

## WHAT YOU ARE BUILDING

### New files

```
app/components/cross-context/
  AlreadyBuiltModal.tsx     — interception modal with match, score, three options
  SimilarityDiff.tsx        — Monaco diff showing existing vs proposed
  ContextLibrary.tsx        — all suppressed suggestions on demand
  index.ts                  — exports

app/lib/cross-context/
  gate.ts                   — pre-manifest check, interception logic
  override-tracker.ts       — count overrides per pattern, trigger threshold bump
```

### Gate flow — from §5.4

Intercept point: in `ManifestBuilder.tsx` (Sprint 2A), BEFORE calling `spawn()`. When David clicks "Create Job":

1. Take the manifest `task.description` and `task.title` as query text
2. Run `findSimilarChunks(queryText, 10, 0.72)` — using the `alreadyBuiltGate` threshold
3. If any results above threshold → show `AlreadyBuiltModal`
4. If no results or David clicks "Continue Anyway" → proceed with manifest spawn

```typescript
// gate.ts
export interface GateResult {
  shouldIntercept: boolean;
  matches: Array<{
    chunkId: string;
    content: string;
    similarity: number;
    sourceId: string;      // thread_id where it was built
  }>;
}

export async function checkBeforeManifest(manifest: TaskManifest): Promise<GateResult> {
  const queryText = `${manifest.task.title} ${manifest.task.description}`;
  const threshold = await getThreshold('alreadyBuiltGate');
  const matches = await findSimilarChunks(queryText, 10, threshold);

  return {
    shouldIntercept: matches.length > 0,
    matches: matches.map(m => ({
      chunkId: m.chunkId,
      content: m.content,
      similarity: m.similarity,
      sourceId: m.sourceId,
    })),
  };
}
```

### AlreadyBuiltModal — from §5.4

Three options:

**Option A — "View Code"**: Open Monaco diff view (`SimilarityDiff.tsx`) showing the existing implementation alongside the proposed manifest. Side-by-side diff with the existing chunk on the left, proposed description on the right.

**Option B — "Reuse as Base"**: Copy the existing implementation into a new manifest as starting context. Pre-fills the manifest with `context.files[0].initial_content` set to the matched chunk content. Closes modal, returns to ManifestBuilder with pre-filled content.

**Option C — "Continue Anyway"**: Log override to KERNL. Increment override counter for this pattern. If 3 overrides → auto-increment `alreadyBuiltGate` threshold by +0.05. Proceed with original manifest.

```typescript
// In AlreadyBuiltModal.tsx
<div className="already-built-modal">
  <h2>You may have already built this</h2>
  <p>Similarity: {(match.similarity * 100).toFixed(1)}%</p>
  <pre className="match-preview">{match.content.slice(0, 300)}...</pre>

  <div className="options">
    <button onClick={onViewCode}>View Code</button>
    <button onClick={onReuseAsBase}>Reuse as Base</button>
    <button onClick={onContinue}>Continue Anyway</button>
  </div>
</div>
```

### Monaco diff — SSR warning

```typescript
// SimilarityDiff.tsx
import dynamic from 'next/dynamic';
const DiffEditor = dynamic(
  () => import('@monaco-editor/react').then(m => m.DiffEditor),
  { ssr: false }
);

<DiffEditor
  original={existingContent}
  modified={proposedDescription}
  language="typescript"
  theme="vs-dark"
  options={{ readOnly: true, minimap: { enabled: false } }}
/>
```

### Override tracker

```typescript
// override-tracker.ts
export async function recordOverride(patternId: string): Promise<void> {
  // Increment override count in patterns table
  await kernl.db.run(
    `UPDATE patterns SET occurrence_count = occurrence_count + 1 WHERE id = ?`,
    [patternId]
  );

  const pattern = kernl.db.prepare('SELECT occurrence_count FROM patterns WHERE id = ?').get(patternId) as any;
  if (pattern?.occurrence_count >= 3) {
    // Auto-increment threshold
    const current = await getThreshold('alreadyBuiltGate');
    await setThreshold('alreadyBuiltGate', clamp(current + 0.05));
  }
}
```

### Context Library

"Context Library" button in the context panel (Sprint 2B's SuggestionSlot, which is currently a placeholder). Now it becomes real — clicking it opens a drawer showing all suggestions that have been suppressed, with their source thread and similarity score. David can un-suppress any of them.

```typescript
// ContextLibrary.tsx — drawer, full-height right panel
// Shows all suggestions where user_action = 'dismissed' AND suppression has not expired
// Each item: snippet preview, source thread link, similarity score, "Un-suppress" button
```

---

## CHECKPOINTING

Every 3 file writes: `npx tsc --noEmit` + `git add && git commit -m "sprint-3f(wip): [description]"`

---

## SESSION END

1. Zero errors, zero failures
2. Update STATUS.md — Sprint 3F complete
3. `git commit -m "sprint-3f: already-built gate, interception modal, context library"`
4. `git push`
5. Write `SPRINT_3F_COMPLETE.md` — gate interception point, Monaco diff SSR solution, override threshold behavior

---

## GATES CHECKLIST

- [ ] Gate fires when creating a manifest with description similar to past work
- [ ] Modal shows similarity score and content preview
- [ ] "View Code" opens Monaco diff (no SSR crash)
- [ ] "Reuse as Base" pre-fills manifest builder
- [ ] "Continue Anyway" logs override and increments counter
- [ ] 3 overrides on same pattern → `alreadyBuiltGate` threshold bumps +0.05
- [ ] Context Library drawer opens from context panel
- [ ] Suppressed suggestions visible in Context Library
- [ ] Un-suppress restores suggestion to active pool
- [ ] `npx tsc --noEmit` clean
- [ ] `pnpm test:run` clean
- [ ] Commit pushed
