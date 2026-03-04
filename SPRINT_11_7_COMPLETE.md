# Sprint 11.7 Complete — Transit Map Phase F: Learning Engine

**Date:** March 4, 2026
**Duration:** Single session
**Commit:** feat: Sprint 11.7 — Transit Map learning engine
**Status:** ✅ SHIPPED

---

## What Was Built

A recursive self-improvement system that processes `conversation_events` telemetry, detects behavioural patterns, and generates actionable `LearningInsight` records with confidence scoring, human approval gates, and full rollback safety.

---

## Files Created

| File | Purpose |
|------|---------|
| `app/lib/transit/learning/types.ts` | Core type definitions: `LearningInsight`, `InsightStatus`, `InsightAdjustment`, `PatternResult` |
| `app/lib/transit/learning/insights.ts` | `calculateConfidence()` + `generateInsights()` with dedup/conflict detection |
| `app/lib/transit/learning/verbosity.ts` | Token bucket detector on `quality.interruption` events |
| `app/lib/transit/learning/regeneration.ts` | Task type classifier + `quality.regeneration` rate detector |
| `app/lib/transit/learning/model-routing.ts` | `system.model_route` vs quality failure cross-reference |
| `app/lib/transit/learning/registry.ts` | Full CRUD: store, apply, dismiss, rollback, decay, list |
| `app/lib/transit/learning/pipeline.ts` | Batch orchestrator + 6-hour scheduler |
| `app/lib/transit/learning/index.ts` | Barrel export |
| `app/components/transit/InsightReviewPanel.tsx` | React UI: confidence bars, approve/dismiss/rollback, Run Pipeline |
| `app/app/api/transit/insights/route.ts` | GET (list/filter) + POST (approve/dismiss/rollback/run_pipeline) |
| `app/lib/transit/learning/__tests__/verbosity.test.ts` | 28 tests |
| `app/lib/transit/learning/__tests__/regeneration.test.ts` | 34 tests |
| `app/lib/transit/learning/__tests__/insights.test.ts` | 30 tests |
| `app/lib/transit/learning/__tests__/registry.test.ts` | 36 tests |
| `app/lib/transit/learning/__tests__/pipeline.test.ts` | 20 tests |

## Files Modified

| File | Change |
|------|--------|
| `app/lib/kernl/schema.sql` | `learning_insights` table + 3 indexes |
| `app/lib/kernl/database.ts` | Migration block for `learning_insights` |
| `app/components/inspector/InspectorDrawer.tsx` | 6th tab: Learning (🔮) → `InsightReviewPanel` |

---

## Quality Gates

- **TSC:** 0 errors in all Sprint 11.7 files
- **Tests:** 1152/1155 passing (148 new, all green; 3 pre-existing failures untouched)
- **Minimum sample:** 10 events enforced in every detector (§6.3)
- **Confidence cap:** 95% maximum (§6.3)
- **Human approval gate:** All insights start `status='proposed'` — no auto-apply
- **Rollback safety:** Every `applyInsight()` requires `before_state` → `rollbackInsight()` always possible
- **90-day decay:** `decayExpiredInsights()` marks stale `proposed`/`approved` insights as `expired`
- **Pipeline isolation:** Entire `runLearningPipeline()` and each detector wrapped in try/catch — learning failures never crash the app

---

## Spec Compliance

All §6 non-negotiable safeguards implemented:
- ✅ Minimum 10 events before generating any insight
- ✅ Maximum 95% confidence
- ✅ Human approval gate (proposed → approved → applied flow)
- ✅ Before-state snapshot for every applied insight
- ✅ 90-day expiry decay
- ✅ Pipeline errors never crash the app (belt + suspenders)

---

## Decisions

**Token column aliasing:** `conversation_events` stores `timestamp TEXT` but `capture.ts` reads `created_at`. Resolved in `pipeline.ts` via `CAST(strftime('%s', timestamp) * 1000 AS INTEGER) AS created_at` — no changes to capture.ts or existing schema.

**Dedup strategy:** `generateInsights()` detects duplicates by `pattern_type + adjustment.type + adjustment.target`; replaces new insight's `id` with existing id; `storeInsight()` uses `ON CONFLICT(id) DO UPDATE` to upsert transparently.

**Scheduler `.unref()`:** `setInterval` handle calls `.unref()` so Node.js can exit cleanly even if the scheduler hasn't fired. This is the canonical pattern for background tasks in Next.js.
