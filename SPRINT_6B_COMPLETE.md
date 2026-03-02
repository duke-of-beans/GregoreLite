# SPRINT 6B COMPLETE — Ghost Thread Email Connectors
**Date:** March 2, 2026  
**Gate:** 603/603 tests passing, 0 TypeScript errors  
**Commit:** sprint-6b: email connectors Gmail and Graph OAuth delta sync

---

## What Was Built

Seven files in `app/lib/ghost/email/`:

**types.ts** — Shared interfaces: `EmailMessage`, `EmailAttachment`, `ConnectorStatus`. Constants: `INDEXABLE_MIME_TYPES` (Set of eligible MIME types), `ATTACHMENT_MAX_BYTES` (10MB), `UNTRUSTED_CONTENT_PREFIX` (`[UNTRUSTED CONTENT] `).

**keychain.ts** — OS keychain wrapper using keytar (Windows DPAPI). Falls back transparently to AES-256-GCM encryption via `crypto.scryptSync` with machine key derived from `os.hostname() + VAULT_SALT` if keytar is unavailable. Vault format: `hex(iv):hex(tag):hex(ciphertext)`. Token keys: `greglite-ghost-gmail-access`, `greglite-ghost-gmail-refresh`, `greglite-ghost-outlook-access`, `greglite-ghost-outlook-refresh`, plus expiry keys for each.

**oauth.ts** — Full OAuth 2.0 flow. Local redirect server on port 47832 (chosen to avoid conflicts). CSRF state nonce via `crypto.randomUUID()`. `waitForAuthCode()` is a one-shot HTTP server that resolves the code or rejects on timeout/CSRF mismatch. Browser opened via Tauri `@tauri-apps/plugin-shell` with `child_process.exec` fallback. Gmail token exchange via `https://oauth2.googleapis.com/token`. Graph token exchange via `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`. Token refresh 5 minutes before expiry. Public API: `initiateOAuth`, `getAccessToken`, `refreshIfExpired`, `revokeTokens`.

**gmail.ts** — `GmailConnector` class. `connect()` calls Gmail profile endpoint to get initial `historyId` baseline. `poll()` calls `history.list` with `historyTypes=messageAdded` since last cursor — not a full inbox scan. Cursor stored in KERNL settings under `ghost_gmail_history_id`. HTML stripped via regex `stripHtml()` (no new dependency). Body prefers `text/plain` over `text/html` in MIME tree traversal. `fetchAttachment()` checks MIME eligibility and size before returning content. All body and attachment content prefixed with `[UNTRUSTED CONTENT]`. Error count tracked in `ghost_email_state` table. Singleton via `getGmailConnector(config?)`.

**graph.ts** — `GraphConnector` class. `connect()` seeds initial delta link via a minimal `$select=id` delta query. `poll()` uses the stored delta link to fetch only changed messages — not a full mailbox scan. Delta link advanced immediately after fetch to prevent duplicate processing. `@removed` tombstone entries filtered out. Attachment metadata fetched inline via `$expand=attachments($select=id,name,contentType,size,@odata.type)`. `fetchAttachment()` fetches `contentBytes` and checks MIME + size eligibility. Delta link stored in KERNL settings under `ghost_graph_delta_link`. Singleton via `getGraphConnector(config?)`.

**poller.ts** — 15-minute `setInterval` poller. `startEmailPoller()` / `stopEmailPoller()` / `isPollerRunning()`. Skips poll when AEGIS signal is `PARALLEL_BUILD` or `COUNCIL`. Checks `ghost_email_state` table to skip providers that have never connected. Uses `Promise.allSettled` so one provider failure does not skip the other. After 5 consecutive errors on a connector, calls `logDecision()` to surface a Decision Gate credential warning. Error count read from `ghost_email_state` after the connector's `incrementErrorCount()` runs.

**index.ts** — Public barrel. Re-exports all types, config interfaces, OAuth functions, connector classes, and poller controls. Adds `connectProvider(provider, config)` which initializes the singleton and starts the poller, and `disconnectProvider(provider)` which tears down the singleton and stops the poller if no providers remain connected.

**schema.sql** — Added `ghost_email_state` table: `id` (TEXT PK, `provider:account`), `provider`, `account`, `last_sync_at`, `history_cursor`, `error_count`, `connected_at`. Index on `(provider, account)`.

---

## Gate Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm test:run` | ✅ 603/603 (31 files) |
| OAuth redirect server | ✅ port 47832, one-shot, CSRF nonce |
| Tokens never plaintext on disk | ✅ keytar DPAPI / AES-256-GCM fallback |
| Gmail `history.list` delta sync | ✅ cursor-based, not full scan |
| Graph delta queries | ✅ delta link cursor, tombstones filtered |
| HTML stripping | ✅ regex, no new parser dep |
| `[UNTRUSTED CONTENT]` prefix | ✅ enforced at connector layer |
| Attachment eligibility gate | ✅ MIME + 10MB check before content |
| `ghost_email_state` populated | ✅ `upsertEmailState()` on connect + poll |
| 15-min poller | ✅ start/stop/isRunning |
| AEGIS pause propagation | ✅ PARALLEL_BUILD + COUNCIL skip poll |
| 5-error Decision Gate | ✅ `logDecision()` surfaced after threshold |

---

## Key Technical Discoveries

**`@tauri-apps/plugin-shell` types missing in dev** — The Tauri shell plugin has no type declarations in the non-Tauri dev environment. The dynamic `import('@tauri-apps/plugin-shell')` inside `openInBrowser()` requires `// @ts-expect-error`. The try-catch fallback to `child_process.exec` handles tests and dev server correctly.

**`noUncheckedIndexedAccess` and `.split()[0]`** — `str.split(';')[0]` returns `string | undefined` under this strict flag even with an obvious single-element result. All MIME base extraction uses `(str.split(';')[0] ?? '').trim().toLowerCase()`. Array destructuring `const [a, b, c] = arr` similarly gives `T | undefined` — fixed with `as [string, string, string]` cast after a length guard.

**Module-level variable narrowing gap** — TypeScript does not narrow `let x: T | null` assigned inside an `if` block when `x` is a module-level variable. The singleton pattern `if (!x) { x = new T(config); } return x;` requires `return x!` — the `!` non-null assertion is the correct fix. Wrapping in a local `const` would also work but obscures intent.

**Graph delta `@removed` tombstones** — Delta query responses include deletion notifications alongside new/updated messages. These have `@removed` set and only carry an `id`. They must be filtered before constructing `EmailMessage` objects. The `as { '@removed'?: unknown }` intersection cast is needed because `@removed` is a JSON key with a special character that TypeScript won't infer on a plain interface.

**Gmail baseline timing** — Storing the `historyId` from `profiles.get()` at connect time means the first `poll()` only fetches messages added after connection, not the full inbox history. This is correct and intentional — Ghost is a going-forward monitor, not a retroactive indexer.

**keytar fallback transparency** — keytar loads lazily via dynamic import, cached to `_keytar`. If it throws on load (native compilation failure, missing OS support), `_keytarUnavailable` is set and all subsequent calls route to the KERNL vault fallback. The machine key is derived via `scryptSync(hostname + salt, salt, 32)` — deterministic per machine, not stored anywhere.

**Graph `$expand=attachments` on delta URL** — The stored delta link is a full URL. When expanding attachments inline, the expand parameter is appended only if not already present (checked via `currentDeltaLink.includes('$expand=')`). This prevents double-appending on subsequent polls that reuse a delta link URL which already had the expansion.

---

## Next: Sprint 6C — Unified Ingest Pipeline

Sprint 6C builds the pipeline that connects the Ghost sources (filesystem events from 6A, email messages from 6B) to the KERNL vector index. Key work: chunker, batch embedder calling bge-small-en-v1.5, AEGIS queue guard, shared `content_chunks` + `vec_index` tables from Phase 3.
