/**
 * Decision Export API — Sprint S9-16
 *
 * POST /api/decisions/export — Exports filtered decisions as markdown, writes to artifacts table
 * Body: { ids?: string[], project?: string, category?: string, impact?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { randomUUID } from 'crypto';

interface DecisionRow {
  id: string;
  category: string;
  title: string;
  rationale: string;
  alternatives: string | null;
  impact: string | null;
  created_at: number;
}

export async function POST(req: NextRequest) {
  try {
    const db = getDatabase();
    const body = await req.json() as { ids?: string[]; project?: string; category?: string; impact?: string };

    let rows: DecisionRow[];
    if (body.ids && body.ids.length > 0) {
      const placeholders = body.ids.map(() => '?').join(', ');
      rows = db.prepare(`SELECT * FROM decisions WHERE id IN (${placeholders}) ORDER BY created_at DESC`).all(...body.ids) as DecisionRow[];
    } else {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (body.category) { conditions.push('d.category = ?'); params.push(body.category); }
      if (body.impact) { conditions.push('d.impact = ?'); params.push(body.impact); }
      if (body.project) {
        conditions.push('t.project_id = ?');
        params.push(body.project);
      }
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      rows = db.prepare(`SELECT d.* FROM decisions d LEFT JOIN threads t ON d.thread_id = t.id ${where} ORDER BY d.created_at DESC`).all(...params) as DecisionRow[];
    }

    // Generate markdown
    const lines: string[] = ['# Decision Export', '', `Generated: ${new Date().toISOString()}`, `Total: ${rows.length} decisions`, ''];
    for (const row of rows) {
      const alts: string[] = row.alternatives ? JSON.parse(row.alternatives) : [];
      const date = new Date(row.created_at).toLocaleDateString();
      lines.push(`## ${row.title}`);
      lines.push('');
      lines.push(`**Category:** ${row.category} | **Impact:** ${row.impact ?? 'unset'} | **Date:** ${date}`);
      lines.push('');
      lines.push(`**Rationale:** ${row.rationale}`);
      if (alts.length > 0) {
        lines.push('');
        lines.push('**Alternatives considered:**');
        for (const alt of alts) {
          lines.push(`- ${alt}`);
        }
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    const markdown = lines.join('\n');

    // Write to artifacts table
    const artifactId = randomUUID();
    db.prepare(`
      INSERT INTO artifacts (id, thread_id, type, title, content, language, created_at)
      VALUES (?, NULL, 'markdown', ?, ?, 'markdown', ?)
    `).run(artifactId, `Decision Export (${rows.length} decisions)`, markdown, Date.now());

    return NextResponse.json({
      data: {
        artifactId,
        markdown,
        count: rows.length,
      },
    });
  } catch (err) {
    console.error('[decisions/export] POST failed:', err);
    return NextResponse.json({ error: 'Failed to export decisions' }, { status: 500 });
  }
}
