GREGLITE SPRINT 6B - Ghost Thread Email Connectors (Gmail + Outlook)
Phase 6, Sprint 2 of 9 | Sequential after 6A | March 2, 2026

YOUR ROLE: Build the email connectors - OAuth 2.0 REST APIs for Gmail and Microsoft Graph. No IMAP. Tokens in OS keychain with KERNL vault fallback. 15-minute polling cadence. Individual messages indexed; attachments only if text-based and under 10MB. David is CEO. Zero debt, complete implementation.

GIT PROTOCOL: All git ops use shell cmd. Write commit message to .git\COMMIT_MSG_TEMP, then: git commit -F .git\COMMIT_MSG_TEMP

MANDATORY BOOTSTRAP:
1. D:\Dev\CLAUDE_INSTRUCTIONS.md
2. D:\Dev\TECHNICAL_STANDARDS.md
3. D:\Dev\SUBAGENT_ROUTING_PROTOCOL.md
4. D:\Projects\GregLite\DEV_PROTOCOLS.md
5. D:\Projects\GregLite\STATUS.md
6. D:\Projects\GregLite\BLUEPRINT_FINAL.md - section 6 fully
7. D:\Projects\GregLite\SPRINT_6A_COMPLETE.md
Baseline: cd D:\Projects\GregLite\app && npx tsc --noEmit && pnpm test:run

AUTHORITY PROTOCOL - STOP WHEN:
- OAuth flow requires a local redirect server - design the Tauri-native OAuth approach before building
- Gmail history.list API behavior is unclear - read Gmail API docs before writing the delta sync logic
- Microsoft Graph delta query pagination is complex - read Graph docs before writing
- Keychain access on Windows (DPAPI via keytar) throws unexpected errors - report before workarounds
- Same fix 3+ times

SUBAGENT ROUTING:
[HAIKU] Read BLUEPRINT section 6 and extract OAuth redirect port, token key names → pass exact path and section, capture output
[HAIKU] Write types.ts (EmailMessage, EmailAttachment, ConnectorStatus interfaces) → shapes fully specified above, mechanical write
[HAIKU] KERNL table migration: CREATE ghost_email_state → DDL specified below, mechanical
[HAIKU] Run pnpm add keytar googleapis @microsoft/microsoft-graph-client → mechanical execution
[HAIKU] Run npx tsc --noEmit + capture errors → mechanical
[HAIKU] SESSION END: Update STATUS.md sprint 6B complete, write SPRINT_6B_COMPLETE.md, git commit message to .git\COMMIT_MSG_TEMP, git add/commit -F/push
[SONNET] oauth.ts: OAuth 2.0 flow, local redirect server on port 47832, token exchange
[SONNET] keychain.ts: keytar Windows DPAPI wrapper + KERNL vault fallback
[SONNET] gmail.ts: GmailConnector class, history.list delta sync
[SONNET] graph.ts: GraphConnector class, Microsoft Graph delta queries
[SONNET] poller.ts: 15-minute polling cadence, AEGIS-governed, error counter logic
[SONNET] Debugging any keytar native compilation failures on Windows
[OPUS] Escalation only if Sonnet fails twice on the same problem

QUALITY GATES:
1. OAuth flow completes without opening a browser tab that requires manual copy-paste
2. Tokens stored in OS keychain (keytar), never written to disk in plaintext
3. Gmail connector uses history.list for delta sync (not full inbox scan every 15 min)
4. Graph connector uses delta queries (not full mailbox scan)
5. Attachments only indexed if content-type is text-based AND size under 10MB
6. All email content marked [UNTRUSTED CONTENT] before any Claude API call
7. pnpm test:run zero failures

FILE LOCATIONS:
  app/lib/ghost/email/
    index.ts           - public API: connect(provider), poll(), disconnect()
    gmail.ts           - Gmail API connector
    graph.ts           - Microsoft Graph connector
    oauth.ts           - OAuth 2.0 flow, token management
    keychain.ts        - OS keychain wrapper (keytar), KERNL vault fallback
    types.ts           - EmailMessage, EmailAttachment, ConnectorStatus interfaces
    poller.ts          - 15-minute polling cadence, AEGIS-governed

DEPENDENCIES:
  pnpm add keytar googleapis @microsoft/microsoft-graph-client

Read keytar docs for Windows - it uses DPAPI and requires native compilation. If keytar build fails, fall back to electron-store encrypted with a machine key (document the decision).

EMAILMESSAGE TYPE:
  export interface EmailMessage {
    id: string;
    provider: 'gmail' | 'outlook';
    subject: string;
    from: string;
    to: string[];
    body: string;               // plaintext only - strip HTML
    receivedAt: number;         // Unix ms
    attachments: EmailAttachment[];
    threadId: string;
    labels?: string[];          // Gmail only
    isRead: boolean;
  }
  export interface EmailAttachment {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    content?: string;           // only populated if text-based and under 10MB
  }

OAUTH FLOW:
Use Tauri's shell plugin to open the OAuth URL in the default browser. Listen for the redirect on a local HTTP server (port 47832, chosen to avoid conflicts). On redirect, extract the code, exchange for tokens, store in keychain. Refresh tokens automatically before expiry.

  // oauth.ts
  const REDIRECT_URI = 'http://localhost:47832/oauth/callback';
  const KEYCHAIN_SERVICE = 'greglite-ghost';

  export async function initiateOAuth(provider: 'gmail' | 'outlook'): Promise<void>
  export async function getAccessToken(provider: 'gmail' | 'outlook'): Promise<string>
  export async function refreshIfExpired(provider: 'gmail' | 'outlook'): Promise<void>
  export async function revokeTokens(provider: 'gmail' | 'outlook'): Promise<void>

Store in keychain under keys: greglite-ghost-gmail-access, greglite-ghost-gmail-refresh, greglite-ghost-outlook-access, greglite-ghost-outlook-refresh

KERNL vault fallback: if keytar throws on write, store tokens in KERNL settings table with AES-256 encryption using a machine key derived from the system hostname + a fixed salt. Document this fallback clearly - it is less secure than keychain and should only activate if keytar is unavailable.

GMAIL CONNECTOR:
Use Gmail API history.list for delta sync. On first connect, store historyId. Each poll fetches changes since last historyId.

  // gmail.ts
  export class GmailConnector {
    async connect(): Promise<void>           // OAuth + store initial historyId
    async poll(): Promise<EmailMessage[]>    // delta since last historyId
    async fetchMessage(id: string): Promise<EmailMessage>
    async fetchAttachment(messageId: string, attachmentId: string): Promise<string | null>
    async disconnect(): Promise<void>
  }

Store historyId in KERNL settings table under key ghost_gmail_history_id.

Strip HTML from body using a simple regex approach - do not add an HTML parser dependency. If body is multipart, prefer text/plain part. If only text/html exists, strip tags.

GRAPH CONNECTOR:
Use Microsoft Graph delta queries for mailbox changes.

  // graph.ts
  export class GraphConnector {
    async connect(): Promise<void>           // OAuth + store initial delta link
    async poll(): Promise<EmailMessage[]>    // delta since last link
    async fetchMessage(id: string): Promise<EmailMessage>
    async fetchAttachment(messageId: string, attachmentId: string): Promise<string | null>
    async disconnect(): Promise<void>
  }

Store delta link in KERNL settings under key ghost_graph_delta_link.

ATTACHMENT HANDLING:
Before indexing an attachment, check:
1. mimeType starts with text/ OR is application/json OR application/pdf OR application/vnd.openxmlformats (docx)
2. sizeBytes under 10 * 1024 * 1024 (10MB)
If either check fails, store the attachment metadata only (no content).

For PDF and DOCX attachments that pass the checks, use existing EoS or a simple extraction - do not add new parser dependencies if Phase 5's EoS already handles these types.

UNTRUSTED CONTENT MARKING:
All email body text and attachment content must be prefixed with [UNTRUSTED CONTENT] before being passed to any Claude API call or stored as embeddable chunks. This is a security requirement from section 6.6 of the BLUEPRINT. Enforce this in the connector layer, not in the consumer.

POLLING CADENCE (poller.ts):
  export function startEmailPoller(): void
  export function stopEmailPoller(): void

  - Poll interval: 15 minutes
  - Skip poll if Ghost is paused (AEGIS PARALLEL_BUILD or COUNCIL)
  - Skip poll if no connectors are authenticated
  - On poll error: log warning, increment error counter, skip (do not crash)
  - After 5 consecutive errors on same connector: surface Decision Gate suggestion to check credentials

KERNL TABLE for email indexing state:
  CREATE TABLE IF NOT EXISTS ghost_email_state (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    account TEXT NOT NULL,
    last_sync_at INTEGER,
    history_cursor TEXT,     -- historyId for Gmail, delta link for Graph
    error_count INTEGER DEFAULT 0,
    connected_at INTEGER
  );

SESSION END:
1. npx tsc --noEmit - zero errors
2. pnpm test:run - zero failures
3. Update STATUS.md - Sprint 6B complete
4. git commit -F .git\COMMIT_MSG_TEMP (message: sprint-6b: email connectors Gmail and Graph OAuth delta sync)
5. git push
6. Write SPRINT_6B_COMPLETE.md: OAuth flow tested end-to-end? keytar Windows behavior, any HTML stripping edge cases, attachment type decisions

GATES CHECKLIST:
- OAuth flow opens browser, captures redirect, stores tokens in keychain
- Tokens never written to disk in plaintext
- Gmail history.list delta sync works (not full scan)
- Graph delta query works (not full mailbox scan)
- HTML stripped from email bodies
- Text attachments under 10MB have content populated; others have metadata only
- All body/attachment content prefixed with [UNTRUSTED CONTENT]
- 15-minute poller starts/stops correctly
- ghost_email_state table populated after first poll
- AEGIS PARALLEL_BUILD pauses poller
- 5 consecutive errors surface Decision Gate suggestion
- pnpm test:run clean
- Commit pushed via cmd -F flag
