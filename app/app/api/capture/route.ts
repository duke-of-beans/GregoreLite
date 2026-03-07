/**
 * POST /api/capture
 *
 * Sprint 29.0 — Quick Capture Pad
 * Accepts { text: string }, parses prefix, classifies, deduplicates, stores.
 * Returns { note: CaptureNote, wasDuplicate: boolean, mergedWith?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { parseCaptureInput } from '@/lib/capture/parser';
import { classifyNote } from '@/lib/capture/parser';
import { findDuplicate, mergeIntoPrimary } from '@/lib/capture/dedup';
import type { CaptureNote, CaptureCreateResult } from '@/lib/capture/types';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const db = getDatabase();

    // Fetch registered project names for prefix matching
    const projects = db
      .prepare(`SELECT id, name FROM portfolio_projects WHERE status != 'archived'`)
      .all() as { id: string; name: string }[];

    const projectNames = projects.map((p) => p.name);
    const projectMap = new Map(projects.map((p) => [p.name, p.id]));

    // Parse prefix
    const { projectName, body: parsedBody } = parseCaptureInput(text, projectNames);
    const projectId = projectName ? (projectMap.get(projectName) ?? null) : null;

    // Classify
    const classification = classifyNote(parsedBody);

    // Dedup (runs AFTER parsing — never blocks input)
    const dedupResult = await findDuplicate(parsedBody, projectId);

    const now = Date.now();
    const noteId = randomUUID();

    if (dedupResult.isDuplicate && dedupResult.existingNote) {
      // Merge into existing note
      const primary = mergeIntoPrimary(dedupResult.existingNote.id, noteId);

      // Store the merged note
      db.prepare(`
        INSERT INTO capture_notes
          (id, project_id, raw_text, parsed_project, parsed_body, classification,
           mention_count, merged_with, status, created_at, last_mentioned_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'inbox', ?, ?)
      `).run(noteId, projectId, text, projectName, parsedBody, classification,
             dedupResult.existingNote.id, now, now);

      const result: CaptureCreateResult = {
        note: primary ?? dedupResult.existingNote,
        wasDuplicate: true,
        mergedWith: dedupResult.existingNote.id,
      };
      return NextResponse.json(result);
    }

    // New note
    db.prepare(`
      INSERT INTO capture_notes
        (id, project_id, raw_text, parsed_project, parsed_body, classification,
         mention_count, merged_with, status, created_at, last_mentioned_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, NULL, 'inbox', ?, ?)
    `).run(noteId, projectId, text, projectName, parsedBody, classification, now, now);

    const note = db
      .prepare(`SELECT * FROM capture_notes WHERE id = ?`)
      .get(noteId) as CaptureNote;

    const result: CaptureCreateResult = { note, wasDuplicate: false };
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
