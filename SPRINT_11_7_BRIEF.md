GREGLITE SPRINT 11.7 — Transit Map Phase F: Learning Engine
Recursive self-improvement from conversation telemetry | March 2026

YOUR ROLE: Build the Transit Map learning engine — batch processing of conversation events to detect patterns (verbosity, regeneration rate, model routing quality) and generate actionable insights with confidence scoring. This is a backend/data layer sprint with one UI surface (InsightReviewPanel in the Inspector drawer). All input comes from conversation_events (Sprint 11.2). David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Projects\GregLite\STATUS.md
2. D:\Projects\GregLite\DEV_PROTOCOLS.md
3. D:\Projects\GregLite\TRANSIT_MAP_SPEC.md — READ §6 (Self-Improvement Telemetry) FULLY — this is your primary spec
4. D:\Projects\GregLite\app\lib\transit\registry.ts — event types with learnable flag
5. D:\Projects\GregLite\app\lib\transit\types.ts — EventMetadata, EventCategory
6. D:\Projects\GregLite\app\lib\transit\capture.ts — getEventsForConversation(), getEventsByType()
7. D:\Projects\GregLite\app\lib\kernl\schema.sql — understand the existing schema pattern (CREATE TABLE IF NOT EXISTS + ALTER TABLE idempotent migrations)
8. D:\Projects\GregLite\app\lib\kernl\database.ts — getDatabase() singleton, runMigrations() pattern
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL — STOP WHEN:
- Pattern detection on large event sets could be slow — if analysis takes >500ms on 1000 events, stop and profile. Batch processing should be background work, not blocking.
- Haiku inference for insight summaries: use the existing Haiku routing pattern from Sprint 12.0 (check lib/chat/ or batch-executor.ts for the Anthropic client setup and model string). Do NOT create a new Anthropic client — reuse.
- The insight approval gate UI goes in the Inspector drawer (Sprint 9). Read the Inspector component structure before building InsightReviewPanel.
- If writing SQL migrations, follow the project pattern: ALTER TABLE ADD COLUMN IF NOT EXISTS wrapped in try/catch for duplicate column errors. Do NOT use prisma or any migration framework.
- Sonnet has failed on the same problem twice → spawn Opus subagent

EXISTING INFRASTRUCTURE:
- conversation_events table with learning_status column ('pending'/'processed'/'skipped')
- 26 event types registered, each with learnable: boolean flag
- captureEvent() writes events, getEventsByType() reads by type
- Haiku model routing established in Sprint 12.0
- Inspector drawer exists (Sprint 9) with 5 tabs — add a 6th or nest under Quality tab
- better-sqlite3 synchronous DB access via getDatabase()

FILE LOCATIONS (read before modifying):
  app/lib/transit/capture.ts          — event read/write functions
  app/lib/transit/registry.ts         — learnable flags per event type
  app/lib/kernl/schema.sql            — DB schema (append new tables here)
  app/lib/kernl/database.ts           — getDatabase(), runMigrations()

NEW FILES:
  app/lib/transit/learning/types.ts              — LearningInsight, PatternResult, InsightStatus
  app/lib/transit/learning/pipeline.ts           — batch processor orchestrator
  app/lib/transit/learning/verbosity.ts          — verbosity calibration pattern detector
  app/lib/transit/learning/regeneration.ts       — regeneration rate pattern detector
  app/lib/transit/learning/model-routing.ts      — model routing quality pattern detector
  app/lib/transit/learning/insights.ts           — insight generator + confidence scoring
  app/lib/transit/learning/registry.ts           — insight storage, rollback, decay
  app/lib/transit/learning/index.ts              — public API barrel
  app/components/transit/InsightReviewPanel.tsx   — UI for approving/dismissing/rolling back insights
  app/app/api/transit/insights/route.ts           — GET (list insights) + POST (approve/dismiss/rollback)
  app/lib/transit/learning/__tests__/pipeline.test.ts
  app/lib/transit/learning/__tests__/verbosity.test.ts
  app/lib/transit/learning/__tests__/regeneration.test.ts
  app/lib/transit/learning/__tests__/insights.test.ts
  app/lib/transit/learning/__tests__/registry.test.ts

---

TASK 1: Learning types and DB schema

New file: app/lib/transit/learning/types.ts

```typescript
type InsightStatus = 'proposed' | 'approved' | 'applied' | 'dismissed' | 'rolled_back' | 'expired';

interface LearningInsight {
  id: string;                          // nanoid
  pattern_type: string;                // 'verbosity' | 'regeneration' | 'model_routing' | custom
  title: string;                       // Human-readable summary
  description: string;                 // Detailed explanation of what was found
  confidence: number;                  // 0-100
  sample_size: number;                 // How many events produced this insight
  status: InsightStatus;
  adjustment: InsightAdjustment;       // What to change
  before_state: string;                // JSON snapshot of state before applying
  after_state: string | null;          // JSON snapshot after applying (null if not yet applied)
  created_at: number;                  // Unix ms
  applied_at: number | null;
  expires_at: number;                  // 90 days from creation
}

interface InsightAdjustment {
  type: 'max_tokens' | 'system_prompt' | 'model_route' | 'gate_threshold' | 'custom';
  target: string;                      // What's being adjusted (e.g., "topic:code_review")
  current_value: unknown;
  proposed_value: unknown;
}

interface PatternResult {
  pattern_type: string;
  events_analyzed: number;
  insights: LearningInsight[];
}
```

DB schema additions (append to schema.sql):
```sql
CREATE TABLE IF NOT EXISTS learning_insights (
  id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  sample_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  adjustment TEXT NOT NULL DEFAULT '{}',
  before_state TEXT NOT NULL DEFAULT '{}',
  after_state TEXT,
  created_at INTEGER NOT NULL,
  applied_at INTEGER,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insights_status ON learning_insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_pattern ON learning_insights(pattern_type);
CREATE INDEX IF NOT EXISTS idx_insights_expires ON learning_insights(expires_at);
```

Add migration to runMigrations() in database.ts (idempotent ALTER TABLE pattern).

TASK 2: Batch processing pipeline

New file: app/lib/transit/learning/pipeline.ts

```typescript
/**
 * Processes pending learnable events in batches.
 * Queries conversation_events WHERE learning_status = 'pending' AND event type is learnable.
 * Groups by event_type, runs the appropriate pattern detector, generates insights.
 * Marks processed events as learning_status = 'processed'.
 *
 * Designed to run:
 * 1. On session end (Tauri close event or idle timeout)
 * 2. On a schedule (configurable, default every 6 hours)
 * 3. On manual trigger from InsightReviewPanel
 */
export async function runLearningPipeline(): Promise<PatternResult[]>
```

Implementation:
1. Query all pending learnable events: SELECT * FROM conversation_events WHERE learning_status = 'pending' AND event_type IN (select learnable types from registry)
2. Group events by event_type
3. For each group with >= 10 events (minimum sample size from §6.3):
   a. Route to the appropriate pattern detector (verbosity, regeneration, model-routing)
   b. Collect PatternResults
4. Mark all processed events: UPDATE learning_status = 'processed' WHERE id IN (...)
5. Store any generated insights in learning_insights table
6. Return results for logging

Pipeline should be async and non-blocking. Wrap the entire thing in try/catch — learning failures must never crash the app.

TASK 3: Verbosity pattern detector

New file: app/lib/transit/learning/verbosity.ts

Analyzes quality.interruption events to detect verbosity patterns.

```typescript
/**
 * Pattern: "Responses over N tokens on topic X get interrupted M% of the time"
 * Minimum: 10 interruption events
 *
 * Algorithm:
 * 1. Read quality.interruption events (payload has tokens_generated_before_stop)
 * 2. For each, look up the corresponding flow.message event (same message_id or prior assistant message)
 *    to get total expected tokens and topic context
 * 3. Group by token count ranges (0-500, 500-1000, 1000-2000, 2000+)
 * 4. Calculate interruption rate per range
 * 5. If any range has >50% interruption rate with n>=5: generate an insight
 *    suggesting max_tokens adjustment
 */
export function detectVerbosityPatterns(
  interruptionEvents: EventMetadata[],
  allFlowEvents: EventMetadata[],
): LearningInsight[]
```

The insight's adjustment should be type: 'max_tokens' with proposed_value based on the median interruption point in the high-rate bucket. Confidence = min(sample_size / 20 * 100, 95) — more data = higher confidence, capped at 95%.

Tests (verbosity.test.ts):
- Detects pattern when >50% interruptions in a token range
- No pattern when interruption rate is low
- Respects minimum sample size (returns empty for <10 events)
- Confidence scales with sample size
- Handles missing/malformed payload gracefully

TASK 4: Regeneration rate pattern detector

New file: app/lib/transit/learning/regeneration.ts

Analyzes quality.regeneration events.

```typescript
/**
 * Pattern: "First response on [task type] gets regenerated N% of the time"
 * Groups by inferred task type (from topic context or previous user message content).
 *
 * Algorithm:
 * 1. Read quality.regeneration events
 * 2. For each, get the user message that triggered the original response
 * 3. Classify the task type from user message (simple keyword heuristic:
 *    "code" / "write" / "explain" / "review" / "debug" / "general")
 * 4. Count regenerations per task type
 * 5. Count total messages per task type (from flow.message events)
 * 6. If regen rate > 30% for a task type with n>=5: generate insight
 */
export function detectRegenerationPatterns(
  regenEvents: EventMetadata[],
  allFlowEvents: EventMetadata[],
): LearningInsight[]
```

Task type classification: simple keyword matching on the user message content in the flow.message payload. Keywords: "code"/"function"/"class"/"component" → "code", "write"/"draft"/"compose" → "writing", "explain"/"what is"/"how does" → "explanation", "review"/"check"/"audit" → "review", "debug"/"fix"/"error" → "debugging", default → "general". This is intentionally rough — the learning engine improves over time.

Tests (regeneration.test.ts):
- Detects high regen rate for a task type
- No pattern when regen rate is low
- Correct task type classification from keywords
- Respects minimum sample size
- Handles events with missing message context

TASK 5: Model routing pattern detector

New file: app/lib/transit/learning/model-routing.ts

Analyzes correlation between system.model_route and subsequent quality events.

```typescript
/**
 * Pattern: "Haiku on [task type] → high regen/interruption rate vs Sonnet"
 * Cross-references model routing decisions with quality outcomes.
 *
 * Algorithm:
 * 1. Read system.model_route events (payload has selected_model)
 * 2. For each, check if the response triggered quality.regeneration or quality.interruption
 * 3. Group by model × task_type
 * 4. Compare quality rates between models for the same task type
 * 5. If Haiku's quality failure rate is >2× Sonnet's for a task type: suggest routing change
 */
export function detectModelRoutingPatterns(
  routeEvents: EventMetadata[],
  qualityEvents: EventMetadata[],
  flowEvents: EventMetadata[],
): LearningInsight[]
```

This detector may have very few events initially (model routing isn't heavily captured yet). That's fine — it returns empty if below minimum sample size. As more events accumulate, patterns will emerge.

Tests: similar pattern to verbosity/regeneration — detect pattern, no pattern when rates are similar, minimum sample size, graceful handling of sparse data.

TASK 6: Insight generator and confidence scoring

New file: app/lib/transit/learning/insights.ts

```typescript
/**
 * Takes raw pattern results and produces polished LearningInsights.
 * Applies confidence scoring, deduplication, and conflict detection.
 */
export function generateInsights(patterns: PatternResult[]): LearningInsight[]

/**
 * Confidence scoring formula:
 * base = min(sample_size / 20 * 100, 90)  — more data = higher confidence
 * recency_boost = +5 if >50% of events are from last 7 days
 * consistency_boost = +5 if pattern holds across multiple conversations
 * max = 95 (never fully confident)
 *
 * Below 70%: status = 'proposed', flagged as experimental, NOT auto-surfaced
 * 70-85%: status = 'proposed', surfaced for review
 * 85+%: status = 'proposed', surfaced with recommendation to apply
 */
export function calculateConfidence(
  sampleSize: number,
  events: EventMetadata[],
): number
```

Deduplication: if a new insight targets the same adjustment as an existing 'proposed' or 'applied' insight, merge (update confidence + sample size) rather than creating a duplicate.

Tests (insights.test.ts):
- Confidence scales with sample size
- Recency boost applied when events are recent
- Below 70% confidence → not auto-surfaced
- Deduplication merges overlapping insights
- Conflict detection when two insights propose opposing adjustments

TASK 7: Insight registry with storage and rollback

New file: app/lib/transit/learning/registry.ts

```typescript
/**
 * CRUD for learning_insights table.
 * Every applied insight stores before_state so rollback is always possible.
 */

/** Store a new insight */
export function storeInsight(insight: LearningInsight): void

/** Get all insights by status */
export function getInsightsByStatus(status: InsightStatus): LearningInsight[]

/** Get all insights (for UI listing) */
export function getAllInsights(): LearningInsight[]

/** Apply an insight: set status='applied', capture after_state, set applied_at */
export function applyInsight(id: string, afterState: string): void

/** Dismiss an insight: set status='dismissed' */
export function dismissInsight(id: string): void

/** Rollback: restore before_state, set status='rolled_back' */
export function rollbackInsight(id: string): { beforeState: string }

/** Decay: mark insights older than 90 days without reconfirmation as 'expired' */
export function decayExpiredInsights(): number  // returns count of expired
```

Rollback returns the before_state JSON so the caller can restore whatever was changed (system prompt, model routing config, gate threshold). The actual restoration logic depends on the adjustment.type — the registry just stores/retrieves state.

Tests (registry.test.ts):
- Store and retrieve insight
- Apply sets applied_at and after_state
- Rollback returns before_state and sets status
- Decay expires old insights
- Status filtering works correctly

TASK 8: InsightReviewPanel UI

New file: app/components/transit/InsightReviewPanel.tsx

UI for reviewing, approving, dismissing, and rolling back insights.

Placement: Add to the Inspector drawer. Check the existing Inspector component (Sprint 9) — it has tabs (Thread/KERNL/Quality/Jobs/Costs). Either add a "Learning" tab or nest under "Quality".

Content:
- List of insights grouped by status: proposed (top), applied, dismissed/rolled_back (collapsed)
- Each insight card shows:
  - Title + pattern_type badge
  - Confidence bar (0-100, color-coded: red <50, amber 50-70, green 70+)
  - Sample size
  - Description (expandable)
  - Proposed adjustment: "Change max_tokens from 4096 to 2048 for code tasks"
  - Action buttons based on status:
    - proposed → [Approve] [Dismiss]
    - applied → [Rollback]
    - dismissed → (no actions, informational)
    - rolled_back → (no actions, informational)
    - expired → (no actions, grayed out)
- "Run Learning Pipeline" button at the top (manual trigger)
- Last run timestamp

API routes: app/app/api/transit/insights/route.ts
- GET → list all insights (with optional status filter query param)
- POST → action: 'approve' | 'dismiss' | 'rollback' | 'run_pipeline', insightId (for approve/dismiss/rollback)

TASK 9: Wire pipeline execution

The pipeline should run:
1. On manual trigger from InsightReviewPanel (POST /api/transit/insights with action: 'run_pipeline')
2. On a schedule — add to an existing interval/poller if one exists, or create a lightweight one
3. On session end — check for a Tauri close event or idle timeout handler to hook into

For now, implement #1 (manual trigger) and #2 (schedule). For #2: use setInterval with a configurable cadence (default 6 hours = 21600000ms). Start/stop with app lifecycle (check Ghost lifecycle pattern from Sprint 6F for reference).

Also wire: decayExpiredInsights() should run once per pipeline execution.

TASK 10: Public API barrel

New file: app/lib/transit/learning/index.ts

Export:
- runLearningPipeline
- getAllInsights, getInsightsByStatus
- applyInsight, dismissInsight, rollbackInsight
- decayExpiredInsights
- Types: LearningInsight, InsightStatus, InsightAdjustment, PatternResult

TASK 11: Verify and commit

1. npx tsc --noEmit — 0 errors
2. pnpm test:run — all passing
3. New tests summary:
   - pipeline.test.ts: batch processing, minimum sample size, event marking
   - verbosity.test.ts: pattern detection, no-pattern case, confidence, edge cases
   - regeneration.test.ts: pattern detection, task classification, minimum sample
   - insights.test.ts: confidence scoring, deduplication, conflict detection
   - registry.test.ts: CRUD, rollback, decay, status filtering
4. Update STATUS.md — close Sprint 11.7
5. Write SPRINT_11_7_COMPLETE.md
6. Update FEATURE_BACKLOG.md — mark Phase F as ✅ SHIPPED
7. Update SPRINT_ROADMAP.md execution summary
8. Commit: "feat: Sprint 11.7 — Transit Map learning engine (pattern detection, insight generation, approval gate)"
9. Push

---

QUALITY GATES:
 1. Pipeline processes pending learnable events and marks them 'processed'
 2. Minimum 10 events required per pattern type (no garbage insights from small N)
 3. Confidence scoring formula produces 0-95 range with correct boosts
 4. Verbosity detector identifies high-interruption token ranges
 5. Regeneration detector identifies high-regen task types
 6. Model routing detector compares quality rates across models
 7. Insights stored with before_state for rollback
 8. Rollback restores before_state correctly
 9. 90-day decay marks old insights as expired
10. InsightReviewPanel shows insights grouped by status with correct action buttons
11. Manual pipeline trigger works via API route
12. Pipeline errors never crash the app (full try/catch wrapping)
13. tsc clean, all tests pass

NON-NEGOTIABLE RULES:
1. tsc --noEmit 0 errors
2. Minimum sample size = 10 events (from TRANSIT_MAP_SPEC.md §6.3)
3. Confidence never exceeds 95% (§6.3)
4. Every applied insight has before_state for rollback (§6.3)
5. Pipeline errors are caught and logged — NEVER crash the app
6. Use cmd shell (not PowerShell)
7. Reuse existing Anthropic client / Haiku routing — do NOT create a new client
8. Follow existing DB migration pattern (ALTER TABLE in runMigrations with try/catch)
9. Read Inspector drawer structure before adding InsightReviewPanel

PARALLEL EXECUTION NOTE:
This sprint runs IN PARALLEL with Sprint 11.4+11.5 (Z3 annotations + Z2 subway).
File overlap: ZERO. This sprint touches only lib/transit/learning/*, one new API route,
and one new component in the Inspector drawer. The other sprint touches Message.tsx,
MessageList.tsx, ChatInterface.tsx, and components/transit/ (non-learning files).
Do NOT modify any files outside your scope. If you need to read from conversation_events
or the registry, use the existing public APIs — do not modify capture.ts or registry.ts.
