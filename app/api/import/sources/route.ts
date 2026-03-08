import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';

export const runtime = 'nodejs';

export interface ImportSourceRow {
  id: string;
  source_type: string;
  source_path: string | null;
  display_name: string;
  conversation_count: number;
  chunk_count: number;
  last_synced_at: number | null;
  created_at: number;
  meta: string | null;
}

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT id, source_type, source_path, display_name,
                conversation_count, chunk_count, last_synced_at, created_at, meta
         FROM imported_sources
         ORDER BY created_at DESC`
      )
      .all() as ImportSourceRow[];
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[import/sources] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
