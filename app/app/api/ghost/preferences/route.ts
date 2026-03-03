/**
 * Ghost Preferences API — Sprint 9-06
 *
 * GET    /api/ghost/preferences          — list all preferences
 * POST   /api/ghost/preferences          — create a new preference
 * DELETE /api/ghost/preferences?id=xxx   — delete a preference
 * PATCH  /api/ghost/preferences          — update boost_factor
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllPreferences,
  createPreference,
  deletePreference,
  updateBoostFactor,
} from '@/lib/ghost/preferences-store';

export async function GET(): Promise<NextResponse> {
  try {
    const preferences = getAllPreferences();
    return NextResponse.json({ preferences });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      source_type?: string | null;
      topic_hint?: string;
      boost_factor?: number;
    };

    if (!body.topic_hint || typeof body.topic_hint !== 'string' || body.topic_hint.trim().length === 0) {
      return NextResponse.json({ error: 'topic_hint is required' }, { status: 400 });
    }

    const preference = createPreference({
      source_type: body.source_type ?? null,
      topic_hint: body.topic_hint.trim(),
      ...(typeof body.boost_factor === 'number' ? { boost_factor: body.boost_factor } : {}),
    });

    return NextResponse.json({ preference }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    deletePreference(id);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      id?: string;
      boost_factor?: number;
    };

    if (!body.id || typeof body.boost_factor !== 'number') {
      return NextResponse.json({ error: 'id and boost_factor are required' }, { status: 400 });
    }

    updateBoostFactor(body.id, body.boost_factor);
    return NextResponse.json({ updated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
