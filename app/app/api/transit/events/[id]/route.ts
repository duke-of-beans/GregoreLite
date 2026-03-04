/**
 * PATCH /api/transit/events/[id]
 *
 * Append a user annotation to the annotations JSON array on a
 * conversation_events row. Accepts either:
 *   { addAnnotation: string }  — appends a single note (preferred)
 *   { annotations: string[] }  — replaces the full array (bulk update)
 *
 * Sprint 11.4 — Z3 user annotation support (Task 6)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface PatchBody {
  addAnnotation?: string;
  annotations?: string[];
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const db = getDatabase();

    // Fetch existing row
    const row = db.prepare(
      'SELECT annotations FROM conversation_events WHERE id = ?',
    ).get(id) as { annotations: string } | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    let current: string[] = [];
    try {
      const parsed = JSON.parse(row.annotations) as unknown;
      current = Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      current = [];
    }

    let updated: string[];
    if (body.addAnnotation !== undefined) {
      const note = body.addAnnotation.trim();
      if (!note) {
        return NextResponse.json({ error: 'Annotation cannot be empty' }, { status: 400 });
      }
      updated = [...current, note];
    } else if (Array.isArray(body.annotations)) {
      updated = body.annotations;
    } else {
      return NextResponse.json(
        { error: 'Provide addAnnotation or annotations' },
        { status: 400 },
      );
    }

    db.prepare(
      'UPDATE conversation_events SET annotations = ? WHERE id = ?',
    ).run(JSON.stringify(updated), id);

    return NextResponse.json({ ok: true, annotations: updated });
  } catch (err) {
    console.warn('[transit/events/[id]] PATCH failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
