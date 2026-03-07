/**
 * Claude Web Interface Selectors — Sprint 32.0
 *
 * All CSS selectors for the Claude web interface in one place.
 * These selectors target claude.ai DOM elements.
 * Update this file when Anthropic changes their web interface — no other code changes needed.
 *
 * SELECTORS_VERSION: 1.0.0
 * Last verified: 2026-03-07
 *
 * Maintenance: When selectors break after an Anthropic UI update, inspect the new DOM
 * in Chrome DevTools and update the values below. Increment SELECTORS_VERSION and
 * update SELECTORS_LAST_VERIFIED. No other files need to change.
 */

export const SELECTORS_VERSION = '1.0.0';
export const SELECTORS_LAST_VERIFIED = '2026-03-07';

export const CLAUDE_SELECTORS = {
  // ── Login detection ──────────────────────────────────────────────────────
  /** Present in the DOM when the user is authenticated. */
  loggedInIndicator: '[data-testid="user-menu"], button[aria-label*="profile" i], .user-avatar, [data-testid="sidebar-profile"]',
  /** Present on the login/auth page (not present once logged in). */
  loginPage: 'input[type="email"], [data-testid="email-input"]',

  // ── Chat interaction ─────────────────────────────────────────────────────
  /** The main message input field (contenteditable ProseMirror editor). */
  messageInput: 'div[contenteditable="true"].ProseMirror, [contenteditable="true"][data-placeholder], fieldset [contenteditable="true"]',
  /** The send button (active when input has content). */
  sendButton: 'button[aria-label="Send message"], button[aria-label="Send"], button[type="submit"][aria-label*="send" i]',
  /** Top-level conversation container. */
  conversationContainer: 'main, [data-testid="conversation-content"]',

  // ── Response reading ─────────────────────────────────────────────────────
  /** Container wrapping each assistant message. */
  assistantMessage: '[data-role="assistant"], .font-claude-message, [data-testid="assistant-message"]',
  /** Indicator that Claude is actively streaming a response. */
  streamingIndicator: '[data-is-streaming="true"], button[aria-label="Stop"], [data-testid="streaming-indicator"]',
  /** Text content of the most recent assistant message. */
  lastAssistantMessageContent: '[data-role="assistant"]:last-of-type .whitespace-pre-wrap, [data-testid="assistant-message"]:last-child',

  // ── Rate limit / error detection ─────────────────────────────────────────
  /** Shown when the user hits a rate limit. */
  rateLimitBanner: '[class*="rate-limit"], [data-testid="rate-limit-error"]',
  /** General error message banner. */
  errorBanner: '[class*="error-message"]:not(button), [role="alert"][class*="error"]',
  /** Usage limit modal (daily/monthly cap reached). */
  usageLimitModal: '[data-testid="usage-limit-modal"], [class*="usage-limit"]',

  // ── Navigation ────────────────────────────────────────────────────────────
  /** Button/link to start a new chat. */
  newChatButton: 'button[aria-label*="new chat" i], a[href="/"], [data-testid="new-chat-button"]',
  /** Base URL for all navigation. */
  baseUrl: 'https://claude.ai',
} as const;

export type ClaudeSelectorKey = keyof typeof CLAUDE_SELECTORS;
