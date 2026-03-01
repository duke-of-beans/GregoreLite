# BLUEPRINT_FINAL.md — §5 REPLACEMENT
## Cross-Context Engine (Final — Council Session 1 Complete)
**Synthesized from:** Gemini, Gemini 2, DeepSeek, DeepSeek 2, GPT, GPT 2  
**Status:** LOCKED FOR BUILD

---

## §5 — CROSS-CONTEXT ENGINE

The Cross-Context Engine is the cognitive substrate that separates Gregore Lite from a fast chat client. It prevents David from re-solving solved problems, re-building existing components, and repeating architectural mistakes. Every decision below is grounded in the Council's near-total convergence: six members independently arrived at the same foundational stack, and the synthesis resolves the minor divergences.

---

### §5.1 Embedding Model

**Locked decision:** `BAAI/bge-small-en-v1.5` via `@xenova/transformers` (ONNX runtime, 8-bit quantized).

BGE-small is the unanimous Round 2 winner over all-MiniLM-L6-v2. Same 384-dimension footprint, meaningfully better semantic separation on MTEB benchmarks, fully offline, fully private, cold-start compatible. The hosted embedding path is rejected permanently: it would break offline operation, expose sensitive cognition artifacts to a third party, and introduce latency at exactly the wrong moment.

Model loading is lazy — it does not block the strategic thread or the cold start sequence. The model file (~130MB quantized) is cached locally after first load; subsequent starts load from disk cache in under 200ms.

**Forward migration:** every embedding record stores a `model_id` column. If a better local model becomes available, background re-indexing against raw text (always retained) is possible without data loss. Embeddings from different models are never mixed in the same index.

```typescript
// embedding.service.ts
import { pipeline } from '@xenova/transformers';

let embedder: any = null;

export async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', {
      quantized: true,
    });
  }
  return embedder;
}

export async function embedText(text: string): Promise<Float32Array> {
  const extractor = await getEmbedder();
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return result.data; // Float32Array length 384
}
```

**Chunking strategy:** Recursive character splitting, 512-token window, 50-token overlap. Messages under 200 characters are not indexed. Each chunk stores source `message_id`, `thread_id`, `project_id`, `timestamp`, and `model_id`.

---

### §5.2 Vector Index

**Locked decision:** `sqlite-vec` (loadable SQLite extension) integrated into KERNL's SQLite database via Rust bindings in Tauri. No external vector database. No FAISS sidecar. No separate process.

```sql
SELECT load_extension('vec0');

CREATE VIRTUAL TABLE vec_index USING vec0(
  chunk_id TEXT PRIMARY KEY,
  embedding FLOAT[384] distance_metric=cosine
);

INSERT INTO vec_index(chunk_id, embedding) VALUES (?, ?);

SELECT chunk_id, distance
FROM vec_index
WHERE embedding MATCH ?1
  AND k = 10
ORDER BY distance;
```

**Query SLA:** Sub-200ms for k=10 on the full index. Hot tier queries must be under 10ms.


### §5.3 Threshold Calibration

**Initial thresholds (explicitly provisional — designed to move):**

| Context | Starting Threshold | Notes |
|---|---|---|
| Pattern detection (background) | **0.75** | Non-interrupting; lower is acceptable |
| On-input suggestion | **0.85** | Interrupt — high precision required |
| "You already built this" gate | **0.72** | Gate — false negatives are costly |

The philosophy is start permissive, suppress aggressively, calibrate fast. Thresholds are not hardcoded — they adapt from David's actual behavior through a Bayesian feedback loop.

**Feedback schema:**
```sql
CREATE TABLE suggestion_feedback (
  id TEXT PRIMARY KEY,
  context_type TEXT,          -- 'pattern'|'input'|'gate'
  similarity REAL,
  pattern_id TEXT,
  action TEXT,                -- 'accepted'|'dismissed'|'overridden'
  timestamp INTEGER
);
```

**Calibration rule:** Every 100 feedback events (or every 24 hours, whichever comes first), a background job recomputes acceptance rates per context type. Target rates: 80% for the gate, 60% for on-input, 40% for background. Thresholds move ±0.01 max per adjustment, clamped to [0.65, 0.92].

Per-pattern: 3 consecutive dismissals → +0.03 threshold. Repeated accepts → -0.01. Stored in `pattern_thresholds` table.

---

### §5.4 The "You Already Built This" Gate

Hard gate intercepting manifest generation before finalization.

**Interception Modal:**
```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ You've built something similar before                   │
│                                                             │
│  New task: "Build Stripe API client for GHM"               │
│  Match: Project "Payment Portal" — March 12                │
│  File: src/stripe.ts  (similarity: 87%)                     │
│                                                             │
│  [View Code]  [Reuse as Base]  [Continue Anyway]           │
│                                                             │
│  [ ] Don't show for this project again                      │
└─────────────────────────────────────────────────────────────┘
```

- **View Code** — Monaco diff viewer
- **Reuse as Base** — copies artifact, pre-fills manifest as "extend/refactor"
- **Continue Anyway** — logs `overridden`, feeds calibration
- **"Don't show for this project again"** — adds to `gate_suppressions` table

3 overrides on same pattern → auto-increment threshold +0.05.

---

### §5.5 Cold Start — Three-Tier Index Warming

- **Tier 1 (T+2s):** `hot_cache.bin` — 1-2k most recent embeddings, memory-mapped, <5ms
- **Tier 2 (T+5-10s):** 30-day window — ~10k embeddings, brute-force in-memory, ~2ms, async load
- **Tier 3 (always):** Full `sqlite-vec` index

Startup sequence: T+0 SQLite open → T+2s hot tier ready → T+5s UI interactive → T+5-10s recent window loads → T+30s+ full index warm.

---

### §5.6 Background Indexer — Cadence and Compute Budget

Every 30 minutes, only if idle 5+ minutes. Out-of-schedule: after session end, after large job completion. Budget: 500ms CPU per run, yields if exceeded. Only indexes: strategic thread messages, decision-bearing worker messages, all research thread messages. Minimum 200 chars.

AEGIS: `BUILD_SPRINT/COUNCIL` → suspend; `DEEP_FOCUS` → half speed; `IDLE` → full.

```typescript
class BackgroundIndexer {
  private suspend = false;
  private halfSpeed = false;

  onWorkloadChange(profile: WorkloadProfile) {
    this.suspend = profile === 'BUILD_SPRINT' || profile === 'COUNCIL';
    this.halfSpeed = profile === 'DEEP_FOCUS';
    if (!this.suspend) this.reschedule();
  }

  private async runCycle() {
    if (this.suspend) return;
    const start = Date.now();
    const messages = await this.getUnindexedMessages(50);
    for (const msg of messages) {
      if (this.suspend) break;
      if (Date.now() - start > 500) break;
      await this.processMessage(msg);
      if (this.halfSpeed) await new Promise(r => setTimeout(r, 10));
    }
    this.schedule();
  }
}
```

---

### §5.7 Proactive Surfacing — Noise Control

**Detection modes:**
- Background (30 min): pattern registry update, no UI unless interrupt-worthy
- On thread creation: non-blocking banner "3 similar threads found"
- On user input (debounced 2s): similarity >0.85 against different thread → surface
- On manifest generation: artifact gate (§5.4) fires — hard gate, not suggestion

**Ranking formula:**
```typescript
function rankSuggestion(s: Suggestion): number {
  const daysOld = (Date.now() - s.timestamp) / 86_400_000;
  const recencyFactor = Math.max(0.5, 1 - daysOld / 30);
  const dismissalPenalty = Math.max(0.5, 1 - 0.1 * getDismissalCount(s.patternId));
  const valueBoost = (s.isDecision || s.isProductionArtifact) ? 1.5 : 1.0;
  return Math.min(1, s.similarity ** 2 * recencyFactor * dismissalPenalty * valueBoost);
}
```

**Display rules:** Max 2 visible simultaneously. Min score 0.70. 3 dismissals → 48h suppress. 5 in 7 days → 7-day suppress. Project-level fatigue: 12h cooldown after dismissal. Exception: similarity ≥0.90 + production-ready → bypasses suppression once. "Context Library" safety valve shows all suppressed suggestions on demand.

---

### §5.8 Build Sequence (Phase 3)

| Task | Deliverable | Est. Sessions |
|---|---|---|
| 5A | Embedding pipeline | 2 |
| 5B | sqlite-vec integration | 2 |
| 5C | Three-tier cold start | 2 |
| 5D | Background indexer + AEGIS | 2 |
| 5E | Suggestion feedback + calibration | 2 |
| 5F | Artifact gate UI | 3 |
| 5G | Ranking and suppression | 2 |
| 5H | End-to-end integration | 2 |

**Total: 17 sessions, 6-8 days.**

---

### §5.9 Open Items

1. **Threshold calibration period.** Manual review at day 14. Thresholds adjusted manually before automated calibration takes over if acceptance rates are drastically off target.
2. **BGE-small at >1M chunks.** Active monitoring required. Migration path to BGE-base-v1.5 via background re-indexing is designed and ready if semantic drift becomes noticeable.
