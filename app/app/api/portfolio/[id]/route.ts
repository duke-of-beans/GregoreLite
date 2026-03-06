/**
 * Portfolio API — Single Project
 * Sprint 24.0
 *
 * GET /api/portfolio/[id] — returns one project with full scan_data
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/kernl/database';
import { scanSingleProject } from '@/lib/portfolio/scanner';
import type { PortfolioProject, PortfolioScanData } from '@/lib/portfolio/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const db = getDatabase();

  const row = db.prepare(`
    SELECT id, name, path, type, type_label, status, registered_at, last_scanned_at, scan_data
    FROM portfolio_projects WHERE id = ?
  `).get(id) as PortfolioProject | undefined;

  if (!row) {
    return NextResponse.json({ success: false, error: 'Project not found', timestamp: new Date().toISOString() }, { status: 404 });
  }

  const scanData: PortfolioScanData | null = row.scan_data
    ? (JSON.parse(row.scan_data) as PortfolioScanData)
    : null;

  // Trigger a fresh scan for this project in the background
  void Promise.resolve().then(() => {
    try {
      scanSingleProject(row.path);
    } catch { /* silent */ }
  });

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      id: row.id,
      name: row.name,
      path: row.path,
      type: row.type,
      typeLabel: row.type_label ?? row.type,
      status: row.status,
      registeredAt: row.registered_at,
      lastScannedAt: row.last_scanned_at,
      scanData,
    },
  });
}
