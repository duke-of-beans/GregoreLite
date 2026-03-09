/**
 * Portfolio API — Manual Rescan
 * Sprint 24.0 + Sprint 41.0
 *
 * POST /api/portfolio/scan — triggers immediate rescan.
 *   Body (optional): { projectId?: string }
 *   If projectId provided → single-project rescan; otherwise → all projects.
 */

import { safeHandler, successResponse, errorResponse } from '@/lib/api/utils';
import { scanAllProjects, scanSingleProject } from '@/lib/portfolio/scanner';
import { getDatabase } from '@/lib/kernl/database';

export const POST = safeHandler(async (request: Request) => {
  // Parse optional body
  let body: { projectId?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as { projectId?: string };
  } catch { /* body is optional */ }

  // Sprint 41.0 — single-project rescan path
  if (body.projectId) {
    const db = getDatabase();
    const row = db.prepare('SELECT path FROM portfolio_projects WHERE id = ?')
      .get(body.projectId) as { path: string } | undefined;
    if (!row) return errorResponse('Project not found', 404);
    try {
      const card = scanSingleProject(row.path);
      return successResponse({ scanned: 1, projects: card ? [card] : [] });
    } catch (err) {
      return errorResponse(`Scan failed: ${err instanceof Error ? err.message : String(err)}`, 500);
    }
  }

  // Default: scan all projects
  try {
    const cards = scanAllProjects();
    return successResponse({ scanned: cards.length, projects: cards });
  } catch (err) {
    return errorResponse(
      `Scan failed: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }
});
