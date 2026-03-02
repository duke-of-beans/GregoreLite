GREGLITE SPRINT 6D - Ghost Thread Privacy Exclusion Engine
Phase 6, Sprint 4 of 9 | Sequential after 6C | March 2, 2026

YOUR ROLE: Build the four-layer privacy exclusion engine. It sits between raw file/email content and the ingest pipeline. Content that violates any layer is discarded before embedding - never stored, never sent to Claude. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - section 6.3 (Privacy Model Four-Layer Exclusion) fully
7. D:\Projects\GregLite\SPRINT_6C_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- Luhn algorithm produces false positives on numeric sequences that are clearly not credit cards - tune the validator before deploying
- PII regex patterns produce more than 5% false positives when tested against a sample of David's code files - flag for review, do not ship noisy rules
- Layer 4 user-configurable exclusions schema requires KERNL table not yet created - create the migration before proceeding
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] Write layer1.ts (hard-coded path/filename/content pattern lists) → all patterns specified below, pure lookup logic, mechanical
[HAIKU] Write layer3.ts (contextual defaults) → defaults list fully specified, read-only lookups from code constants, mechanical
[HAIKU] CREATE ghost_exclusions table + CREATE ghost_exclusion_log table → DDL specified, mechanical
[HAIKU] Write types.ts (ExclusionResult, ExclusionReason, ExclusionLayer) → shapes fully specified, mechanical
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 6D complete, write SPRINT_6D_COMPLETE.md, git commit message, git add/commit -F/push
[SONNET] luhn.ts: Luhn algorithm implementation + false positive tuning
[SONNET] layer2.ts: PII scanner integrating SSN regex, Luhn CC check, API key patterns, JWT detection
[SONNET] layer4.ts: DB-backed user exclusions with 5-minute cache, micromatch glob matching
[SONNET] Modify app/lib/ghost/ingest/index.ts to call privacy check before chunking, per-chunk Layer 2 check
[SONNET] index.ts: checkFile() and checkEmail() public API orchestrating all 4 layers in order
[SONNET] False positive tuning against sample files if Layer 2 exceeds 5% false positive rate
[OPUS] Escalation only if Sonnet fails twice on the same problem

QUALITY GATES:
1. Layer 1 hard-coded patterns catch: .env files, .pem, .key, BEGIN PRIVATE KEY, .ssh dir, .gnupg dir, secrets dir, files with password/secret/token in name
2. Layer 2 PII scanner catches: SSNs (NNN-NN-NNNN pattern), credit cards (Luhn valid), API keys (common prefixes: sk-, pk-, ghp_, xox), JWT tokens (three-part base64)
3. Layer 3 contextual defaults skip: private/personal/medical/legal dirs, medical/legal domain emails, confidential/privileged/attorney-client subjects
4. Layer 4 user patterns read from ghost_exclusions table
5. Rejected content never touches content_chunks or vec_index
6. Rejection reason logged to ghost_exclusion_log for audit
7. pnpm test:run zero failures

FILE LOCATIONS:
  app/lib/ghost/privacy/
    index.ts         - public API: checkFile(path, content), checkEmail(message) -> ExclusionResult
    layer1.ts        - hard-coded path and filename patterns
    layer2.ts        - PII content scanner (SSN, CC, API keys, JWT)
    layer3.ts        - contextual defaults (dirs, email domains, subjects)
    layer4.ts        - user-configurable exclusions from ghost_exclusions table
    luhn.ts          - Luhn algorithm for credit card validation
    types.ts         - ExclusionResult, ExclusionReason, ExclusionLayer interfaces

EXCLUSION RESULT TYPE:
  export interface ExclusionResult {
    excluded: boolean;
    layer?: 1 | 2 | 3 | 4;
    reason?: string;
    pattern?: string;    // which specific pattern triggered
  }

LAYER 1 - HARD-CODED (layer1.ts):
Check the path before reading content. If path triggers Layer 1, do not read the file at all.

Path exclusions (check every component):
  .ssh  .gnupg  secrets  vault  private  personal  medical  legal

Filename suffix exclusions:
  .env  .pem  .key  .p12  .pfx  .cer  .crt

Filename contains exclusions (case-insensitive):
  password  secret  token  credential  apikey  api_key  private_key

Content-level triggers (after reading - if any of these appear, discard chunk):
  "BEGIN PRIVATE KEY"  "BEGIN RSA PRIVATE KEY"  "BEGIN EC PRIVATE KEY"  "BEGIN OPENSSH PRIVATE KEY"

LAYER 2 - PII SCANNER (layer2.ts):
Run on chunk text before embedding. If triggered, discard that chunk only (not the whole file).

SSN pattern: \b\d{3}-\d{2}-\d{4}\b
  - Must not be in a context that looks like a version number (e.g. 3-4-2024)
  - Simple heuristic: reject if the match is preceded/followed by a letter within 5 chars

Credit card: find sequences of 13-19 digits (with optional spaces/dashes), run Luhn check
  - Luhn implementation in luhn.ts - test against known valid/invalid numbers

API key patterns:
  sk-[a-zA-Z0-9]{20,}          (OpenAI, Anthropic)
  pk-[a-zA-Z0-9]{20,}          (Stripe public)
  ghp_[a-zA-Z0-9]{36}          (GitHub personal access token)
  ghs_[a-zA-Z0-9]{36}          (GitHub app token)
  xox[bpas]-[a-zA-Z0-9-]{10,}  (Slack tokens)
  AKIA[0-9A-Z]{16}              (AWS access key)
  ya29\.[a-zA-Z0-9_-]{20,}     (Google OAuth access token)

JWT pattern: [a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}
  - Only flag if all three parts are base64url-decodable (check the header for typ:JWT)

LAYER 3 - CONTEXTUAL DEFAULTS (layer3.ts):
These are defaults - David can override in Privacy Dashboard (Sprint 6G).

Directory defaults (excluded unless user opts in):
  medical  legal  attorney  privileged  therapy  health

Email domain defaults (excluded):
  Any email where subject contains: attorney-client  privileged  confidential  do not forward  legal hold

Email sender heuristics:
  *@legalfirm.com pattern is too broad - do not try to guess. Use subject line only for Layer 3.
  Domain-based exclusion is Layer 4 (user-configured).

Store Layer 3 defaults in code, not in the DB. They are not user-editable directly - only overridable via Layer 4.

LAYER 4 - USER CONFIGURABLE (layer4.ts):
Read from KERNL ghost_exclusions table. Cache in memory, refresh every 5 minutes.

KERNL TABLE:
  CREATE TABLE IF NOT EXISTS ghost_exclusions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('path_glob', 'domain', 'sender', 'keyword', 'subject_contains')),
    pattern TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    note TEXT
  );

  export async function getUserExclusions(): Promise<GhostExclusion[]>
  export async function addExclusion(type, pattern, note?): Promise<void>
  export async function removeExclusion(id: string): Promise<void>

Glob matching for path_glob type: use the 'micromatch' package (already likely in project, check before adding). If not present, add it - it is a small, zero-dependency glob matcher.

EXCLUSION LOG (audit trail):
  CREATE TABLE IF NOT EXISTS ghost_exclusion_log (
    id TEXT PRIMARY KEY,
    source_type TEXT,          -- 'file' | 'email'
    source_path TEXT,
    layer INTEGER,
    reason TEXT,
    pattern TEXT,
    logged_at INTEGER NOT NULL
  );

Log every exclusion. This feeds the Privacy Dashboard so David can see what is being filtered.

INTEGRATION INTO INGEST PIPELINE:
Modify app/lib/ghost/ingest/index.ts from Sprint 6C:
  - Call checkFile(path, content) before ingestFile proceeds to chunking
  - Call checkEmail(message) before ingestEmail proceeds to chunking
  - If result.excluded, write to ghost_exclusion_log and return early
  - Layer 2 runs per-chunk: call checkChunk(text) before embedding each chunk

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 6D complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-6d: privacy exclusion engine four layers)
5. git push
6. Write SPRINT_6D_COMPLETE.md: PII false positive rate tested against sample files, Luhn test coverage, Layer 4 exclusion round-trip tested, any patterns that needed tuning

GATES CHECKLIST:
- .env file never reaches ingest
- .pem file never reaches ingest
- File in secrets/ dir never reaches ingest
- File containing BEGIN PRIVATE KEY gets chunk discarded
- SSN pattern in chunk text triggers Layer 2 discard
- Valid credit card number (Luhn pass) in chunk text triggers Layer 2 discard
- Invalid credit card number (Luhn fail) does NOT trigger discard
- sk-xxxx API key pattern triggers Layer 2 discard
- JWT token triggers Layer 2 discard
- Email with attorney-client subject triggers Layer 3 exclusion
- User exclusion in ghost_exclusions table triggers Layer 4 exclusion
- All exclusions logged to ghost_exclusion_log
- Ingest pipeline returns early on exclusion, never writes to content_chunks
- pnpm test:run clean
- Commit pushed via cmd -F flag
