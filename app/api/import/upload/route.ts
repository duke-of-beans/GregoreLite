import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDatabase } from '@/lib/kernl/database';
import { extractConversationsJson } from '@/lib/import/zip-handler';
import { detectFormat, runAdapter } from '@/lib/import/adapters';
import { runImport } from '@/lib/import/pipeline';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const filename = (file as File).name ?? 'upload';
    const buffer = Buffer.from(await (file as File).arrayBuffer());

    // Extract JSON content (handles ZIP or raw JSON)
    let content: unknown;
    try {
      content = await extractConversationsJson(buffer);
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to parse file: ${(err as Error).message}` },
        { status: 422 }
      );
    }

    // Detect format and run adapter
    const format = detectFormat(filename, content);
    const conversations = runAdapter(format, content);

    if (conversations.length === 0) {
      return NextResponse.json(
        { error: 'No conversations found in file' },
        { status: 422 }
      );
    }

    // Create imported_sources row
    const sourceId = randomUUID();
    const now = Date.now();
    const db = getDatabase();

    db.prepare(
      `INSERT INTO imported_sources (id, source_type, source_path, display_name,
        conversation_count, chunk_count, last_synced_at, created_at, meta)
       VALUES (?, 'file', ?, ?, ?, 0, NULL, ?, NULL)`
    ).run(sourceId, filename, filename, conversations.length, now);

    // Fire-and-forget import pipeline
    void runImport(sourceId, conversations, db).catch((err: Error) => {
      console.error('[import/upload] pipeline error:', err.message);
    });

    return NextResponse.json({ sourceId, conversationCount: conversations.length });
  } catch (err) {
    console.error('[import/upload] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
