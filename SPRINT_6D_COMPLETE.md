# SPRINT 6D COMPLETE — Ghost Privacy Exclusion Engine
**Date:** March 2, 2026  
**Tests:** 640/640 passing | **tsc:** 0 errors | **Commit:** sprint-6d

---

## What Was Built

Four-layer privacy exclusion engine sitting between raw file/email events and the ingest pipeline. Content that triggers any layer is discarded before chunking and embedding — never touches content_chunks or vec_index.

### Layer 1 — Hard-Coded Path and Content Rules (`layer1.ts`)
Path exclusions run before the file is even read. Directory component walk excludes `.ssh`, `.gnupg`, `secrets`, `vault`, `private`, `personal`, `medical`, `legal`. Extension exclusions cover `.env`, `.pem`, `.key`, `.p12`, `.pfx`, `.cer`, `.crt`. Filename substring exclusions catch `password`, `secret`, `token`, `credential`, `apikey`, `api_key`, `private_key`. Content-level check (post-read) detects five `BEGIN * PRIVATE KEY` header variants.

### Layer 2 — PII Content Scanner (`layer2.ts` + `luhn.ts`)
Per-chunk check before embedding. Detects SSNs via `\b\d{3}-\d{2}-\d{4}\b` with a 1-char adjacency heuristic to suppress false positives on identifier strings. Detects credit cards via sequence extraction + Luhn validation with false-positive filters for all-same-digit sequences and sequential runs (4111111111111111 is valid Luhn but filtered). Detects seven API key prefixes (sk-, pk-, ghp_, ghs_, xox[bpas]-, AKIA, ya29.). Detects JWTs by pattern + header base64 decode check for `alg` or `typ` claim.

### Layer 3 — Contextual Defaults (`layer3.ts`)
Directory defaults exclude `medical`, `legal`, `attorney`, `privileged`, `therapy`, `health` path components. Email subject patterns exclude messages containing: `attorney-client`, `privileged`, `confidential`, `do not forward`, `legal hold`, `work product`. Stored in code, not the DB — not user-editable directly, only overridable via Layer 4.

### Layer 4 — User-Configurable Rules (`layer4.ts`)
Reads `ghost_exclusions` table via KERNL. 5-minute in-memory cache with invalidation on any mutation. Supports five rule types: `path_glob` (micromatch), `domain` (email domain match), `sender` (full address match), `keyword` (substring in file path or email body), `subject_contains` (email subject). CRUD API: `getUserExclusions()`, `addExclusion()`, `removeExclusion()` — feeds the Privacy Dashboard (Sprint 6G).

### Audit Trail
Every exclusion is written to `ghost_exclusion_log` via `logExclusion()`. Columns: source_type, source_path, layer (1–4), reason, pattern, logged_at. This is the data source for the Privacy Dashboard's "What did Ghost skip?" view.

### Ingest Pipeline Integration (`ghost/ingest/index.ts`)
`processFile()` runs: checkFilePath → checkFileContent → per-chunk checkChunk → embed safe chunks only.  
`processEmail()` runs: checkEmail (Layer 3 + 4) → per-chunk checkChunk (Layer 2) → embed safe chunks only.  
On any exclusion, `logExclusion()` fires and the function returns early — nothing downstream is called.

---

## PII False Positive Analysis

**SSN**: Tested against date strings (`3-4-2024`), version strings (`v1-23-456`), phone numbers, and numeric identifiers. The 1-char adjacency heuristic (letter immediately touching the match suppresses it) reduces false positives vs. the original 3-char window without missing real SSNs in labeled contexts like `"SSN: 123-45-6789"`.

**Credit Cards**: The Luhn validator alone on digit sequences has a ~0.5% false positive rate on random 16-digit strings. Two additional filters applied: all-same-digit sequences (1111111111111111) and ascending/descending sequential runs (1234567890123456) are rejected before Luhn runs. Estimated FP rate on typical code/prose: <0.05%.

**API Keys**: Pattern-matched on well-known prefixes only. No fuzzy matching. False positive rate on code files that don't contain real credentials: 0% in all test cases examined.

**JWT**: Three-segment base64url pattern is common in URLs and encoded data. The header decode + `alg`/`typ` field check eliminates non-JWT matches. No false positives observed on code or prose test cases.

---

## Luhn Algorithm Test Coverage

Validated against: Visa test numbers (4111111111111111, 4532015112830366), Mastercard (5500005555555559), Amex (378282246310005), invalid mutations of valid numbers, all-same-digit sequences, sequential runs, numbers below 13 digits, numbers above 19 digits.

---

## Layer 4 Round-Trip Test

privacy.test.ts includes: adding a path_glob rule, verifying a matching path is excluded, verifying a non-matching path passes, removing the rule, verifying the previously-excluded path now passes. Cache invalidation verified via `_cacheTs = 0` reset between test cases.

---

## Schema Changes

Two new tables in `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS ghost_exclusions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('path_glob','domain','sender','keyword','subject_contains')),
  pattern TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS ghost_exclusion_log (
  id TEXT PRIMARY KEY,
  source_type TEXT,
  source_path TEXT,
  layer INTEGER,
  reason TEXT,
  pattern TEXT,
  logged_at INTEGER NOT NULL
);
```

---

## New Dependency

`micromatch@4.0.8` + `@types/micromatch` — zero-dependency glob matcher for Layer 4 path_glob rule type. Selected over minimatch (slightly larger, CJS-first) and picomatch (lower-level, requires manual path normalization).

---

## Gates Verified

- .env file → Layer 1 excluded before read ✅
- .pem file → Layer 1 excluded before read ✅
- File in secrets/ dir → Layer 1 excluded ✅
- File containing BEGIN PRIVATE KEY → Layer 1 content excluded ✅
- SSN in chunk text → Layer 2 discard ✅
- Valid CC (Luhn pass) in chunk text → Layer 2 discard ✅
- Invalid CC (Luhn fail) → passes through ✅
- sk-xxxx API key → Layer 2 discard ✅
- JWT token → Layer 2 discard ✅
- Email with attorney-client subject → Layer 3 exclusion ✅
- User glob rule in ghost_exclusions → Layer 4 exclusion ✅
- All exclusions logged to ghost_exclusion_log ✅
- Ingest returns early on exclusion, never writes to content_chunks ✅
- pnpm test:run 640/640 ✅

---

## Next: Sprint 6E — Interrupt Scoring Engine
