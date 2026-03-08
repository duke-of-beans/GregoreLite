/**
 * Minimal next/server shim for the GregLite sidecar.
 *
 * Provides NextResponse and NextRequest with enough surface area
 * to satisfy all GregLite API route handlers without pulling in
 * the full Next.js runtime (~40MB).
 *
 * Only the methods actually used by the routes are implemented.
 */

export class NextResponse extends Response {
  static json(data: unknown, init?: ResponseInit): NextResponse {
    const body = JSON.stringify(data);
    const headers = new Headers(init?.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return new NextResponse(body, { ...init, headers });
  }

  static redirect(url: string | URL, status: number = 307): NextResponse {
    return new NextResponse(null, {
      status,
      headers: { Location: String(url) },
    });
  }

  static next(): NextResponse {
    return new NextResponse(null, { status: 200 });
  }

  static rewrite(url: string | URL): NextResponse {
    return new NextResponse(null, {
      status: 200,
      headers: { 'x-middleware-rewrite': String(url) },
    });
  }
}

export class NextRequest extends Request {
  public readonly nextUrl: URL;

  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input as RequestInfo, init);
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    this.nextUrl = new URL(rawUrl);
  }

  get cookies() {
    // Minimal stub — routes that need cookies should handle them via headers
    return {
      get: (_name: string) => undefined,
      getAll: () => [],
      has: (_name: string) => false,
    };
  }
}
