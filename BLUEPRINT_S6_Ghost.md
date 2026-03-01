# BLUEPRINT_FINAL.md — §6 REPLACEMENT
## Ghost Thread Full Architecture (Final — Council Session 2 Complete)
**Synthesized from:** Gemini, Gemini 2, DeepSeek, DeepSeek 2, GPT, GPT 2  
**Status:** LOCKED FOR BUILD

---

## §6 — GHOST THREAD

The Ghost Thread is the silent guardian of David's entire digital history. It watches the full filesystem and all email, builds a semantic index of everything that matters, and speaks at most twice a day — only when something is genuinely worth interrupting for. It is not a notification system. It is a cognitive conscience. The test of whether Ghost is working is not whether it surfaces things; it is whether what it surfaces changes what David does next.

All six Council members converged on the same foundational choices. This section is the synthesis.

---

### §6.1 Architecture Overview

Ghost is a **distinct background process** — separate from the strategic thread, separate from the Cross-Context Engine's background indexer, and separate from any Claude conversational session. It shares KERNL's SQLite database for storage, and the shared `vec_index` virtual table for vector search, but owns its own lifecycle, compute budget, and decision logic.

Ghost does not maintain a long-lived Claude session. Each run is **stateless in execution, stateful in memory**: it reconstructs context from KERNL state, makes targeted API calls, stores results in KERNL, and terminates. No conversational residue. No context drift. No runaway token cost.

Ghost shuts down cleanly when Gregore Lite closes. No headless daemon in Phase 6. Two distinct jobs, same process: **Ingest** (continuous) and **Interrupt evaluation** (6-hour cadence). Different budgets, architecturally separate within the same process.

---

### §6.2 Delta-Based Ingest Pipeline

#### Filesystem Watcher

Rust `notify` crate (`RecommendedWatcher`). Native OS events. Debounce + settle window: 750–1500ms — file must be stable before ingestion begins.

**File type allowlist:** `.txt`, `.md`, `.mdx`, `.ts`, `.tsx`, `.js`, `.py`, `.rs`, `.go`, `.java`, `.sql`, `.json`, `.yaml`, `.toml`, `.pdf`, `.docx`, `.odt`. All binary formats excluded at event level.

**Directory exclusions (enforced in Rust before any IO):** `node_modules`, `.git`, `target`, `dist`, `build`, `temp`, `.ssh`, `.gnupg`, `secrets`, `vault`, `private`, `personal`, `medical`, `legal`.

**Pre-parse gate (before chunking):**
1. MIME/type confirmation
2. Size cap: 20MB text, 25MB PDFs
3. Privacy filter (§6.3) — runs before content enters memory

Failed files logged as `seen_but_excluded` with triggering rule.

#### Email Connector

IMAP rejected — no reliable delta semantics. OAuth + provider REST APIs only.

- Gmail via Gmail API (OAuth 2.0, `history.list` for deltas)
- Outlook/Office 365 via Microsoft Graph (delta queries)

Common `EmailConnector` interface — new providers are new connector implementations, not architectural changes.

**Auth:** OAuth 2.0 refresh tokens in OS keychain (Windows Credential Manager / macOS Keychain), fallback to KERNL encrypted vault. One-time browser OAuth flow per provider. Re-auth only on hard token expiry — surfaced as blocking status bar notice.

**Polling:** 15-minute interval, provider delta APIs only. Exponential backoff on 429. User notified if provider unavailable >1 hour.

**Unit of indexing:** Individual messages. Attachments indexed only if text-based and <10MB.

**Email data model:**
```sql
CREATE TABLE email_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  email TEXT NOT NULL,
  auth_data TEXT,               -- encrypted JSON
  enabled BOOLEAN DEFAULT 1,
  last_sync INTEGER,
  sync_status TEXT
);

CREATE TABLE email_messages (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES email_accounts(id),
  thread_id TEXT,
  from_address TEXT,
  to_addresses TEXT,
  subject TEXT,
  date INTEGER,
  snippet TEXT,
  has_attachments BOOLEAN,
  indexed_at INTEGER
);
```

#### Chunking Strategy

| Content | Target size | Overlap |
|---|---|---|
| Code | ~600 tokens (function/class boundaries) | 50 tokens |
| Documents/PDFs | ~700 tokens (paragraph-aware) | 100 tokens |
| Plain text | ~600 tokens | 100 tokens |
| Email | Full body if ≤700 tokens; else prose rules | 100 tokens |

Each chunk stores: `source_type`, `source_id`, `chunk_index`, `timestamp`, and metadata JSON (extension, email subject, sender, thread ID).

#### Embedding Pipeline

Same model as Cross-Context Engine: `BAAI/bge-small-en-v1.5`. Shared `vec_index`. Mandatory — diverging models would fracture the unified semantic space.

Batches of 10, 100ms delay. AEGIS-governed: `BUILD_SPRINT/COUNCIL` → pause; `DEEP_FOCUS` → half speed; `IDLE` → full. Queue never drops — backs up and processes when compute is available.


---

### §6.3 Privacy Model — Exclusion Policy

Ghost is **deny-by-default at the semantic level**. Exclusion runs before chunking. Excluded content is neither embedded nor stored — only logged as `seen_but_excluded`.

**Layer 1 — Hard-coded, always excluded:**
- Credential files: `.env`, `.pem`, `.key`, `.p12`, `.keystore`
- Filename patterns: `*password*`, `*secret*`, `*token*`, `*credential*`, `*id_rsa*`
- OS keychain directories, browser profile directories
- Content containing `BEGIN PRIVATE KEY`, `BEGIN RSA PRIVATE KEY`, high-confidence API key patterns
- Directories: `.ssh`, `.gnupg`, `secrets`, `vault` (case-insensitive)
- Financial document patterns: `*tax_return*`, `*statement*`, `*w2*`
- Encrypted files (high entropy, no recognized structure)

**Layer 2 — Pattern-based, pre-embedding scan:**
Before any chunk is embedded, a lightweight regex pass checks for:
- SSNs (`\d{3}-\d{2}-\d{4}`)
- Credit card numbers (Luhn-pattern detection)
- Medical identifiers and diagnosis language
- API keys and JWT tokens

If triggered, chunk is discarded. Scan runs on raw text before embedder sees it.

**Layer 3 — Contextual defaults:**
- `private`, `personal`, `medical`, `legal` directories → excluded by default
- Email from medical/legal provider domains → excluded by default
- Email subjects with "confidential", "privileged", "attorney-client" → excluded by default

**Layer 4 — User-configurable:**
```sql
CREATE TABLE ghost_exclusions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,     -- 'path' | 'glob' | 'domain' | 'sender' | 'keyword'
  pattern TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  created_at INTEGER
);
```

**Data residency:** All Ghost data in KERNL SQLite, AES-256 (SQLCipher). Key in OS keychain, never plaintext. TLS for all Claude API calls. No other outbound network calls.

**Audit trail:**
```sql
CREATE TABLE ghost_indexed_items (
  id TEXT PRIMARY KEY,
  chunk_id TEXT REFERENCES content_chunks(id),
  source_type TEXT,
  source_id TEXT,
  indexed_at INTEGER,
  exclusion_rule_applied TEXT   -- NULL if indexed; rule ID if excluded
);
```

The design explicitly biases toward over-exclusion. A missed insight is recoverable. A privacy violation is not.

---

### §6.4 Interrupt Threshold Engine

Interrupts are **decision-support hypotheses** that clear a multi-signal gate. Max 2 per day. Each one should feel like a discovery, not a notification.

**Scoring formula:**
```
score = similarity × recency_boost × relevance_boost × (1 - dismissal_penalty) × importance_boost
```

- `similarity`: Cosine similarity vs. strategic thread's last 10 messages + active manifest objectives
- `recency_boost`: 1.0 for last 7 days, decays to 0.5 at 90 days
- `relevance_boost`: 1.2 if chunk belongs to active project; else 1.0
- `dismissal_penalty`: 0.2 × dismissals in last 30 days, capped at 0.8
- `importance_boost`: 1.5 if marked critical (project root, decision log, VIP sender); else 1.0

**Candidate generation:** 6-hour cadence (or immediately: priority sender email, large file commit). Query top 50 similar chunks, filter last 7 days, score remainder.

**Selection:** Top 2 exceeding 0.75 threshold. Hard cap: 2 per rolling 24h. Remaining candidates queue for next window.

**Critical override:** similarity >0.95 AND importance_boost >1.3 → bypass daily cap. Rare by design. Every occurrence logged. If fires >1/week → importance tagging needs recalibration.

**History:**
```sql
CREATE TABLE ghost_interrupt_history (
  id TEXT PRIMARY KEY,
  chunk_id TEXT REFERENCES content_chunks(id),
  score REAL,
  shown_at INTEGER,
  action TEXT CHECK(action IN ('dismissed', 'clicked', 'ignored')),
  feedback_at INTEGER
);
```

Weekly background job adjusts scoring weights from history. Weights in config table, resettable.

**UI surface:** Ghost cards in context panel only. Never in strategic thread. One-sentence summary + source + Tell me more / Noted dismiss. Auto-expire after 4 hours if not acted on (logged as `ignored`).

---

### §6.5 Phase 1 Schema Requirements

Ghost is Phase 6. Schema must be ready in Phase 1. No migrations when Ghost arrives.

All Ghost tables are defined in §3.1 of BLUEPRINT_FINAL.md:
- `content_chunks` — shared with Cross-Context Engine
- `email_accounts`, `email_messages`
- `ghost_sources`, `ghost_exclusions`
- `ghost_interrupt_history`, `ghost_interrupt_queue`
- `ghost_indexed_items`
- `vec_index` virtual table (via sqlite-vec extension)

The `content_chunks` table is shared. Cross-Context Engine writes conversation chunks (`source_type='conversation'`). Ghost writes file and email chunks (`source_type='file'|'email'`). Same `vec_index`. Unified semantic space by design.


---

### §6.6 Security Model

**Threat model:**
1. Local attacker with user-level access — most realistic threat
2. Compromised dependency in the ingest pipeline
3. Over-sharing to Anthropic's Claude API

**Defenses:**
- **Encryption at rest:** All Ghost data in KERNL AES-256 SQLite. Key in OS keychain, never plaintext.
- **Process isolation:** Ghost has no network access except Anthropic API + Gmail/Microsoft Graph. No other outbound calls.
- **Prompt sanitization:** Privacy exclusion pipeline (§6.3) runs before any content reaches Claude. Failed content is never embedded and therefore never queried.
- **Audit and deletion:** David can inspect and delete any indexed item via Privacy Dashboard. One-click "purge all Ghost data" always available.
- **Dependency hygiene:** All ingest pipeline libraries (`notify`, email connectors) included in standard SCA build scan.
- **Prompt injection defense:** All ingest content marked `[UNTRUSTED CONTENT]` in Claude context packages. Claude reads it as data to analyze, not instructions to follow.

---

### §6.7 Build Sequence (Phase 6)

| Task | Deliverable | Dependencies | Est. Sessions |
|---|---|---|---|
| 6A | Rust filesystem watcher: notify, debouncing, file type filtering | Phase 1 schema | 2 |
| 6B | Email connectors: OAuth (Gmail first, then Outlook), delta polling, parsing | KERNL vault, Phase 1 schema | 4 |
| 6C | Unified ingest pipeline: chunking, embedding, write to content_chunks + vec_index | 6A, 6B, Phase 3 engine | 2 |
| 6D | Privacy exclusion engine: regex pre-pass, hard-coded rules, pattern matching | 6C | 2 |
| 6E | Interrupt scoring engine: candidate gen, scoring, ranking, daily cap, history | 6C, Phase 3 vector index | 3 |
| 6F | Ghost process lifecycle: spawn, IPC, AEGIS integration, crash recovery | 6C, 6D, 6E | 2 |
| 6G | Privacy Dashboard UI: exclusion management, audit log, chunk deletion | 6D, 6F | 2 |
| 6H | Context panel Ghost cards: interrupt queue polling, card display, actions | 6E, 6F | 1 |
| 6I | End-to-end integration and hardening | All above | 2 |

**Total: 20 sessions, 7-9 days.**

---

### §6.8 Open Items

1. **Interrupt score threshold calibration.** 0.75 is a starting estimate. Manual review after two weeks: should produce ~1-2 meaningful interrupts/day. Too few → threshold too high. All dismissed → threshold too low. Adjust in increments of 0.03.

2. **Debounce window tuning.** 750-1500ms starting range. David's build processes will determine the right setting. Configurable, surfaced as a user setting.

3. **Email indexing scope.** Initial sync of a large mailbox could be disruptive. Phase 6 must include controlled initial sync with rate limiting, visible progress indicator in Privacy Dashboard, and ability to pause email sync independently of filesystem watcher.
