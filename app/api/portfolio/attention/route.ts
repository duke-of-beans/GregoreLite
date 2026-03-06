/**
 * GET /api/portfolio/attention
 *
 * Returns a prioritized attention queue for all active projects.
 * Runs analyzeAttention() server-side against current portfolio data.
 *
 * Response: { success: true, data: { items: AttentionItem[] } }
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { analyzeAttention } from '@/lib/portfolio/analyzer';
import type { ProjectCard, PortfolioProject, PortfolioScanData } from '@/lib/portfolio/types';

function rowToCard(row: PortfolioProject): ProjectCard | null {
  if (!row.scan_data) return null;
  let sd: PortfolioScanData;
  try {
    sd = JSON.parse(row.scan_data) as PortfolioScanData;
  } catch {
    return null;
  }
  const card: ProjectCard = {
    id:                  row.id,
    name:                row.name,
    path:                row.path,
    type:                row.type,
    typeLabel:           row.type_label ?? row.type,
    status:              row.status,
    version:             sd.version,
    phase:               sd.phase,
    lastActivity:        sd.lastCommit ?? null,
    health:              sd.health,
    healthReason:        sd.healthReason,
    nextAction:          sd.nextAction,
    customMetrics:       sd.customMetrics ?? {},
    attentionMutedUntil: row.attention_muted_until ?? null,
  };
  // exactOptionalPropertyTypes: only set numeric optionals when non-null
  if (sd.testCount  != null) card.testCount  = sd.testCount;
  if (sd.testPassing != null) card.testPassing = sd.testPassing;
  if (sd.tscErrors  != null) card.tscErrors  = sd.tscErrors;
  return card;
}

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDatabase();
    const rows = db.prepare(
      `SELECT id, name, path, type, type_label, status, registered_at,
              last_scanned_at, scan_data, attention_muted_until
       FROM portfolio_projects WHERE status != 'archived'`
    ).all() as PortfolioProject[];

    const cards = rows.map(rowToCard).filter((c): c is ProjectCard => c !== null);
    const items = analyzeAttention(cards);

    return NextResponse.json({ success: true, data: { items } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
