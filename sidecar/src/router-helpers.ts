/**
 * Router helper utilities — Sprint 36.0
 *
 * Provides mountRouteModule() — the single entry point for wiring a Next.js
 * App Router route module onto an Express Router path.
 *
 * Usage:
 *   mountRouteModule(router, '/', require('../../../app/app/api/bootstrap/route'));
 *   mountRouteModule(router, '/:id', require('...threads/[id]/route'), ['id']);
 *   mountRouteModule(router, '/:id/sub', require('...route'), ['id']); // extra segments already in path
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { toRequest, fromResponse, makeContext } from './adapter';

// All HTTP methods supported by Next.js App Router
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

// Loose type for imported route modules (they export named method functions)
type RouteModule = Record<string, unknown>;

/**
 * Wrap a single Next.js route handler as an Express RequestHandler.
 *
 * @param handler  - The exported GET/POST/etc function from a route module
 * @param paramKeys - Express param names to forward as Next.js route context params
 */
function wrap(
  handler: (req: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>,
  paramKeys: string[] = [],
): RequestHandler {
  return async (expressReq, res) => {
    try {
      const webReq = toRequest(expressReq);

      let ctx: { params: Promise<Record<string, string>> } | undefined;
      if (paramKeys.length > 0) {
        const params: Record<string, string> = {};
        for (const key of paramKeys) {
          params[key] = expressReq.params[key] ?? '';
        }
        ctx = makeContext(params);
      }

      const result = ctx ? await handler(webReq, ctx) : await handler(webReq);
      await fromResponse(result, res);
    } catch (err) {
      console.error('[sidecar] route handler error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

/**
 * Mount all exported HTTP method handlers from a Next.js route module
 * onto an Express Router at the given path.
 *
 * Only mounts methods that actually exist on the module (safe to call
 * without knowing exact exports — missing methods silently skip).
 */
export function mountRouteModule(
  router: Router,
  expressPath: string,
  module: RouteModule,
  paramKeys: string[] = [],
): void {
  for (const method of HTTP_METHODS) {
    if (typeof module[method] === 'function') {
      const handler = module[method] as (
        req: Request,
        ctx?: { params: Promise<Record<string, string>> },
      ) => Promise<Response>;
      router[method.toLowerCase() as Lowercase<HttpMethod>](
        expressPath,
        wrap(handler, paramKeys),
      );
    }
  }
}
