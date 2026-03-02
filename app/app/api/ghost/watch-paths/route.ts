/**
 * Ghost Privacy — Watch Paths API
 * Sprint 6G
 *
 * GET    /api/ghost/watch-paths          — list current watch paths
 * POST   /api/ghost/watch-paths          — add a path { path: string }
 * DELETE /api/ghost/watch-paths?path=... — remove a path
 *
 * Paths are stored in KERNL settings under key 'ghost_watch_paths' as a JSON string[].
 * Changes take effect on Ghost restart — the brief notes watch paths are loaded at startup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSettingJson, setSettingJson } from '@/lib/kernl/settings-store';

const SETTING_KEY = 'ghost_watch_paths';

function loadPaths(): string[] {
  const val = getSettingJson<string[]>(SETTING_KEY);
  return Array.isArray(val) ? val : [];
}

function savePaths(paths: string[]): void {
  setSettingJson(SETTING_KEY, paths);
}

export function GET(): NextResponse {
  return NextResponse.json({ paths: loadPaths() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const newPath =
    typeof body === 'object' && body !== null && 'path' in body
      ? (body as Record<string, unknown>).path
      : undefined;

  if (typeof newPath !== 'string' || !newPath.trim()) {
    return NextResponse.json({ error: 'path required' }, { status: 400 });
  }

  const paths = loadPaths();
  const trimmed = newPath.trim();

  if (!paths.includes(trimmed)) {
    paths.push(trimmed);
    savePaths(paths);
  }

  return NextResponse.json({ paths }, { status: 201 });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const pathToRemove = req.nextUrl.searchParams.get('path');
  if (!pathToRemove) {
    return NextResponse.json({ error: 'path query param required' }, { status: 400 });
  }

  const paths = loadPaths().filter((p) => p !== pathToRemove);
  savePaths(paths);

  return NextResponse.json({ paths });
}
