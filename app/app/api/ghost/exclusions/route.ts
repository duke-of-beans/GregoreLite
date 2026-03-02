/**
 * Ghost Privacy — Exclusion Rules API (Layer 4)
 * Sprint 6G
 *
 * GET    /api/ghost/exclusions          — list all user exclusion rules
 * POST   /api/ghost/exclusions          — add a new rule { type, pattern, note? }
 * DELETE /api/ghost/exclusions?id=<id>  — remove a rule by id
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserExclusions,
  addExclusion,
  removeExclusion,
} from '@/lib/ghost/privacy';
import type { ExclusionType } from '@/lib/ghost/privacy';

const VALID_TYPES = new Set<ExclusionType>([
  'path_glob',
  'domain',
  'sender',
  'keyword',
  'subject_contains',
]);

export function GET(): NextResponse {
  const rules = getUserExclusions();
  return NextResponse.json({ rules });
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
    !('type' in body) ||
    !('pattern' in body)
  ) {
    return NextResponse.json({ error: 'type and pattern required' }, { status: 400 });
  }

  const { type, pattern, note } = body as Record<string, unknown>;

  if (typeof type !== 'string' || !VALID_TYPES.has(type as ExclusionType)) {
    return NextResponse.json(
      { error: `type must be one of: ${[...VALID_TYPES].join(', ')}` },
      { status: 400 }
    );
  }
  if (typeof pattern !== 'string' || !pattern.trim()) {
    return NextResponse.json({ error: 'pattern must be a non-empty string' }, { status: 400 });
  }

  addExclusion(
    type as ExclusionType,
    pattern.trim(),
    typeof note === 'string' ? note : undefined
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  removeExclusion(id);
  return new NextResponse(null, { status: 204 });
}
