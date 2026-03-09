/**
 * Portfolio Scanner — Sprint 24.0
 *
 * Reads registered project DNA/STATUS files from disk and writes results to
 * the SQLite portfolio_projects table. Runs server-side (Node.js API route
 * context) — uses fs.readFileSync and child_process.execSync only.
 *
 * Do NOT import Tauri commands here.
 *
 * Public API:
 *   scanAllProjects()         — scan all non-archived projects, return ProjectCard[]
 *   scanSingleProject(path)   — scan one project, return ProjectCard | null
 *   startPortfolioScanner()   — start 30s background loop
 *   stopPortfolioScanner()    — stop the loop
 *   seedFromWorkspaces()      — seed portfolio_projects from WORKSPACES.yaml (once)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parse as parseYaml } from 'yaml';
import { getDatabase } from '@/lib/kernl/database';
import type {
  ProjectCard,
  ProjectType,
  ProjectHealth,
  ProjectStatus,
  ScanResult,
  PortfolioScanData,
  PortfolioProject,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKSPACES_PATH = 'D:\\Dev\\WORKSPACES.yaml';
const SCAN_INTERVAL_MS = 30_000;
const STATUS_EXCERPT_LINES = 20;
const HEALTH_GREEN_DAYS = 7;
const HEALTH_AMBER_DAYS = 14;

/** Projects to always register regardless of WORKSPACES.yaml */
const ALWAYS_REGISTER: Array<{ id: string; name: string; path: string; type: ProjectType }> = [
  { id: 'greglite',     name: 'GregLite',      path: 'D:\\Projects\\GregLite', type: 'code' },
  { id: 'ghm-dashboard', name: 'GHM Dashboard', path: 'D:\\Work\\SEO-Services\\ghm-dashboard', type: 'business' },
];

// ── Background scanner state ──────────────────────────────────────────────────

let _scanInterval: ReturnType<typeof setInterval> | null = null;

// ── Workspace YAML shape (partial) ────────────────────────────────────────────

interface WorkspaceEntry {
  name: string;
  path: string;
  type: string;
  status: string;
  description?: string;
}

interface WorkspacesFile {
  workspaces?: Record<string, WorkspaceEntry>;
}

// ── YAML loader ───────────────────────────────────────────────────────────────

function loadWorkspacesYaml(): WorkspacesFile {
  try {
    const raw = fs.readFileSync(WORKSPACES_PATH, 'utf8');
    return parseYaml(raw) as WorkspacesFile;
  } catch {
    return {};
  }
}

// ── File helpers ──────────────────────────────────────────────────────────────

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function parseYamlSafe(raw: string): Record<string, unknown> | null {
  try {
    return parseYaml(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Git helpers (sync, wrapped in try/catch — never crashes) ──────────────────

function getLastCommit(projectPath: string): { date: string | null; message: string | null; branch: string | null } {
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return { date: null, message: null, branch: null };
  }
  try {
    const date = execSync(
      `"D:\\Program Files\\Git\\cmd\\git.exe" -C "${projectPath}" log -1 --format=%cI`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();
    const message = execSync(
      `"D:\\Program Files\\Git\\cmd\\git.exe" -C "${projectPath}" log -1 --format=%s`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();
    const branch = execSync(
      `"D:\\Program Files\\Git\\cmd\\git.exe" -C "${projectPath}" rev-parse --abbrev-ref HEAD`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();
    return {
      date: date || null,
      message: message || null,
      branch: branch || null,
    };
  } catch {
    return { date: null, message: null, branch: null };
  }
}

// ── Type detection ────────────────────────────────────────────────────────────

function detectProjectType(
  projectPath: string,
  dna: Record<string, unknown> | null,
  workspaceType: string | null
): ProjectType {
  // DNA takes precedence
  if (dna && typeof dna['type'] === 'string') {
    const t = (dna['type'] as string).toLowerCase();
    if (t === 'code' || t === 'research' || t === 'business' || t === 'creative') {
      return t as ProjectType;
    }
  }
  // Workspace registry type hints
  if (workspaceType) {
    if (workspaceType === 'infrastructure' || workspaceType === 'product') return 'code';
  }
  // Filesystem markers
  if (fs.existsSync(path.join(projectPath, 'package.json'))) return 'code';
  if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) return 'code';
  if (fs.existsSync(path.join(projectPath, 'pyproject.toml'))) return 'code';
  if (fs.existsSync(path.join(projectPath, 'go.mod'))) return 'code';
  return 'custom';
}

// ── STATUS.md extraction ──────────────────────────────────────────────────────

function extractFromStatus(statusText: string | null): {
  version: string | null;
  phase: string | null;
  testCount: number | null;
  testPassing: number | null;
  tscErrors: number | null;
  nextAction: string | null;
  blockers: string[];
} {
  if (!statusText) {
    return { version: null, phase: null, testCount: null, testPassing: null, tscErrors: null, nextAction: null, blockers: [] };
  }

  const lines = statusText.split('\n');
  let version: string | null = null;
  let phase: string | null = null;
  let testCount: number | null = null;
  let testPassing: number | null = null;
  let tscErrors: number | null = null;
  let nextAction: string | null = null;
  const blockers: string[] = [];

  for (const line of lines) {
    const l = line.trim();

    // Version: "Version: 1.1.0" or "v1.1.0"
    if (!version) {
      const vMatch = l.match(/[Vv]ersion[:\s]+v?([\d]+\.[\d]+\.[\d]+)/)
                  ?? l.match(/\bv([\d]+\.[\d]+\.[\d]+)\b/);
      if (vMatch) version = vMatch[1] ?? null;
    }

    // Phase: "Phase:" or "## Current Phase"
    if (!phase) {
      const pMatch = l.match(/^#+\s*(?:Current\s+)?Phase[:\s]+(.+)$/i) ??
                     l.match(/^Phase[:\s]+(.+)$/i);
      if (pMatch) phase = (pMatch[1] ?? '').trim().slice(0, 120) || null;
    }

    // Test count: "1344 tests" or "Tests: 1344 passing"
    if (!testCount) {
      const tMatch = l.match(/(\d+)\s+tests?\s+passing/i) ??
                     l.match(/Tests[:\s]+(\d+)\s+passing/i) ??
                     l.match(/(\d+)\s+tests\b/i);
      if (tMatch) {
        testCount = parseInt(tMatch[1] ?? '0', 10);
        testPassing = testCount; // Assume all passing unless separate line found
      }
    }

    // TSC errors: "tsc: 0 errors" or "0 errors (0 warnings)"
    if (tscErrors === null) {
      const eMatch = l.match(/tsc[:\s]+(\d+)\s+errors?/i) ??
                     l.match(/(\d+)\s+errors?\s*\(/i);
      if (eMatch) tscErrors = parseInt(eMatch[1] ?? '0', 10);
    }

    // Next action: "Next:" line or "Next Sprint:" or "## Next"
    if (!nextAction) {
      const nMatch = l.match(/^#+\s*Next[:\s]+(.+)$/i) ??
                     l.match(/^Next(?:\s+Sprint)?[:\s]+(.+)$/i) ??
                     l.match(/^→\s*(.+)$/);
      if (nMatch) nextAction = (nMatch[1] ?? '').trim().slice(0, 160) || null;
    }

    // Blockers: "BLOCKED" in line
    if (l.toUpperCase().includes('BLOCKED') && l.length < 200) {
      blockers.push(l.slice(0, 120));
    }
  }

  return { version, phase, testCount, testPassing, tscErrors, nextAction, blockers };
}

// ── Health calculation ────────────────────────────────────────────────────────

function calculateHealth(
  lastActivity: string | null,
  blockers: string[],
  tscErrors: number | null,
  testCount: number | null,
  testPassing: number | null
): { health: ProjectHealth; healthReason: string } {
  const now = Date.now();

  if (blockers.length > 0) {
    return { health: 'red', healthReason: `${blockers.length} blocker${blockers.length > 1 ? 's' : ''} recorded` };
  }

  if (tscErrors !== null && tscErrors > 0) {
    return { health: 'red', healthReason: `${tscErrors} TypeScript error${tscErrors > 1 ? 's' : ''}` };
  }

  if (testCount !== null && testPassing !== null && testPassing < testCount) {
    const failing = testCount - testPassing;
    return { health: 'red', healthReason: `${failing} test${failing > 1 ? 's' : ''} failing` };
  }

  if (!lastActivity) {
    return { health: 'amber', healthReason: 'No activity data' };
  }

  const lastMs = new Date(lastActivity).getTime();
  if (isNaN(lastMs)) {
    return { health: 'amber', healthReason: 'No activity data' };
  }

  const daysSince = (now - lastMs) / (1000 * 60 * 60 * 24);

  if (daysSince < HEALTH_GREEN_DAYS) {
    const hoursAgo = Math.round((now - lastMs) / (1000 * 60 * 60));
    const label = hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.round(daysSince)} days ago`;
    return { health: 'green', healthReason: `Active — last activity ${label}` };
  }

  if (daysSince < HEALTH_AMBER_DAYS) {
    return { health: 'amber', healthReason: `${Math.round(daysSince)} days since last activity` };
  }

  return { health: 'red', healthReason: `Stale — no activity in ${Math.round(daysSince)} days` };
}

// ── Type label ────────────────────────────────────────────────────────────────

function getTypeLabel(type: ProjectType, dna: Record<string, unknown> | null): string {
  if (type === 'custom' && dna && typeof dna['type_label'] === 'string') {
    return dna['type_label'] as string;
  }
  const labels: Record<ProjectType, string> = {
    code: 'Code',
    research: 'Research',
    business: 'Business',
    creative: 'Creative',
    custom: 'Custom',
  };
  return labels[type];
}

// ── Core scan logic for a single path ────────────────────────────────────────

function scanPath(
  projectPath: string,
  workspaceType: string | null = null
): ScanResult {
  const warnings: string[] = [];
  const scannedAt = new Date().toISOString();

  // Accessibility check
  if (!fs.existsSync(projectPath)) {
    return {
      path: projectPath,
      accessible: false,
      dna: null,
      statusExcerpt: null,
      statusFull: null,
      lastCommit: null,
      lastCommitMessage: null,
      gitBranch: null,
      hasGit: false,
      hasPackageJson: false,
      detectedType: 'custom',
      scannedAt,
      warnings: ['Path does not exist'],
    };
  }

  // DNA
  const dnaPath = path.join(projectPath, 'PROJECT_DNA.yaml');
  const dnaRaw = readFileSafe(dnaPath);
  const dna = dnaRaw ? parseYamlSafe(dnaRaw) : null;
  if (!dnaRaw) warnings.push('No PROJECT_DNA.yaml');

  // STATUS.md
  const statusPath = path.join(projectPath, 'STATUS.md');
  const statusFull = readFileSafe(statusPath);
  const statusExcerpt = statusFull
    ? statusFull.split('\n').slice(0, STATUS_EXCERPT_LINES).join('\n')
    : null;
  if (!statusFull) warnings.push('No STATUS.md');

  const hasGit = fs.existsSync(path.join(projectPath, '.git'));
  const hasPackageJson = fs.existsSync(path.join(projectPath, 'package.json'));
  const detectedType = detectProjectType(projectPath, dna, workspaceType);

  return {
    path: projectPath,
    accessible: true,
    dna,
    statusExcerpt,
    statusFull,
    lastCommit: null, // Filled by async git pass
    lastCommitMessage: null,
    gitBranch: null,
    hasGit,
    hasPackageJson,
    detectedType,
    scannedAt,
    warnings,
  };
}

// ── Build ProjectCard from ScanResult ────────────────────────────────────────

function buildProjectCard(
  id: string,
  name: string,
  scan: ScanResult,
  registryType: ProjectType | null = null,
  registryStatus: ProjectStatus = 'active'
): ProjectCard {
  const type = registryType ?? scan.detectedType;
  const dna = scan.dna;
  const typeLabel = getTypeLabel(type, dna);

  // Extract version/phase/test data from STATUS.md
  const statusData = extractFromStatus(scan.statusFull ?? scan.statusExcerpt);

  // Fall back to DNA for version/phase if STATUS didn't have them
  const version = statusData.version
    ?? (dna && typeof dna['version'] === 'string' ? dna['version'] as string : null)
    ?? (dna?.current_state && typeof (dna.current_state as Record<string, unknown>)['version'] === 'string'
        ? (dna.current_state as Record<string, unknown>)['version'] as string
        : null);

  const phase = statusData.phase
    ?? (dna?.current_state && typeof (dna.current_state as Record<string, unknown>)['phase'] === 'string'
        ? ((dna.current_state as Record<string, unknown>)['phase'] as string).slice(0, 120)
        : null);

  // Last activity: prefer git commit, fall back to STATUS modification time
  const lastActivity = scan.lastCommit ?? (() => {
    try {
      const statusPath = path.join(scan.path, 'STATUS.md');
      if (fs.existsSync(statusPath)) {
        return fs.statSync(statusPath).mtime.toISOString();
      }
    } catch { /* ignore */ }
    return null;
  })();

  const { health, healthReason } = calculateHealth(
    lastActivity,
    statusData.blockers,
    statusData.tscErrors,
    statusData.testCount,
    statusData.testPassing
  );

  const card: ProjectCard = {
    id,
    name,
    path: scan.path,
    type,
    typeLabel,
    status: registryStatus,
    version,
    phase,
    lastActivity,
    health,
    healthReason,
    nextAction: statusData.nextAction,
    customMetrics: {},
  };

  if (statusData.testCount !== null) card.testCount = statusData.testCount;
  if (statusData.testPassing !== null) card.testPassing = statusData.testPassing;
  if (statusData.tscErrors !== null) card.tscErrors = statusData.tscErrors;

  return card;
}

// ── SQLite persistence ────────────────────────────────────────────────────────

function persistScanData(id: string, card: ProjectCard, scan: ScanResult): void {
  const db = getDatabase();
  const scanData: PortfolioScanData = {
    version: card.version,
    phase: card.phase,
    lastCommit: scan.lastCommit,
    lastCommitMessage: scan.lastCommitMessage,
    branch: scan.gitBranch,
    testCount: card.testCount ?? null,
    testPassing: card.testPassing ?? null,
    tscErrors: card.tscErrors ?? null,
    nextAction: card.nextAction,
    blockers: [], // Extracted in calculateHealth; not stored separately for now
    health: card.health,
    healthReason: card.healthReason,
    customMetrics: card.customMetrics,
    statusExcerpt: scan.statusExcerpt,
    statusFull: scan.statusFull,
    warnings: scan.warnings,
    scannedAt: scan.scannedAt,
  };

  db.prepare(`
    UPDATE portfolio_projects
    SET last_scanned_at = ?, scan_data = ?
    WHERE id = ?
  `).run(Date.now(), JSON.stringify(scanData), id);
}

// ── Public: scan a single project by path ────────────────────────────────────

export function scanSingleProject(projectPath: string): ProjectCard | null {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT id, name, type, status FROM portfolio_projects WHERE path = ?'
  ).get(projectPath) as { id: string; name: string; type: ProjectType; status: ProjectStatus } | undefined;

  if (!row) return null;

  const scan = scanPath(projectPath);

  // Sync git data (blocking on single project — acceptable)
  if (scan.hasGit) {
    const git = getLastCommit(projectPath);
    scan.lastCommit = git.date;
    scan.lastCommitMessage = git.message;
    scan.gitBranch = git.branch;
  }

  const card = buildProjectCard(row.id, row.name, scan, row.type, row.status);
  persistScanData(row.id, card, scan);
  return card;
}

// ── Public: scan all non-archived projects ────────────────────────────────────

export function scanAllProjects(): ProjectCard[] {
  const db = getDatabase();
  // Sprint 41.0 — exclude paths in portfolio_exclusions
  const rows = db.prepare(`
    SELECT p.id, p.name, p.path, p.type, p.status
    FROM portfolio_projects p
    WHERE p.status != 'archived'
      AND NOT EXISTS (
        SELECT 1 FROM portfolio_exclusions e WHERE lower(e.path) = lower(p.path)
      )
  `).all() as Array<{ id: string; name: string; path: string; type: ProjectType; status: ProjectStatus }>;

  const cards: ProjectCard[] = [];

  for (const row of rows) {
    try {
      const scan = scanPath(row.path);
      const card = buildProjectCard(row.id, row.name, scan, row.type, row.status);
      cards.push(card);

      // Fire-and-forget git data then re-persist (non-blocking for callers)
      void Promise.resolve().then(() => {
        if (scan.hasGit) {
          const git = getLastCommit(row.path);
          scan.lastCommit = git.date;
          scan.lastCommitMessage = git.message;
          scan.gitBranch = git.branch;

          // Recompute last activity with git date
          const lastActivity = git.date ?? card.lastActivity;
          const { health, healthReason } = calculateHealth(
            lastActivity,
            [],
            card.tscErrors ?? null,
            card.testCount ?? null,
            card.testPassing ?? null
          );
          card.lastActivity = lastActivity;
          card.health = health;
          card.healthReason = healthReason;
        }
        persistScanData(row.id, card, scan);
      });
    } catch (err) {
      console.error(`[portfolio/scanner] Failed to scan ${row.path}:`, err);
    }
  }

  return cards;
}

// ── Public: seed from WORKSPACES.yaml (idempotent — INSERT OR IGNORE) ─────────

export function seedFromWorkspaces(): void {
  const db = getDatabase();
  const file = loadWorkspacesYaml();
  const workspaces = file.workspaces ?? {};

  const insert = db.prepare(`
    INSERT OR IGNORE INTO portfolio_projects (id, name, path, type, status, registered_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Sprint 41.0 — existence + exclusion pre-checks
  const checkExists   = db.prepare(`SELECT id FROM portfolio_projects WHERE lower(path) = lower(?)`);
  let checkExcluded: ReturnType<typeof db.prepare> | null = null;
  try {
    checkExcluded = db.prepare(`SELECT 1 FROM portfolio_exclusions WHERE lower(path) = lower(?)`);
  } catch { /* table may not exist on first boot — safe to skip */ }

  // Normalize path: forward→backslash, strip trailing slashes
  function normalizePath(p: string): string {
    return p.replace(/\//g, '\\').replace(/[\\/]+$/, '');
  }

  // Map WORKSPACES.yaml status to portfolio status
  function mapStatus(wsStatus: string): ProjectStatus {
    if (wsStatus === 'archived') return 'archived';
    if (wsStatus === 'shelved') return 'paused';
    return 'active';
  }

  // Map workspace type to ProjectType
  function mapType(wsType: string): ProjectType {
    if (wsType === 'infrastructure' || wsType === 'product') return 'code';
    return 'custom';
  }

  const now = Date.now();

  for (const [key, ws] of Object.entries(workspaces)) {
    if (ws.status === 'archived') continue; // Skip archived from WORKSPACES.yaml
    try {
      const normalizedPath = normalizePath(ws.path);
      // Sprint 41.0 — skip excluded paths
      if (checkExcluded?.get(normalizedPath)) continue;
      // Sprint 41.0 — skip paths already registered (case-insensitive)
      if (checkExists.get(normalizedPath)) continue;
      insert.run(key, ws.name, normalizedPath, mapType(ws.type), mapStatus(ws.status), now);
    } catch (err) {
      console.warn(`[portfolio/scanner] Failed to seed workspace ${key}:`, err);
    }
  }

  // Always register the explicit projects
  for (const p of ALWAYS_REGISTER) {
    try {
      const normalizedPath = normalizePath(p.path);
      // Sprint 41.0 — skip excluded / already-registered
      if (checkExcluded?.get(normalizedPath)) continue;
      if (checkExists.get(normalizedPath)) continue;
      insert.run(p.id, p.name, normalizedPath, p.type, 'active', now);
    } catch (err) {
      console.warn(`[portfolio/scanner] Failed to seed always-register ${p.id}:`, err);
    }
  }
}

// ── Public: background scanner loop ──────────────────────────────────────────

export function startPortfolioScanner(): void {
  if (_scanInterval) return; // Already running — idempotent

  // Seed on first run if table is empty
  try {
    const db = getDatabase();
    const count = (db.prepare('SELECT COUNT(*) as c FROM portfolio_projects').get() as { c: number }).c;
    if (count === 0) {
      seedFromWorkspaces();
    }
  } catch (err) {
    console.error('[portfolio/scanner] Seed check failed:', err);
  }

  // Initial scan immediately (non-blocking)
  void Promise.resolve().then(() => { scanAllProjects(); });

  _scanInterval = setInterval(() => {
    try {
      scanAllProjects();
    } catch (err) {
      console.error('[portfolio/scanner] Background scan error:', err);
    }
  }, SCAN_INTERVAL_MS);

  console.log('[portfolio/scanner] Background scanner started (30s interval)');
}

export function stopPortfolioScanner(): void {
  if (_scanInterval) {
    clearInterval(_scanInterval);
    _scanInterval = null;
    console.log('[portfolio/scanner] Background scanner stopped');
  }
}

// ── Re-export types for convenience ──────────────────────────────────────────

export type { ProjectCard, ProjectType, ProjectHealth, ProjectStatus, PortfolioProject, PortfolioScanData };
