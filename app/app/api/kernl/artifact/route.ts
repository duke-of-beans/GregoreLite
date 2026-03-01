/**
 * POST /api/kernl/artifact
 *
 * Writes a detected artifact to the KERNL artifacts table.
 * Called by kernl-sync.ts after every artifact detection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

interface ArtifactBody {
  id: string;
  threadId: string;
  type: string;
  language: string;
  content: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as ArtifactBody;

    if (!body.id || !body.threadId || !body.type || !body.content) {
      return NextResponse.json(
        { error: 'Missing required fields: id, threadId, type, content' },
        { status: 400 },
      );
    }

    const db = getDatabase();

    // Upsert — safe to call multiple times with same id
    db.prepare(
      `INSERT OR REPLACE INTO artifacts
         (id, thread_id, type, title, content, language, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      body.id,
      body.threadId,
      body.type,
      body.language || body.type,         // title = language tag or type name
      body.content,
      body.language || 'text',
      Date.now(),
    );

    return NextResponse.json({ ok: true, id: body.id }, { status: 201 });
  } catch (err) {
    console.error('[api/kernl/artifact] write failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
