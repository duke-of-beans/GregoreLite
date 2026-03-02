/**
 * Ghost Thread — Settings API
 *
 * GET  /api/ghost/settings?key=<key>   → { value: T | null }
 * POST /api/ghost/settings             → { key, value } body → 204
 *
 * Used by watcher-bridge.ts to load/save ghost_watch_paths from KERNL.
 * Server-side only: accesses better-sqlite3 directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSettingJson, setSettingJson } from '@/lib/kernl/settings-store';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key required' }, { status: 400 });
  }
  const value = getSettingJson(key);
  return NextResponse.json({ value });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('key' in body) ||
    !('value' in body) ||
    typeof (body as Record<string, unknown>).key !== 'string'
  ) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  }

  const { key, value } = body as { key: string; value: unknown };
  setSettingJson(key, value);
  return new NextResponse(null, { status: 204 });
}
