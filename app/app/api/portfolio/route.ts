/**
 * Portfolio API — Sprint 24.0
 *
 * GET  /api/portfolio — returns all projects from SQLite cache.
 *   Triggers a lazy rescan if last_scanned_at is older than 60 seconds.
 * POST /api/portfolio — register a new project by path (simplified Sprint 24 version).
 */

import { safeHandler, successResponse, errorResponse } from '@/lib/api/utils';
import { getDatabase } from '@/lib/kernl/database';
import { scanSingleProject, seedFromWorkspaces } from '@/lib/portfolio/scanner';
import type { PortfolioProject, PortfolioScanData, ProjectCard, ProjectType, ProjectStatus } from '@/lib/portfolio/types';

const LAZY_RESCAN_THRESHOLD_MS = 60_000; // 60 seconds

function rowToCard(row: PortfolioProject): ProjectCard {
  const scanData: PortfolioScanData | null = row.scan_data
    ? (JSON.parse(row.scan_data) as PortfolioScanData)
    : null;

  const card: ProjectCard = {
    id: row.id,
    name: row.name,
    path: row.path,
    type: row.type,
    typeLabel: row.type_label ?? typeLabel(row.type),
    status: row.status,
    version: scanData?.version ?? null,
    phase: scanData?.phase ?? null,
    lastActivity: scanData?.lastCommit ?? null,
    health: scanData?.health ?? 'amber',
    healthReason: scanData?.healthReason ?? 'Not yet scanned',
    nextAction: scanData?.nextAction ?? null,
    customMetrics: scanData?.customMetrics ?? {},
  };

  // Only set optional numeric fields when they have actual values (exactOptionalPropertyTypes)
  if (scanData?.testCount != null) card.testCount = scanData.testCount;
  if (scanData?.testPassing != null) card.testPassing = scanData.testPassing;
  if (scanData?.tscErrors != null) card.tscErrors = scanData.tscErrors;

  return card;
}

function typeLabel(type: ProjectType): string {
  const labels: Record<ProjectType, string> = {
    code: 'Code', research: 'Research', business: 'Business',
    creative: 'Creative', custom: 'Custom',
  };
  return labels[type];
}

export const GET = safeHandler(async (_req: Request) => {
  const db = getDatabase();
  const now = Date.now();

  // Lazy rescan: if any non-archived project hasn't been scanned recently, trigger
  const stalest = db.prepare(`
    SELECT id, path FROM portfolio_projects
    WHERE status != 'archived'
      AND (last_scanned_at IS NULL OR last_scanned_at < ?)
    LIMIT 1
  `).get(now - LAZY_RESCAN_THRESHOLD_MS) as { id: string; path: string } | undefined;

  if (stalest) {
    // Non-blocking background rescan
    void Promise.resolve().then(() => {
      try {
        const { scanAllProjects } = require('@/lib/portfolio/scanner') as typeof import('@/lib/portfolio/scanner');
        scanAllProjects();
      } catch { /* silent */ }
    });
  }

  const rows = db.prepare(`
    SELECT id, name, path, type, type_label, status, registered_at, last_scanned_at, scan_data
    FROM portfolio_projects
    ORDER BY status ASC, name ASC
  `).all() as PortfolioProject[];

  const projects = rows.map(rowToCard);

  return successResponse({ projects, total: projects.length });
});

export const POST = safeHandler(async (req: Request) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { path: projectPath, name, type } = body as {
    path?: string;
    name?: string;
    type?: ProjectType;
  };

  if (!projectPath || typeof projectPath !== 'string') {
    return errorResponse('path is required', 400);
  }

  const db = getDatabase();

  // Ensure seeded before registering
  const count = (db.prepare('SELECT COUNT(*) as c FROM portfolio_projects').get() as { c: number }).c;
  if (count === 0) seedFromWorkspaces();

  // Generate a stable ID from path
  const id = projectPath
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 64);

  // Derive name: last path segment if not provided
  const derivedName = name ?? projectPath.split(/[\\/]/).filter(Boolean).pop() ?? 'Unnamed Project';
  const projectType: ProjectType = type ?? 'custom';
  const status: ProjectStatus = 'active';

  db.prepare(`
    INSERT OR IGNORE INTO portfolio_projects (id, name, path, type, status, registered_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, derivedName, projectPath, projectType, status, Date.now());

  // Scan immediately
  const card = scanSingleProject(projectPath);

  return successResponse({ id, card }, 201);
});
