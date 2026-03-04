# Sprint 11.2 Complete — Transit Map Phase A: Data Foundation

**Date:** March 4, 2026
**Commit:** feat: Sprint 11.2 — Transit Map data foundation

---

## Delivered

### New files

| File | Purpose |
|------|---------|
| `app/lib/transit/types.ts` | EventCategory, MarkerShape, MarkerSize, EventTypeDefinition, EventMetadata, CaptureEventInput |
| `app/lib/transit/registry.ts` | Map-based registry, 26 event types, 3 exported lookup functions |
| `app/lib/transit/capture.ts` | Server-side captureEvent() + getEventsForConversation() + getEventsByType() |
| `app/lib/transit/client.ts` | Browser-safe captureClientEvent() fire-and-forget fetch wrapper |
| `app/app/api/transit/capture/route.ts` | POST bridge — always 200, telemetry-loss-safe |
| `app/lib/transit/__tests__/registry.test.ts` | 24 tests — structure, categories, lookup, scrollbar landmarks |
| `app/lib/transit/__tests__/capture.test.ts` | 14 tests — write, read, error resilience |

### Modified files

| File | Change |
|------|--------|
| `app/app/api/chat/route.ts` | Both flow.message hooks updated from lib/events/capture → lib/transit/capture |
| `app/components/chat/ChatInterface.tsx` | quality.interruption, quality.regeneration, quality.edit_resend hooks wired |

---

## Tasks 1 & 2 status

The conversation_events table migration and tree columns (parent_id, branch_index,
is_active_branch) were confirmed already present from Sprint 10.6. No DB changes needed.

---

## Event registry — all 26 types

**Flow (5):** flow.message, flow.topic_shift, flow.branch_fork, flow.branch_merge, flow.session_boundary

**Quality (6):** quality.interruption, quality.regeneration, quality.edit_resend, quality.long_pause, quality.immediate_followup, quality.copy_event

**System (6):** system.model_route, system.gate_trigger, system.gate_resolution, system.rate_limit, system.error, system.latency_spike

**Context (5):** context.retrieval, context.ghost_surface, context.ghost_engaged, context.window_pressure, context.window_exceeded

**Cognitive (4):** cognitive.thinking_block, cognitive.tool_invocation, cognitive.artifact_generated, cognitive.artifact_engagement

---

## Scrollbar landmarks (6 events with ticks)

| Event | Color | Height | Opacity | Filter |
|-------|-------|--------|---------|--------|
| flow.topic_shift | var(--cyan) | 3px | 0.7 | — |
| cognitive.artifact_generated | var(--teal-400) | 2px | 0.5 | — |
| quality.interruption | var(--red-400) | 3px | 0.8 | — |
| system.gate_trigger | var(--amber-400) | 3px | 0.8 | — |
| flow.branch_fork | var(--amber-400) | 2px | 0.6 | — |
| flow.message | var(--frost) | 1px | 0.2 | user only |

---

## Quality gates

- TSC: 0 errors
- Tests: 982/986 passing (38 new, all green; 4 failures are pre-existing in unrelated areas)
- No UI shipped — pure data infrastructure
- All capture hooks fire-and-forget, never throw to callers
- Registry is static — O(1) lookup, no DB reads, no file reads

---

## Next

Sprint 11.3 — Transit Map Phase B: Z2 Subway renderer, scrollbar landmarks UI
