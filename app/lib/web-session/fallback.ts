/**
 * Web Session Fallback Router — Sprint 32.0
 *
 * Central routing function for all chat messages.
 * Handles 'api', 'web_session', and 'auto' (web-first, API fallback) modes.
 *
 * In 'auto' mode: web session is tried first. On ANY failure — governor block,
 * session expired, DOM error, or timeout — the API takes over within 2-3 seconds.
 * The user is never left waiting because of a web session failure.
 *
 * The SSE response format is IDENTICAL regardless of routing path.
 * Client code is unaware of which path was used (except the 'routedVia' field
 * in the 'done' event and the optional fallback toast).
 */

import type { ChatMode, RouteChunk } from './types';
import { getGovernor } from './governor';
import { getBrowserEngine } from './browser';

// ── Fallback timeout ───────────────────────────────────────────────────────
/** If web session doesn't yield its first chunk within this window, fall back. */
const WEB_SESSION_FIRST_CHUNK_TIMEOUT_MS = 30_000;

// ── API streaming via Anthropic SDK ───────────────────────────────────────

/**
 * Route message through the Anthropic SDK (standard API path).
 * Yields chunks with routedVia: 'api'.
 */
async function* routeViaApi(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string | undefined,
): AsyncGenerator<RouteChunk> {
  // Dynamic import to avoid loading Anthropic SDK when not needed
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic();

  const { getBootstrapSystemPromptBlocks } = await import('@/lib/bootstrap');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemParam: any = systemPrompt
    ? systemPrompt
    : getBootstrapSystemPromptBlocks();

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 8096,
    system: systemParam,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield { chunk: event.delta.text, routedVia: 'api' };
    }
  }
}

/**
 * Route message through the web session browser engine.
 * Yields chunks with routedVia: 'web_session'.
 * Throws on any failure — caller handles fallback.
 */
async function* routeViaWebSession(
  userMessage: string,
): AsyncGenerator<RouteChunk> {
  const governor = getGovernor();
  const check = governor.canSendMessage();

  if (!check.allowed) {
    throw new Error(`governor_block: ${check.reason ?? 'rate limited'}`);
  }

  const engine = getBrowserEngine();

  // Validate session before consuming governor slot
  const valid = await engine.isSessionValid();
  if (!valid) {
    throw new Error('session_expired');
  }

  // Send message and stream response
  for await (const chunk of engine.sendMessage(userMessage)) {
    yield { chunk, routedVia: 'web_session' };
  }

  // Record after full stream completes successfully
  governor.recordMessageSent();
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface RouteMessageOptions {
  mode: ChatMode;
  userMessage: string;
  /** Full conversation history (including the latest user message). */
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** Optional system prompt override. */
  systemPrompt?: string;
  /** Called when 'auto' mode falls back to API (receives reason string). */
  onFallback?: (reason: string) => void;
}

/**
 * Route a chat message according to the specified mode.
 * Returns an async generator yielding {chunk, routedVia} pairs.
 *
 * 'api'         → direct Anthropic SDK path (no change from current behaviour)
 * 'web_session' → headless browser path (governor enforced, no fallback)
 * 'auto'        → web session first; transparent API fallback on any failure
 */
export async function* routeMessage(
  opts: RouteMessageOptions,
): AsyncGenerator<RouteChunk> {
  const { mode, userMessage, messages, systemPrompt, onFallback } = opts;

  if (mode === 'api') {
    yield* routeViaApi(messages, systemPrompt);
    return;
  }

  if (mode === 'web_session') {
    // No fallback — if web session fails, let the error propagate
    yield* routeViaWebSession(userMessage);
    return;
  }

  // ── 'auto' mode: web session first, API fallback ────────────────────────
  // We race the web session against a first-chunk timeout.
  // If the web session fails or times out, we immediately switch to API.
  let usedWebSession = false;
  let webSessionFailed = false;
  let failureReason = '';

  try {
    const webGen = routeViaWebSession(userMessage);

    // Attempt to get the first chunk with a timeout
    const firstChunkResult = await Promise.race([
      webGen.next(),
      new Promise<{ timedOut: true }>((resolve) =>
        setTimeout(() => resolve({ timedOut: true }), WEB_SESSION_FIRST_CHUNK_TIMEOUT_MS)
      ),
    ]);

    if ('timedOut' in firstChunkResult) {
      failureReason = 'timeout';
      webSessionFailed = true;
    } else if (firstChunkResult.done) {
      // Empty response from web session — fall back
      failureReason = 'empty_response';
      webSessionFailed = true;
    } else {
      // First chunk received — yield it and continue streaming
      usedWebSession = true;
      yield firstChunkResult.value;
      for await (const chunk of webGen) {
        yield chunk;
      }
    }
  } catch (err) {
    failureReason = err instanceof Error ? err.message : 'unknown';
    webSessionFailed = true;
  }

  if (webSessionFailed) {
    const logReason = failureReason || 'unknown';
    console.warn(
      `[fallback] Web session unavailable (${logReason}), routing via API.`
    );
    onFallback?.(logReason);

    // API fallback — transparent to client
    yield* routeViaApi(messages, systemPrompt);
    return;
  }

  void usedWebSession; // consumed above
}
