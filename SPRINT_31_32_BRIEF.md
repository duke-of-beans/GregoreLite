═══════════════════════════════════════════════════════════════
SPRINT 31.0 — Start at Boot: OS Startup Registration
Run after Sprint 30.0. Independent of other sprints.
GregLite launches when you turn on your computer.
═══════════════════════════════════════════════════════════════

Execute Sprint 31.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\settings\SettingsPanel.tsx (or equivalent settings root)
  Filesystem:read_file D:\Projects\GregLite\app\src-tauri\tauri.conf.json
  Filesystem:read_file D:\Projects\GregLite\app\src-tauri\src\main.rs
  Filesystem:read_file D:\Projects\GregLite\build-installer.bat (NSIS installer config)

Summary: Add the ability for GregLite to launch automatically when the user starts their computer. Two surfaces: a Settings toggle ("Launch on startup") and an NSIS installer wizard step asking the user during first install. On Windows, this writes to the Registry Run key. On macOS, this creates a LaunchAgents plist. The Tauri Rust layer handles the OS-specific registration since it has native access. The Next.js settings UI toggles it via Tauri IPC command.

VOICE MANDATE: All user-facing text through lib/voice/copy-templates.ts.

Tasks:

1. **Rust startup manager** — `src-tauri/src/startup.rs`:
   - `register_startup()`: Writes the GregLite executable path to the OS startup mechanism.
     * Windows: `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` registry key, value name "GregLite", value = path to gregore.exe.
     * macOS: Creates `~/Library/LaunchAgents/ai.greglite.desktop.plist` with the app bundle path and `RunAtLoad = true`.
   - `unregister_startup()`: Removes the startup entry.
     * Windows: Deletes the "GregLite" registry value.
     * macOS: Deletes the plist file.
   - `is_registered_startup() -> bool`: Checks if the entry currently exists.
   - All three functions are exposed as Tauri commands: `startup_register`, `startup_unregister`, `startup_is_registered`.
   - Use the `winreg` crate on Windows, `std::fs` on macOS for plist write.
   - Wrap all operations in Result — never panic on failure (user might not have registry permissions).

2. **Tauri command registration** — `src-tauri/src/main.rs`:
   - Register the three new commands in the Tauri builder: `startup_register`, `startup_unregister`, `startup_is_registered`.
   - Import from `startup.rs` module.

3. **TypeScript IPC bridge** — `lib/startup/client.ts`:
   - `isStartupRegistered(): Promise<boolean>` — calls `invoke('startup_is_registered')`.
   - `registerStartup(): Promise<void>` — calls `invoke('startup_register')`.
   - `unregisterStartup(): Promise<void>` — calls `invoke('startup_unregister')`.
   - All three wrapped in try/catch — dev mode (no Tauri) returns false/no-op gracefully.

4. **Settings toggle** — `components/settings/StartupSection.tsx`:
   - New section in Settings panel: "Startup" (or "Launch Behavior" in voice templates).
   - Single toggle: "Launch GregLite when you start your computer"
   - On mount: call `isStartupRegistered()` to set initial toggle state.
   - On toggle ON: call `registerStartup()`, show confirmation toast: "Registered. GregLite will launch on next boot."
   - On toggle OFF: call `unregisterStartup()`, show confirmation toast: "Removed. GregLite won't auto-launch."
   - If the Tauri command fails (permissions, dev mode): show muted warning: "Couldn't update startup settings. Try running as administrator."
   - Description text under toggle: "GregLite starts minimized in the system tray. Your projects and capture pad are always one click away."

5. **NSIS installer integration** — `build-installer.bat` or NSIS config:
   - Add a checkbox step to the installer wizard: "Launch GregLite when Windows starts" (checked by default).
   - If checked, the installer writes the same `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` entry during install.
   - If unchecked, no entry is written (user can enable later from Settings).
   - On uninstall: always remove the startup entry if it exists.

6. **Voice copy** — `lib/voice/copy-templates.ts`:
   - Add `startup` section:
     ```typescript
     startup: {
       settings_title: 'Launch Behavior',
       settings_description: 'GregLite starts minimized in the system tray. Your projects and capture pad are always one click away.',
       toggle_label: 'Launch GregLite when you start your computer',
       toast_registered: 'Registered. GregLite will launch on next boot.',
       toast_unregistered: 'Removed. GregLite won\'t auto-launch.',
       toast_error: 'Couldn\'t update startup settings. Try running as administrator.',
       installer_checkbox: 'Launch GregLite when Windows starts',
     }
     ```

7. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
   - `npx tsc --noEmit`: 0 errors.
   - `cargo check --manifest-path app/src-tauri/Cargo.toml`: 0 errors (new Rust code).
   - `pnpm test:run`: all passing.
   - Add tests for the TypeScript IPC bridge (mock invoke, verify graceful dev-mode degradation).

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- All user-facing text through lib/voice/copy-templates.ts.
- The Rust startup code must handle BOTH Windows and macOS. Use conditional compilation (`#[cfg(target_os = "windows")]` / `#[cfg(target_os = "macos")]`).
- NEVER use HKLM (requires admin). Always HKCU (current user, no elevation needed).
- The toggle in Settings must reflect actual OS state (read from registry/plist), not a cached preference.
- Dev mode (no Tauri): all startup functions gracefully return false/no-op. Never crash.
- The installer checkbox is Windows-only (NSIS). macOS uses the Settings toggle.
- Ghost Thread must NEVER block the UI.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.


═══════════════════════════════════════════════════════════════
SPRINT 32.0 — Headless Browser Mode: Claude Web Token Routing
Run after Sprint 30.0. Architecturally significant. Independent of Sprint 31.
Eliminate API costs by routing through Claude's web interface.
═══════════════════════════════════════════════════════════════

Execute Sprint 32.0 for GregLite.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\CLAUDE_INSTRUCTIONS.md
  Filesystem:read_file D:\Dev\TECHNICAL_STANDARDS.md
  Filesystem:read_file D:\Projects\GregLite\PROJECT_DNA.yaml
  Filesystem:read_file D:\Projects\GregLite\STATUS.md
  Filesystem:read_file D:\Projects\GregLite\app\lib\voice\copy-templates.ts
  Filesystem:read_file D:\Projects\GregLite\app\app\api\chat\route.ts (current API-based chat route)
  Filesystem:read_file D:\Projects\GregLite\app\lib\kernl\database.ts
  Filesystem:read_file D:\Projects\GregLite\app\components\settings\SettingsPanel.tsx

Summary: Add a "Web Session" mode that routes messages through Claude's web interface using a headless browser instead of the API. This eliminates API costs during development and dogfooding. The system authenticates once (user logs into Claude manually in a browser window), persists the session cookies, and routes subsequent messages through the web interface transparently. When the web session expires or encounters rate limits, it falls back gracefully to the API. A performance governor ensures GregLite's headless browser usage aligns with the throughput and rate characteristics of the Claude Desktop app — we must not exceed what a normal desktop app user would generate.

CRITICAL DESIGN PRINCIPLE: GregLite has the capability to outperform Claude Desktop in throughput. In headless browser mode, a governor MUST be in place to align usage with allowable desktop-app-level patterns. This means: matching typical message cadence, respecting the same rate limits a desktop user would hit, not parallelizing requests beyond what a single desktop session would produce. The governor is not optional — it is the primary safety mechanism that makes this feature ethically viable.

VOICE MANDATE: All user-facing text through lib/voice/copy-templates.ts.

Tasks:

1. **Web session data model** — `lib/kernl/database.ts` + `lib/web-session/types.ts`:
   - New SQLite table:
     ```sql
     CREATE TABLE IF NOT EXISTS web_sessions (
       id TEXT PRIMARY KEY,
       provider TEXT NOT NULL DEFAULT 'claude',
       cookies TEXT NOT NULL,           -- JSON blob of session cookies
       user_agent TEXT,
       session_started_at INTEGER NOT NULL,
       last_used_at INTEGER NOT NULL,
       expires_at INTEGER,              -- estimated expiry (if detectable)
       status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'expired', 'revoked'
       daily_message_count INTEGER NOT NULL DEFAULT 0,
       daily_reset_at INTEGER           -- midnight UTC of current day
     );
     ```
   - `WebSession` TypeScript interface.
   - `WebSessionStatus = 'active' | 'expired' | 'revoked'`
   - `ChatMode = 'api' | 'web_session' | 'auto'` — auto tries web first, falls back to API.

2. **Performance governor** — `lib/web-session/governor.ts`:
   - `WebSessionGovernor` class that enforces desktop-app-equivalent usage patterns:
   - **Rate limits** (configurable, conservative defaults):
     * Maximum messages per minute: 4 (a human typing and reading responses)
     * Maximum messages per hour: 40
     * Maximum messages per day: 200 (aligned with typical Claude Pro daily caps)
     * Minimum delay between messages: 8 seconds (human reading time)
   - **Burst detection**: if 3+ messages are sent within 30 seconds, the governor introduces artificial delay to simulate human pacing. This prevents rapid-fire automated patterns that would distinguish GregLite from a normal desktop user.
   - **Cooldown escalation**: if the daily cap is approached (>180 messages), the governor increases minimum delay between messages to 15 seconds and logs a warning.
   - `canSendMessage(): { allowed: boolean, waitMs: number, reason?: string }` — call before every web-session message.
   - `recordMessageSent()` — call after each successful message.
   - `getUsageStats(): { today: number, thisHour: number, thisMinute: number, remainingDaily: number }` — for Settings display.
   - Daily counters reset at midnight UTC automatically.
   - All governor limits are configurable in Settings but DEFAULT to conservative values. The defaults are chosen to be indistinguishable from a real desktop app user.

3. **Headless browser engine** — `lib/web-session/browser.ts`:
   - Use Puppeteer (already an available pattern — see Sprint 12 browser automation references) to manage a headless Chromium instance.
   - `WebBrowserEngine` class:
     * `initialize()`: launch headless browser with persistent user data dir (cookies survive restarts).
     * `authenticate()`: navigate to claude.ai, check if already logged in (cookies). If not, open a VISIBLE browser window for the user to log in manually. Once login detected, save cookies to SQLite and switch back to headless.
     * `sendMessage(text: string): AsyncGenerator<string>` — navigates to the Claude web interface, types the message into the input, sends it, and streams the response text back as it appears in the DOM. Returns an async generator that yields response chunks.
     * `isSessionValid(): boolean` — checks if cookies are still valid (try loading claude.ai, check for login redirect).
     * `shutdown()` — close browser instance cleanly.
   - **Session persistence**: cookies stored in `web_sessions` table. On startup, load cookies and inject into browser context. No re-login needed unless session expired.
   - **DOM interaction strategy**: Use `page.waitForSelector()` to detect the message input, response container, and streaming indicators. This is fragile by nature (Anthropic can change their DOM) — so wrap ALL selectors in a `selectors.ts` config file that can be updated without code changes.
   - **Error handling**: if any DOM interaction fails (selector not found, page structure changed), log the error, mark session as needs-attention, and fall back to API immediately. Never block the user's message.

4. **Selectors config** — `lib/web-session/selectors.ts`:
   - All CSS selectors for the Claude web interface in one place:
     ```typescript
     export const CLAUDE_SELECTORS = {
       // Login detection
       loggedInIndicator: '[data-testid="user-menu"]',  // adjust to actual DOM
       loginPage: 'input[type="email"]',

       // Chat interaction
       messageInput: '[contenteditable="true"]',  // or textarea — inspect actual DOM
       sendButton: 'button[aria-label="Send"]',
       
       // Response reading
       assistantMessage: '[data-role="assistant"]',
       streamingIndicator: '[data-is-streaming="true"]',
       
       // Rate limit detection
       rateLimitBanner: '[class*="rate-limit"]',
       errorBanner: '[class*="error"]',
     };
     ```
   - These WILL need updating as Anthropic changes their UI. The file should have a header comment: "These selectors target claude.ai DOM elements. Update when Anthropic changes their web interface."
   - Include a `SELECTORS_VERSION` constant and a last-verified date.

5. **Chat route integration** — `app/api/chat/route.ts`:
   - Add `chatMode` resolution at the top of the route handler:
     * Read user's preferred mode from settings ('api' | 'web_session' | 'auto').
     * If 'api': use existing Anthropic SDK path (no change).
     * If 'web_session': check governor → check session valid → route through browser engine → stream response back via SSE.
     * If 'auto': try web_session first. If governor blocks, session invalid, or any error occurs, transparently fall back to API. Log the fallback reason.
   - The SSE response format must be IDENTICAL regardless of whether the message went through API or web session. The client should not be able to tell the difference (except via the receipt footer which shows the routing method).
   - Add a `routedVia` field to the SSE `done` event: `'api'` or `'web_session'`. The receipt footer can display this.

6. **Authentication flow UI** — `components/settings/WebSessionSection.tsx`:
   - New section in Settings: "Web Session" (under a "Message Routing" or "Connection" heading).
   - Controls:
     * **Mode selector**: Radio group — "API Only" / "Web Session" / "Auto (web first, API fallback)" (default: API Only).
     * **Session status**: Shows current state — "Active (expires ~{time})" / "Expired" / "Not connected".
     * **Connect button**: Opens a visible browser window to claude.ai for the user to log in. Once login detected, shows "Connected" with a green dot.
     * **Disconnect button**: Clears cookies, marks session revoked.
     * **Governor stats**: Shows today's usage — "{N}/200 messages today, {M}/40 this hour". Progress bar visualization.
     * **Governor limits**: Advanced section (collapsed by default) showing the rate limits. Editable but with a warning: "Increasing these limits may cause your web session to be rate-limited or suspended."
   - Description: "Route messages through Claude's web interface instead of the API. Reduces API costs during development. A performance governor ensures usage matches normal desktop-app patterns."

7. **Receipt footer integration** — `components/chat/ReceiptFooter.tsx` or `Message.tsx`:
   - When a message was routed via web session, the receipt footer shows: "✓ web · {latency} · {model}" instead of "✓ $0.002 · {latency} · {model}".
   - The "web" label replaces the cost (web session messages have $0 API cost).
   - Expanded receipt shows: "Routed via: Web Session" and "Daily budget: {N}/200".

8. **Fallback logic** — `lib/web-session/fallback.ts`:
   - `routeMessage(text: string, mode: ChatMode): AsyncGenerator<{ chunk: string, routedVia: 'api' | 'web_session' }>`:
   - Central routing function that handles the mode logic:
     * 'api': direct to Anthropic SDK.
     * 'web_session': governor check → session check → browser engine → stream.
     * 'auto': try web_session path. On ANY failure (governor block, session expired, DOM error, timeout >30s), immediately fall back to API. Log: "Web session unavailable ({reason}), routing via API."
   - The fallback must be FAST — if web session fails, the user should not wait more than 2-3 seconds before API takes over.

9. **Governor settings persistence** — `lib/web-session/governor.ts`:
   - Governor limits stored in `kernl_settings` table under keys: `web_governor_max_per_minute`, `web_governor_max_per_hour`, `web_governor_max_per_day`, `web_governor_min_delay_ms`.
   - Load on startup, use defaults if not set.
   - Daily message count stored in `web_sessions.daily_message_count`, reset when `daily_reset_at` is before today's midnight UTC.

10. **Voice copy** — `lib/voice/copy-templates.ts`:
    - Add `webSession` section:
      ```typescript
      webSession: {
        settings_title: 'Message Routing',
        settings_description: 'Route messages through Claude\'s web interface instead of the API. Reduces costs during development.',
        mode_api: 'API Only',
        mode_api_desc: 'All messages go through the Anthropic API. Standard billing applies.',
        mode_web: 'Web Session',
        mode_web_desc: 'All messages route through Claude\'s web interface. No API cost.',
        mode_auto: 'Auto',
        mode_auto_desc: 'Tries web session first. Falls back to API if unavailable.',
        status_active: (expiresIn: string) => `Active (expires ~${expiresIn})`,
        status_expired: 'Expired. Reconnect to continue using web routing.',
        status_disconnected: 'Not connected.',
        connect_button: 'Connect to Claude',
        disconnect_button: 'Disconnect',
        governor_title: 'Usage Governor',
        governor_description: 'Limits ensure usage matches normal desktop-app patterns.',
        governor_warning: 'Increasing these limits may cause your web session to be rate-limited.',
        governor_stats: (today: number, max: number) => `${today}/${max} messages today`,
        receipt_web: 'web',
        receipt_routed_via_web: 'Routed via: Web Session',
        receipt_routed_via_api: 'Routed via: API',
        fallback_toast: (reason: string) => `Web session unavailable (${reason}). Using API.`,
      }
      ```

11. **TypeScript Gate + Test Suite** — zero new errors, all tests green:
    - `npx tsc --noEmit`: 0 errors.
    - `pnpm test:run`: all passing + new tests:
      * Governor: test rate limits (per-minute, per-hour, per-day), burst detection, cooldown escalation, daily reset.
      * Fallback: test mode routing logic (api/web/auto), test auto-fallback on session failure.
      * Selectors: verify selectors config exports correctly (basic structure test).
    - Do NOT test actual browser interaction (Puppeteer tests require a running browser). Mock the browser engine in tests.

CRITICAL CONSTRAINTS:
- TypeScript strict mode. Zero errors before commit.
- All user-facing text through lib/voice/copy-templates.ts.
- The GOVERNOR IS NOT OPTIONAL. Every web-session message must pass through the governor before being sent. No bypasses, no overrides that remove the governor entirely.
- Governor defaults MUST be conservative: 4/min, 40/hr, 200/day, 8s minimum delay. These ensure GregLite's headless usage is indistinguishable from a human using Claude Desktop.
- Burst detection (3+ messages in 30s) introduces artificial delay. This is the key signal that differentiates automation from human usage.
- Selectors WILL break when Anthropic updates their UI. The selectors.ts file must be easy to update. Include version and last-verified date.
- Authentication MUST be manual (user logs in themselves in a visible window). GregLite NEVER stores or enters Anthropic credentials. Only session cookies are persisted.
- Fallback to API must happen within 2-3 seconds of web session failure. Never leave the user waiting.
- The SSE response format must be identical whether API or web session. Client code should not care about routing.
- Ghost Thread must NEVER block the UI.
- This is a large sprint (11 tasks). Split into two commits: Tasks 1-4 + 9 (backend + governor + selectors) first, Tasks 5-8 + 10-11 (route integration + UI + voice) second. Both must pass TypeScript gate.
- Puppeteer is a heavy dependency (~300MB Chromium download). Consider using `puppeteer-core` + the user's existing Chrome installation to avoid the download. Check if the Tauri WebView's Chromium can be reused.

Project: D:\Projects\GregLite\app
Shell: Use cmd (not PowerShell)
Git: Full path `D:\Program Files\Git\cmd\git.exe`. Write commit message to temp file, then `git commit -F temp_msg.txt`.
