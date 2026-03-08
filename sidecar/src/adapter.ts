/**
 * Request/Response adapter — Sprint 36.0
 *
 * Converts between Express req/res and the Web API Request/Response objects
 * that GregLite's Next.js route handlers expect.
 *
 * Key rules:
 * - params use Promise.resolve() so both sync and async `await context.params`
 *   patterns work (Next.js 15+ uses Promise-based params)
 * - SSE streams are detected via Content-Type and piped chunk-by-chunk
 * - fromResponse drains the body buffer for regular responses
 */

import type { Request as ExpressReq, Response as ExpressRes } from 'express';

/**
 * Convert an Express request into a standard Web API Request.
 * Body is read from req.body (already parsed by express.json middleware).
 */
export function toRequest(req: ExpressReq): Request {
  const protocol = 'http';
  const host = req.headers.host ?? 'localhost:3717';
  const url = `${protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  const init: RequestInit = { method, headers };

  if (hasBody && req.body !== undefined && req.body !== null) {
    const ct = (req.headers['content-type'] ?? '').toLowerCase();
    if (ct.includes('application/json')) {
      init.body = JSON.stringify(req.body);
    } else if (typeof req.body === 'string') {
      init.body = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      init.body = req.body as unknown as BodyInit;
    }
    // multipart/form-data is rare in GregLite routes; left as undefined
  }

  return new Request(url, init);
}

/**
 * Build the Next.js App Router context object for dynamic-param routes.
 * params is a Promise so it works with both `await context.params` and
 * the legacy direct-access pattern.
 */
export function makeContext<P extends Record<string, string>>(
  params: P,
): { params: Promise<P> } {
  return { params: Promise.resolve(params) };
}

/**
 * Pipe a Web API Response back through an Express response.
 * Handles both standard JSON/text responses and SSE event streams.
 */
export async function fromResponse(webRes: Response, res: ExpressRes): Promise<void> {
  res.status(webRes.status);

  // Forward headers, skipping hop-by-hop headers Express manages itself
  const skipHeaders = new Set([
    'content-encoding',
    'transfer-encoding',
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'upgrade',
  ]);

  webRes.headers.forEach((value, key) => {
    if (!skipHeaders.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const contentType = webRes.headers.get('content-type') ?? '';

  // SSE streaming path — pipe chunks as they arrive
  if (contentType.includes('text/event-stream')) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!webRes.body) {
      res.end();
      return;
    }

    const reader = webRes.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
        // res.flush() is available when compression middleware is present
        const flushable = res as ExpressRes & { flush?: () => void };
        if (typeof flushable.flush === 'function') flushable.flush();
      }
    } catch (err) {
      console.error('[adapter] SSE stream read error:', err);
    } finally {
      res.end();
    }
    return;
  }

  // Regular response — buffer and send
  if (!webRes.body) {
    res.end();
    return;
  }

  try {
    const buffer = await webRes.arrayBuffer();
    res.end(Buffer.from(buffer));
  } catch (err) {
    console.error('[adapter] response body read error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Response read failed' });
  }
}
