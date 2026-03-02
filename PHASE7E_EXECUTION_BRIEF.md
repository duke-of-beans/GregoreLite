GREGLITE SPRINT 7E - Concurrency Scheduler: Priority Queue, Rate Limiting, AEGIS Integration
Phase 7, Sprint 5 of 8 | Sequential after 7D | March 2026

YOUR ROLE: Build the swarm governor. Max 8 parallel sessions. Priority queue enforces: strategic thread > self-evolution > code/test > docs/research > Ghost. Token bucket rate limiting prevents flooding the Anthropic API. AEGIS profile changes based on active session count. Session 9+ queues with visible position. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - §4.3.6 (concurrency) fully
7. D:\Projects\GregLite\SPRINT_7D_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- WAL mode single-writer mutex for KERNL metadata conflicts with existing KERNL write patterns from earlier phases - audit before adding a new mutex
- Token bucket rate limiting requires knowing the Anthropic API rate limits - read actual rate limit docs before hardcoding the bucket size
- AEGIS profile changes from this module conflict with AEGIS changes from AEGIS integration in Phase 2 - read the existing governor code before modifying
- Sonnet has failed on the same problem twice → spawn Opus subagent
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] KERNL migration: CREATE session_queue table → DDL specified, mechanical
[HAIKU] Write priority-config.ts (session type → numeric priority) → values specified, mechanical
[HAIKU] QueuePositionBadge React component: display only, props specified → mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 7E complete, write SPRINT_7E_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] scheduler.ts: priority queue, slot management (max 8), enqueue/dequeue/promote logic
[SONNET] rate-limiter.ts: token bucket over 60s rolling window, queue-on-throttle behavior
[SONNET] aegis-integrator.ts: watch active session count, emit correct AEGIS profile transitions
[SONNET] Modify spawnSession() (7A) to route through scheduler instead of spawning directly
[SONNET] Test: enqueue 10 sessions, verify priority ordering, verify slot cap, verify AEGIS transitions
[OPUS] Escalation only if Sonnet fails twice on same problem

QUALITY GATES:
1. Max 8 sessions run concurrently - session 9 enters PENDING with queue position shown
2. Priority ordering enforced: strategic_thread > self_evolution > code > test > documentation > research > analysis > Ghost
3. Token bucket: at 80% rate limit consumption, new spawns queue while running sessions continue
4. AEGIS transitions correct: 0 workers → DEEP_FOCUS, 1-2 → COWORK_BATCH, 3-5 → PARALLEL_BUILD, 5+ → PARALLEL_BUILD + Ghost paused
5. When a session completes, next PENDING session promoted to running automatically
6. Queue position visible in job queue UI data (consumed in 7F)
7. pnpm test:run zero failures

FILE LOCATIONS:
  app/lib/agent-sdk/
    scheduler.ts          - priority queue, slot management, promote-on-complete
    rate-limiter.ts       - token bucket, 60s rolling window
    aegis-integrator.ts   - session count watcher, AEGIS profile emitter
    priority-config.ts    - session type → numeric priority (lower = higher priority)

  app/components/agent-sdk/
    QueuePositionBadge.tsx  - shows queue position for PENDING sessions

PRIORITY VALUES:
  strategic_thread:  0   (highest - reserved, never queued)
  self_evolution:    1
  code:              2
  test:              2
  documentation:     3
  research:          4
  analysis:          4
  ghost:             5   (lowest)

Strategic thread sessions (type: 'strategic_thread') bypass the queue entirely and always run. They do not count against the 8-session cap. This is the main Claude conversation - it must never be blocked.

SESSION_QUEUE TABLE:
  CREATE TABLE IF NOT EXISTS session_queue (
    id TEXT PRIMARY KEY,
    manifest_id TEXT NOT NULL,
    session_type TEXT NOT NULL,
    priority INTEGER NOT NULL,
    status TEXT CHECK(status IN ('pending','running','completed','cancelled')),
    queue_position INTEGER,
    enqueued_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER
  );

SLOT MANAGEMENT:
  - Active slots: count of session_queue rows WHERE status = 'running'
  - On enqueue: if active < 8, start immediately; else set PENDING, assign queue_position
  - Queue position: rank among PENDING rows ordered by (priority ASC, enqueued_at ASC)
  - On session complete: find highest priority PENDING session, promote to running
  - Promotion is synchronous - do not leave slots empty

TOKEN BUCKET:
  Bucket capacity: 100,000 tokens per 60-second window (conservative - actual Anthropic limits vary by tier)
  Make the bucket size configurable in budget_config table (key: 'rate_limit_tokens_per_minute')
  At 80% consumption: new spawns queue (do not reject), running sessions continue unaffected
  Bucket refills continuously (not in discrete 60s chunks)

AEGIS INTEGRATION:
Read active session count from session_queue WHERE status = 'running'. Emit AEGIS profile changes via the existing AEGIS signal mechanism (from Phase 2 app/lib/aegis/).

  0 workers     → DEEP_FOCUS
  1-2 workers   → COWORK_BATCH
  3-5 workers   → PARALLEL_BUILD
  5+ workers    → PARALLEL_BUILD + emit ghost_pause signal

Do not duplicate the AEGIS signal logic - import and call the existing sendAegisSignal() function. Read the existing governor code before modifying anything.

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 7E complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-7e: concurrency scheduler, priority queue, rate limiter, AEGIS)
5. git push
6. Write SPRINT_7E_COMPLETE.md: 10-session priority test results, slot cap verified at 8, AEGIS transitions verified at each threshold, token bucket behavior at 80% documented

GATES CHECKLIST:
- Strategic thread sessions bypass queue, never blocked
- Sessions 1-8 start immediately, session 9 enters PENDING
- Queue position assigned correctly for PENDING sessions
- Priority ordering: self_evolution ahead of code ahead of research
- Completed session → next PENDING promoted automatically, no empty slot lag
- Token bucket: at 80% new spawns queue, running sessions continue
- Rate limit bucket size configurable via budget_config
- AEGIS: 0 → DEEP_FOCUS, 1-2 → COWORK_BATCH, 3-5 → PARALLEL_BUILD, 5+ → PARALLEL_BUILD + Ghost pause
- AEGIS transitions use existing sendAegisSignal(), not a new implementation
- session_queue table populated correctly throughout lifecycle
- pnpm test:run clean
- Commit pushed via cmd -F flag
