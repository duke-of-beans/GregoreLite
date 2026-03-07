/**
 * Tests for lib/web-session/fallback.ts — Sprint 32.0
 *
 * Coverage:
 *   - mode 'api' always routes through Anthropic SDK, never touches browser engine
 *   - mode 'web_session' routes through browser engine and tags chunks correctly
 *   - mode 'web_session' when governor blocks → throws
 *   - mode 'web_session' when session is invalid → throws
 *   - mode 'auto' uses web session when it succeeds
 *   - mode 'auto' falls back to API on web failure, calling onFallback with reason
 *
 * Notes on mock shapes:
 *   - routeViaApi iterates stream with `for await` looking for content_block_delta events
 *   - routeViaWebSession iterates engine.sendMessage() which yields plain strings
 *   - @/lib/bootstrap is mocked to avoid loading system prompt files
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockCanSend,
  mockGetGovernor,
  mockIsSessionValid,
  mockGetBrowserEngine,
  mockStream,
} = vi.hoisted(() => {
  const mockCanSend = vi.fn().mockReturnValue({ allowed: true, waitMs: 0 });
  const mockGetGovernor = vi.fn().mockReturnValue({
    canSendMessage: mockCanSend,
    recordMessageSent: vi.fn(),
    getUsageStats: vi.fn().mockReturnValue({ today: 0, thisHour: 0, thisMinute: 0, remainingDaily: 200 }),
  });

  // engine.sendMessage() yields plain strings (not RouteChunk objects)
  async function* fakeWebStream() {
    yield 'Hello';
    yield ' world';
  }

  const mockIsSessionValid   = vi.fn().mockResolvedValue(true);
  const mockGetBrowserEngine = vi.fn().mockReturnValue({
    sendMessage: vi.fn().mockImplementation(fakeWebStream),
    isSessionValid: mockIsSessionValid,
  });

  const mockStream = vi.fn();

  return {
    mockCanSend, mockGetGovernor,
    mockIsSessionValid, mockGetBrowserEngine, mockStream,
  };
});

vi.mock('@/lib/web-session/governor', () => ({
  getGovernor: mockGetGovernor,
  _resetGovernorForTest: vi.fn(),
}));

vi.mock('@/lib/web-session/browser', () => ({
  getBrowserEngine: mockGetBrowserEngine,
}));

// routeViaApi does: for await (event of stream) { if event.type === 'content_block_delta' ... }
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { stream: mockStream };
  },
}));

// routeViaApi dynamic-imports @/lib/bootstrap for system prompt blocks
vi.mock('@/lib/bootstrap', () => ({
  getBootstrapSystemPromptBlocks: () => [{ type: 'text', text: 'sys' }],
}));

import { routeMessage } from '../fallback';

// ── Helpers ───────────────────────────────────────────────────────────────────

type RouteChunk = { chunk: string; routedVia: 'api' | 'web_session' };

async function collectChunks(gen: AsyncGenerator<RouteChunk>): Promise<RouteChunk[]> {
  const chunks: RouteChunk[] = [];
  for await (const c of gen) chunks.push(c);
  return chunks;
}

const BASE_OPTS = {
  userMessage: 'Hello',
  messages: [{ role: 'user' as const, content: 'Hello' }],
};

/** API stream mock: yields one content_block_delta event with the given text. */
function makeApiStreamMock(text = 'API response') {
  return {
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'content_block_delta' as const,
        delta: { type: 'text_delta' as const, text },
      };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanSend.mockReturnValue({ allowed: true, waitMs: 0 });
  mockIsSessionValid.mockResolvedValue(true);
  mockStream.mockReturnValue(makeApiStreamMock());

  // Restore default web stream (plain strings)
  async function* defaultWebStream() { yield 'Hello'; yield ' world'; }
  mockGetBrowserEngine.mockReturnValue({
    sendMessage: vi.fn().mockImplementation(defaultWebStream),
    isSessionValid: mockIsSessionValid,
  });
});

// ── API mode ──────────────────────────────────────────────────────────────────

describe("mode 'api'", () => {
  it('never touches browser engine', async () => {
    await collectChunks(routeMessage({ ...BASE_OPTS, mode: 'api' }));
    expect(mockGetBrowserEngine).not.toHaveBeenCalled();
  });

  it('yields chunks tagged routedVia api', async () => {
    const chunks = await collectChunks(routeMessage({ ...BASE_OPTS, mode: 'api' }));
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((c) => expect(c.routedVia).toBe('api'));
  });

  it('chunk text matches the SDK stream output', async () => {
    mockStream.mockReturnValue(makeApiStreamMock('Hello from API'));
    const chunks = await collectChunks(routeMessage({ ...BASE_OPTS, mode: 'api' }));
    expect(chunks.map((c) => c.chunk).join('')).toBe('Hello from API');
  });
});

// ── Web session mode ──────────────────────────────────────────────────────────

describe("mode 'web_session'", () => {
  it('uses browser engine and tags chunks as web_session', async () => {
    const chunks = await collectChunks(routeMessage({ ...BASE_OPTS, mode: 'web_session' }));

    expect(mockGetBrowserEngine).toHaveBeenCalled();
    expect(chunks.length).toBe(2);
    chunks.forEach((c) => expect(c.routedVia).toBe('web_session'));
    expect(chunks.map((c) => c.chunk).join('')).toBe('Hello world');
  });

  it('throws when governor blocks the message', async () => {
    mockCanSend.mockReturnValue({ allowed: false, waitMs: 5000, reason: 'Per-minute limit (4/min) reached.' });

    await expect(
      collectChunks(routeMessage({ ...BASE_OPTS, mode: 'web_session' }))
    ).rejects.toThrow(/governor_block/);
  });

  it('throws session_expired when session is not valid', async () => {
    mockIsSessionValid.mockResolvedValue(false);

    await expect(
      collectChunks(routeMessage({ ...BASE_OPTS, mode: 'web_session' }))
    ).rejects.toThrow(/session_expired/);
  });
});

// ── Auto mode ─────────────────────────────────────────────────────────────────

describe("mode 'auto'", () => {
  it('uses web session when it succeeds', async () => {
    const chunks = await collectChunks(routeMessage({ ...BASE_OPTS, mode: 'auto' }));
    expect(chunks.some((c) => c.routedVia === 'web_session')).toBe(true);
  });

  it('falls back to API when governor blocks, calls onFallback with reason', async () => {
    mockCanSend.mockReturnValue({ allowed: false, waitMs: 3000, reason: 'Per-minute limit (4/min) reached.' });
    mockStream.mockReturnValue(makeApiStreamMock('fallback text'));

    const onFallback = vi.fn();
    const chunks = await collectChunks(
      routeMessage({ ...BASE_OPTS, mode: 'auto', onFallback })
    );

    expect(onFallback).toHaveBeenCalledOnce();
    expect(typeof onFallback.mock.calls[0]?.[0]).toBe('string');
    chunks.forEach((c) => expect(c.routedVia).toBe('api'));
  });

  it('falls back to API when session is invalid, calls onFallback', async () => {
    mockIsSessionValid.mockResolvedValue(false);
    mockStream.mockReturnValue(makeApiStreamMock('fallback text'));

    const onFallback = vi.fn();
    const chunks = await collectChunks(
      routeMessage({ ...BASE_OPTS, mode: 'auto', onFallback })
    );

    expect(onFallback).toHaveBeenCalledOnce();
    chunks.forEach((c) => expect(c.routedVia).toBe('api'));
  });
});
