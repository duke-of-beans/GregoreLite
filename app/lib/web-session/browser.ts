/**
 * Web Browser Engine — Sprint 32.0
 *
 * Manages a headless Chromium instance for routing messages through
 * Claude's web interface. Uses puppeteer-core with the user's existing
 * Chrome or Edge installation — no bundled browser download needed.
 *
 * Authentication is ALWAYS MANUAL: the user logs into claude.ai themselves
 * in a visible browser window. GregLite NEVER stores or enters credentials.
 * Only session cookies are persisted (in the web_sessions SQLite table).
 *
 * Error handling: any DOM interaction failure marks the session needs-attention
 * and throws — the caller (fallback.ts) immediately routes to the API instead.
 * Users are NEVER left waiting because of a web session failure.
 */

import type { Browser, Page } from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { getDatabase } from '@/lib/kernl/database';
import { CLAUDE_SELECTORS } from './selectors';
import type { WebSession } from './types';

// ── Chrome/Edge path detection ─────────────────────────────────────────────

const CHROME_PATHS: string[] = [
  // Windows — Chrome
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env['LOCALAPPDATA']
    ? path.join(process.env['LOCALAPPDATA'], 'Google', 'Chrome', 'Application', 'chrome.exe')
    : '',
  // Windows — Edge (ships with Windows 10/11, always available)
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

function findChromePath(): string | null {
  for (const p of CHROME_PATHS) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

// ── User-data dir (cookies persist across restarts) ────────────────────────

const USER_DATA_BASE = path.join(
  process.env['APPDATA'] ?? path.join(process.env['HOME'] ?? '', '.config'),
  'greglite',
  'chrome-profile'
);

// ── Timing constants ───────────────────────────────────────────────────────

/** How long to wait for the user to log in manually (ms). */
const AUTH_TIMEOUT_MS = 300_000;
/** Hard timeout for a single message send + response (ms). */
const SEND_TIMEOUT_MS = 60_000;
/** DOM poll interval when reading streaming response (ms). */
const STREAM_POLL_INTERVAL_MS = 300;
/** Consecutive stable polls required to conclude streaming has ended. */
const STREAM_STABLE_TICKS = 5;

// ── Browser engine ─────────────────────────────────────────────────────────

export class WebBrowserEngine {
  private browser: Browser | null = null;
  private chromePath: string | null;
  private sessionId: string | null = null;

  constructor() {
    this.chromePath = findChromePath();
  }

  /** Launch headless browser. Loads existing cookies from DB if available. */
  async initialize(): Promise<void> {
    if (this.browser) return;

    if (!this.chromePath) {
      throw new Error(
        'Chrome or Edge not found. Install Google Chrome (or Microsoft Edge) to use Web Session mode.'
      );
    }

    fs.mkdirSync(USER_DATA_BASE, { recursive: true });

    // Dynamic import — puppeteer-core is an optional dep, not required for API mode
    const puppeteer = await import('puppeteer-core');

    this.browser = await puppeteer.default.launch({
      executablePath: this.chromePath,
      headless: true,
      userDataDir: USER_DATA_BASE,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    // Inject stored session cookies if we have an active session
    const session = this.loadActiveSession();
    if (session) {
      this.sessionId = session.id;
      await this.injectCookies(session.cookies).catch((err) =>
        console.warn('[browser] Failed to inject stored cookies:', err)
      );
    }
  }

  // ── Session persistence ─────────────────────────────────────────────────

  private loadActiveSession(): WebSession | null {
    try {
      return getDatabase()
        .prepare(`
          SELECT * FROM web_sessions
          WHERE status = 'active'
          ORDER BY last_used_at DESC
          LIMIT 1
        `)
        .get() as WebSession | null;
    } catch {
      return null;
    }
  }

  private async injectCookies(cookiesJson: string): Promise<void> {
    if (!this.browser) return;
    try {
      const cookies = JSON.parse(cookiesJson) as Parameters<Page['setCookie']>[0][];
      const page = await this.browser.newPage();
      try {
        await page.goto('https://claude.ai', { waitUntil: 'domcontentloaded', timeout: 15_000 });
        for (const cookie of cookies) {
          await page.setCookie(cookie);
        }
      } finally {
        await page.close();
      }
    } catch (err) {
      console.warn('[browser] Cookie injection failed:', err);
    }
  }

  private async persistCookies(page: Page): Promise<void> {
    try {
      const cookies = await page.cookies();
      const cookiesJson = JSON.stringify(cookies);
      const userAgent = await page.evaluate(() => navigator.userAgent).catch(() => null);
      const db = getDatabase();
      const now = Date.now();
      const midnight = this.getMidnightUtcMs();

      if (this.sessionId) {
        db.prepare(`
          UPDATE web_sessions
          SET cookies = ?, last_used_at = ?, status = 'active'
          WHERE id = ?
        `).run(cookiesJson, now, this.sessionId);
      } else {
        this.sessionId = nanoid();
        db.prepare(`
          INSERT INTO web_sessions
            (id, provider, cookies, user_agent, session_started_at, last_used_at,
             status, daily_message_count, daily_reset_at)
          VALUES (?, 'claude', ?, ?, ?, ?, 'active', 0, ?)
        `).run(this.sessionId, cookiesJson, userAgent, now, now, midnight);
      }
    } catch (err) {
      console.warn('[browser] Failed to persist cookies:', err);
    }
  }

  private getMidnightUtcMs(): number {
    const d = new Date();
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  private markSessionExpired(): void {
    if (!this.sessionId) return;
    try {
      getDatabase()
        .prepare(`UPDATE web_sessions SET status = 'expired' WHERE id = ?`)
        .run(this.sessionId);
      this.sessionId = null;
    } catch { /* non-blocking */ }
  }

  // ── Authentication ──────────────────────────────────────────────────────

  /**
   * Ensure the browser is authenticated with Claude.
   * If cookies are valid, returns true immediately.
   * Otherwise opens a VISIBLE browser window for the user to log in manually.
   * GregLite never enters credentials — only cookies are captured post-login.
   */
  async authenticate(): Promise<boolean> {
    if (!this.browser) await this.initialize();
    if (!this.browser) return false;

    if (await this.isSessionValid()) return true;

    const puppeteer = await import('puppeteer-core');

    console.log('[browser] Opening visible browser window for manual Claude login...');
    const visibleBrowser = await puppeteer.default.launch({
      executablePath: this.chromePath!,
      headless: false,
      userDataDir: USER_DATA_BASE,
      defaultViewport: { width: 1280, height: 900 },
      args: ['--no-sandbox'],
    });

    try {
      const page = await visibleBrowser.newPage();
      await page.goto(CLAUDE_SELECTORS.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      const deadline = Date.now() + AUTH_TIMEOUT_MS;
      let loggedIn = false;

      while (Date.now() < deadline) {
        try {
          await page.waitForSelector(CLAUDE_SELECTORS.loggedInIndicator, { timeout: 3_000 });
          loggedIn = true;
          break;
        } catch {
          // Not logged in yet — keep polling
        }
      }

      if (loggedIn) {
        await this.persistCookies(page);
        // Inject into the headless browser so it's immediately usable
        const session = this.loadActiveSession();
        if (session) await this.injectCookies(session.cookies);
      }

      return loggedIn;
    } finally {
      await visibleBrowser.close();
    }
  }

  /** Returns true if the current session cookies grant access to claude.ai. */
  async isSessionValid(): Promise<boolean> {
    if (!this.browser) return false;

    let page: Page | null = null;
    try {
      page = await this.browser.newPage();
      await page.goto(CLAUDE_SELECTORS.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      const loggedIn = await page
        .$(CLAUDE_SELECTORS.loggedInIndicator)
        .then((el) => el !== null)
        .catch(() => false);

      if (!loggedIn) this.markSessionExpired();
      return loggedIn;
    } catch {
      return false;
    } finally {
      await page?.close().catch(() => null);
    }
  }

  // ── Message streaming ───────────────────────────────────────────────────

  /**
   * Send a message and yield response chunks as they stream in the DOM.
   * Throws on any failure — the caller (fallback.ts) routes to API instead.
   * Session cookies are refreshed after each successful message.
   */
  async *sendMessage(text: string): AsyncGenerator<string> {
    if (!this.browser) await this.initialize();
    if (!this.browser) throw new Error('browser_not_initialized');

    let page: Page | null = null;
    try {
      page = await this.browser.newPage();

      // Navigate to Claude and verify still logged in
      await page.goto(CLAUDE_SELECTORS.baseUrl, { waitUntil: 'networkidle2', timeout: 20_000 });

      const loggedIn = await page
        .$(CLAUDE_SELECTORS.loggedInIndicator)
        .then((el) => el !== null)
        .catch(() => false);

      if (!loggedIn) {
        this.markSessionExpired();
        throw new Error('session_expired');
      }

      // Locate and focus message input
      await page.waitForSelector(CLAUDE_SELECTORS.messageInput, { timeout: 10_000 });
      await page.click(CLAUDE_SELECTORS.messageInput);

      // Clear any existing content then type message
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {
          el.focus();
          // Clear contenteditable
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel2 = window.getSelection();
          sel2?.removeAllRanges();
          sel2?.addRange(range);
        }
      }, CLAUDE_SELECTORS.messageInput);

      await page.keyboard.down('ControlLeft');
      await page.keyboard.press('a');
      await page.keyboard.up('ControlLeft');
      await page.keyboard.press('Delete');
      await page.type(CLAUDE_SELECTORS.messageInput, text, { delay: 15 });

      // Check for rate limit or error before sending
      const hasRateLimit = await page.$(CLAUDE_SELECTORS.rateLimitBanner).then((e) => e !== null).catch(() => false);
      if (hasRateLimit) throw new Error('rate_limited');

      // Click send
      await page.waitForSelector(CLAUDE_SELECTORS.sendButton, { timeout: 5_000 });
      await page.click(CLAUDE_SELECTORS.sendButton);

      // Wait briefly for streaming to begin
      await page.waitForFunction(
        (sel: string) => document.querySelector(sel) !== null,
        { timeout: 15_000 },
        CLAUDE_SELECTORS.streamingIndicator
      ).catch(() => {
        // Streaming indicator may not appear — continue polling anyway
      });

      // Poll DOM for response chunks
      let lastContent = '';
      let stableTicks = 0;
      const deadline = Date.now() + SEND_TIMEOUT_MS;

      while (Date.now() < deadline) {
        await new Promise<void>((r) => setTimeout(r, STREAM_POLL_INTERVAL_MS));

        // Error checks
        if (await page.$(CLAUDE_SELECTORS.rateLimitBanner).then((e) => e !== null).catch(() => false)) {
          throw new Error('rate_limited');
        }
        if (await page.$(CLAUDE_SELECTORS.errorBanner).then((e) => e !== null).catch(() => false)) {
          throw new Error('claude_error');
        }

        // Read current assistant message content
        const currentContent = await page.evaluate((sel: string): string => {
          const nodes = document.querySelectorAll(sel);
          const last = nodes[nodes.length - 1];
          return last?.textContent ?? '';
        }, CLAUDE_SELECTORS.assistantMessage).catch(() => '');

        if (currentContent && currentContent !== lastContent) {
          const delta = currentContent.slice(lastContent.length);
          if (delta) yield delta;
          lastContent = currentContent;
          stableTicks = 0;
        } else {
          stableTicks++;
        }

        // Detect end of stream: content stable + streaming indicator gone
        const isStreaming = await page
          .$(CLAUDE_SELECTORS.streamingIndicator)
          .then((e) => e !== null)
          .catch(() => false);

        if (!isStreaming && stableTicks >= STREAM_STABLE_TICKS) {
          break;
        }
      }

      // Refresh persisted cookies after successful exchange
      await this.persistCookies(page);
    } finally {
      await page?.close().catch(() => null);
    }
  }

  /** Gracefully shut down the browser instance. */
  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => null);
      this.browser = null;
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

let _engine: WebBrowserEngine | null = null;

export function getBrowserEngine(): WebBrowserEngine {
  if (!_engine) _engine = new WebBrowserEngine();
  return _engine;
}

/** Reset singleton — for testing only. */
export function _resetBrowserEngineForTest(): void {
  _engine = null;
}
