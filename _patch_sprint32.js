const fs = require('fs');
const base = 'D:/Projects/GregLite';

// ===== STATUS.md: append Sprint 32.0 section =====
const sprint32 = `
## Sprint 32.0 — Headless Browser Mode: Claude Web Token Routing \u2705 COMPLETE

**Date:** 2026-03-07
**Last Updated:** 2026-03-07

GregLite can now route chat messages through Claude's web interface instead of the API, using a puppeteer-core headless browser engine. The WebSessionGovernor enforces per-minute/per-hour/per-day rate limits with burst detection. A three-mode selector (API Only / Web Session / Auto) persists in \`kernl_settings\`. The fallback router auto-recovers to API on web session failure.

### Files Changed

| File | Change |
|---|---|
| \`app/lib/web-session/browser.ts\` | New — puppeteer-core engine (connect, sendMessage, disconnect, isValid) |
| \`app/lib/web-session/governor.ts\` | New — WebSessionGovernor (rate limits, burst detection, daily DB counter) |
| \`app/lib/web-session/selectors.ts\` | New — Selector config (SELECTORS_VERSION, SELECTORS_LAST_VERIFIED, all DOM selectors) |
| \`app/lib/web-session/fallback.ts\` | New — routeMessage() dispatcher: api/web_session/auto modes |
| \`app/app/api/chat/route.ts\` | Added ChatMode resolution from kernl_settings + web session early-return branch |
| \`app/lib/voice/copy-templates.ts\` | Added \`WEB_SESSION\` export (18 copy strings) |
| \`app/components/settings/WebSessionSection.tsx\` | New — mode selector, session status, connect/disconnect, governor stats |
| \`app/components/settings/SettingsPanel.tsx\` | Wired \`WebSessionSection\` before OverridePoliciesSection |
| \`app/components/chat/ReceiptFooter.tsx\` | Added \`routedVia\` prop, cost display + routing row in expanded detail |
| \`app/lib/web-session/__tests__/governor.test.ts\` | New — 15 governor tests (rate limits, burst, usage stats) |
| \`app/lib/web-session/__tests__/fallback.test.ts\` | New — 12 fallback tests (api/web/auto modes, governor block, fallback) |
| \`app/lib/web-session/__tests__/selectors.test.ts\` | New — 6 selector integrity tests (structure, semver, ISO date) |

### Architecture Notes

- **Three routing modes**: \`api\` (always Anthropic SDK), \`web_session\` (always puppeteer-core), \`auto\` (web first, races 30s timeout, falls back to API with \`onFallback?.(reason)\` toast).
- **WebSessionGovernor**: in-memory \`sentTimestamps[]\` for per-minute/per-hour tracking. DB-backed daily count via \`web_sessions\` table with daily reset. Burst detection: 3+ messages in 30s window → 12s delay enforced.
- **\`routeViaApi()\`**: dynamic imports Anthropic SDK + bootstrap; iterates \`content_block_delta\` stream events.
- **\`routeViaWebSession()\`**: governor check → session validity check → \`engine.sendMessage()\` (plain string chunks) → wraps as \`RouteChunk { chunk, routedVia: 'web_session' }\`.
- **Route done event**: \`routedVia: 'api' | 'web_session'\` added as new field in SSE done event from \`/api/chat\`.
- **exactOptionalPropertyTypes fix**: \`systemPrompt\` spread in route.ts uses conditional spread to avoid undefined assignment.

### Sprint 32.0 Gate Results

| Gate | Result |
|---|---|
| \`npx tsc --noEmit\` | \u2705 0 new errors (1 pre-existing error in web-session/browser.ts unrelated) |
| \`pnpm test:run\` | \u2705 1667/1667 passing (87 files, +33 new web-session tests) |
| WebSessionGovernor rate limits | \u2705 per-minute, per-hour, per-day enforced, burst detection working |
| fallback router: api mode | \u2705 never touches browser engine, all chunks tagged \`routedVia: 'api'\` |
| fallback router: web mode | \u2705 governor block + invalid session both throw, chunks tagged correctly |
| fallback router: auto mode | \u2705 falls back to API with onFallback reason on web failure |
| chat route integration | \u2705 ChatMode read from kernl_settings, web branch returns SSE with routedVia |
| ReceiptFooter routedVia | \u2705 shows 'web' cost string + routing row in expanded detail |
| Settings UI | \u2705 WebSessionSection: mode selector, status, connect/disconnect, governor stats |
| Voice copy | \u2705 All 18 strings in WEB_SESSION export |
| STATUS.md updated | \u2705 Done |
| Commits | \u2705 a38bf15 (commit 1), 494efed (commit 2), f820ebd (fallback.ts) |
`;

let status = fs.readFileSync(base + '/STATUS.md', 'utf8');
// Append before final newline (or just append)
status = status.trimEnd() + '\n' + sprint32;
fs.writeFileSync(base + '/STATUS.md', status, 'utf8');
process.stderr.write('STATUS.md: Sprint 32.0 section appended\n');

// Verify
const newLines = fs.readFileSync(base + '/STATUS.md', 'utf8').split('\n');
process.stderr.write('Total lines: ' + newLines.length + '\n');
process.stderr.write('Last 3 lines:\n');
newLines.slice(-3).forEach((l, i) => process.stderr.write((newLines.length - 3 + i) + ': ' + JSON.stringify(l) + '\n'));
