/**
 * Portfolio Migration — Sprint 25.0
 *
 * Directory scanner for UNREGISTERED project folders, type inference from
 * file markers, parallel-copy migration with archive rename, and dependency
 * warning detection before a copy.
 *
 * Public API:
 *   scanDirectory(path)              — scan unknown dir → DirectoryScanResult
 *   inferProjectType(scan)           — detect type from markers → InferResult
 *   getDependencyWarnings(path)      — pre-migration checks → DependencyWarning[]
 *   migrateProject(src,dst,dna,id)   — copy + archive + write scaffold
 *   writeInPlaceDna(dir, dna)        — write DNA/STATUS/BACKLOG in-place (no copy)
 *
 * RULE: NEVER modifies original files.
 * Parallel copy + archive rename ONLY. All ops via Node.js fs (not Tauri).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { stringify as stringifyYaml } from 'yaml';
import { getDatabase } from '@/lib/kernl/database';
import type {
  ProjectType,
  DirectoryScanResult,
  InferResult,
  ProjectDnaYaml,
  MigrationResult,
  DependencyWarning,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.next', 'dist',
  'build', 'target', '.cache', 'coverage', '.turbo', 'out',
  '.output', 'vendor', '.venv', 'venv', 'env',
]);

const BUILD_MARKERS: Array<{ file: string; label: string; pattern?: boolean }> = [
  { file: 'package.json',     label: 'package.json' },
  { file: 'tsconfig.json',    label: 'tsconfig.json' },
  { file: 'Cargo.toml',       label: 'Cargo.toml' },
  { file: 'pyproject.toml',   label: 'pyproject.toml' },
  { file: 'setup.py',         label: 'setup.py' },
  { file: 'go.mod',           label: 'go.mod' },
  { file: 'Makefile',         label: 'Makefile' },
  { file: 'CMakeLists.txt',   label: 'CMakeLists.txt' },
  { file: 'Gemfile',          label: 'Gemfile' },
  { file: 'pom.xml',          label: 'pom.xml' },
  { file: 'build.gradle',     label: 'build.gradle' },
  { file: 'build.gradle.kts', label: 'build.gradle.kts' },
  { file: '.csproj',          label: '.csproj', pattern: true },
];

const DOC_PATTERNS = [
  'README.md', 'README.txt', 'README',
  'CHANGELOG.md', 'CHANGELOG.txt',
  'TODO.md', 'TODO.txt', 'TODO',
  'STATUS.md', 'STATUS.txt',
  'BACKLOG.md', 'FEATURE_BACKLOG.md', 'TASK_LIST.md',
  'NOTES.md', 'NOTES.txt',
];

const INTERESTING_DIRS = [
  'src', 'lib', 'docs', 'tests', 'test', 'data',
  'assets', 'public', 'static', 'scripts', 'tools',
  'config', 'examples', 'samples', 'notebooks',
];

const GIT_EXE = '"D:\\Program Files\\Git\\cmd\\git.exe"';
const LARGE_DIR_THRESHOLD_BYTES = 1_073_741_824; // 1 GB

const CONFIG_FILES_TO_SCAN = [
  'package.json', '.env', '.env.local', 'tsconfig.json',
  '.eslintrc.json', 'jest.config.js', 'jest.config.ts',
  'vite.config.ts', 'vite.config.js', 'webpack.config.js',
];

// ── Directory scanner ─────────────────────────────────────────────────────────

/**
 * Scan an unregistered directory and return a structured analysis.
 * Inaccessible subdirectories degrade gracefully — never throws.
 */
export function scanDirectory(dirPath: string): DirectoryScanResult {
  const buildSystem: string[] = [];
  const documentation: string[] = [];
  const structure: string[] = [];
  const fileDistribution: Record<string, number> = {};
  let totalFiles = 0;
  let totalSizeBytes = 0;

  // Root-level build markers
  for (const marker of BUILD_MARKERS) {
    try {
      if (marker.pattern) {
        const ext = marker.file; // e.g. ".csproj"
        const entries = fs.readdirSync(dirPath);
        if (entries.some((e) => e.endsWith(ext))) buildSystem.push(marker.label);
      } else {
        if (fs.existsSync(path.join(dirPath, marker.file))) buildSystem.push(marker.label);
      }
    } catch { /* ignore */ }
  }

  // Documentation files
  for (const doc of DOC_PATTERNS) {
    try {
      if (fs.existsSync(path.join(dirPath, doc))) documentation.push(doc);
    } catch { /* ignore */ }
  }

  // Interesting directory structure
  for (const dir of INTERESTING_DIRS) {
    try {
      const fullPath = path.join(dirPath, dir);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) structure.push(dir);
    } catch { /* ignore */ }
  }

  // Walk for file distribution + totals
  walkDirectory(dirPath, fileDistribution, (size) => {
    totalFiles++;
    totalSizeBytes += size;
  });

  // Existing DNA?
  const existingDna = (() => {
    try { return fs.existsSync(path.join(dirPath, 'PROJECT_DNA.yaml')); }
    catch { return false; }
  })();

  const versionControl = getVersionControl(dirPath);

  return {
    path: dirPath,
    buildSystem,
    versionControl,
    documentation,
    structure,
    fileDistribution,
    existingDna,
    totalFiles,
    totalSizeBytes,
  };
}

function walkDirectory(
  dir: string,
  dist: Record<string, number>,
  onFile: (size: number) => void,
): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkDirectory(path.join(dir, entry.name), dist, onFile);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase() || '(no ext)';
      dist[ext] = (dist[ext] ?? 0) + 1;
      try { onFile(fs.statSync(path.join(dir, entry.name)).size); }
      catch { onFile(0); }
    }
  }
}

function getVersionControl(dirPath: string): DirectoryScanResult['versionControl'] {
  const hasGit = (() => {
    try { return fs.existsSync(path.join(dirPath, '.git')); }
    catch { return false; }
  })();

  if (!hasGit) return { hasGit: false, lastCommitDate: null, lastCommitMessage: null, branch: null };

  try {
    const date    = execSync(`${GIT_EXE} -C "${dirPath}" log -1 --format=%cI`,  { timeout: 5000, encoding: 'utf8' }).trim() || null;
    const message = execSync(`${GIT_EXE} -C "${dirPath}" log -1 --format=%s`,   { timeout: 5000, encoding: 'utf8' }).trim() || null;
    const branch  = execSync(`${GIT_EXE} -C "${dirPath}" rev-parse --abbrev-ref HEAD`, { timeout: 5000, encoding: 'utf8' }).trim() || null;
    return { hasGit: true, lastCommitDate: date, lastCommitMessage: message, branch };
  } catch {
    return { hasGit: true, lastCommitDate: null, lastCommitMessage: null, branch: null };
  }
}

// ── Type inference ────────────────────────────────────────────────────────────

/** Infer project type from a DirectoryScanResult */
export function inferProjectType(scan: DirectoryScanResult): InferResult {
  const { buildSystem, fileDistribution } = scan;

  // High confidence: recognised build systems
  if (buildSystem.includes('package.json') || buildSystem.includes('tsconfig.json')) {
    return { type: 'code', confidence: 'high', reason: 'TypeScript/JavaScript project (package.json or tsconfig.json)' };
  }
  if (buildSystem.includes('Cargo.toml')) {
    return { type: 'code', confidence: 'high', reason: 'Rust project (Cargo.toml)' };
  }
  if (buildSystem.includes('pyproject.toml') || buildSystem.includes('setup.py')) {
    return { type: 'code', confidence: 'high', reason: 'Python project (pyproject.toml or setup.py)' };
  }
  if (buildSystem.includes('go.mod')) {
    return { type: 'code', confidence: 'high', reason: 'Go project (go.mod)' };
  }
  if (buildSystem.includes('pom.xml') || buildSystem.includes('build.gradle') || buildSystem.includes('build.gradle.kts')) {
    return { type: 'code', confidence: 'high', reason: 'Java/JVM project (Maven/Gradle)' };
  }
  if (buildSystem.includes('.csproj')) {
    return { type: 'code', confidence: 'high', reason: '.NET project (.csproj)' };
  }

  const total = Object.values(fileDistribution).reduce((a, b) => a + b, 0);
  if (total === 0) return { type: 'custom', confidence: 'low', reason: 'Empty or inaccessible directory' };

  const mdCount  = (fileDistribution['.md']  ?? 0) + (fileDistribution['.txt'] ?? 0);
  const pdfCount = fileDistribution['.pdf']  ?? 0;
  const docxCount = (fileDistribution['.docx'] ?? 0) + (fileDistribution['.doc']  ?? 0);
  const xlsxCount = (fileDistribution['.xlsx'] ?? 0) + (fileDistribution['.xls']  ?? 0);
  const imageCount = (fileDistribution['.png']  ?? 0) + (fileDistribution['.jpg']  ?? 0)
                   + (fileDistribution['.jpeg'] ?? 0) + (fileDistribution['.svg']  ?? 0)
                   + (fileDistribution['.gif']  ?? 0) + (fileDistribution['.webp'] ?? 0);
  const videoCount = (fileDistribution['.mp4'] ?? 0) + (fileDistribution['.mov'] ?? 0)
                   + (fileDistribution['.avi'] ?? 0);
  const audioCount = (fileDistribution['.mp3'] ?? 0) + (fileDistribution['.wav'] ?? 0)
                   + (fileDistribution['.flac'] ?? 0);

  // Research: document-heavy, no build system
  const docRatio = (mdCount + pdfCount) / total;
  if (docRatio > 0.5 && buildSystem.length === 0) {
    return {
      type: 'research', confidence: 'medium',
      reason: `Document-heavy (${Math.round(docRatio * 100)}% markdown/PDF, no build system)`,
    };
  }

  // Business: office documents dominant
  const officeRatio = (docxCount + xlsxCount) / total;
  if (officeRatio > 0.3) {
    return {
      type: 'business', confidence: 'medium',
      reason: `Office documents dominant (${docxCount} Word, ${xlsxCount} Excel)`,
    };
  }

  // Creative: media files dominant
  const mediaRatio = (imageCount + videoCount + audioCount) / total;
  if (mediaRatio > 0.4) {
    return {
      type: 'creative', confidence: 'medium',
      reason: `Media-heavy (${Math.round(mediaRatio * 100)}% images/video/audio)`,
    };
  }

  // Also check: Makefile or CMakeLists (hardware/systems)
  if (buildSystem.includes('Makefile') || buildSystem.includes('CMakeLists.txt')) {
    return { type: 'code', confidence: 'medium', reason: 'Build system detected (Makefile / CMakeLists.txt)' };
  }

  // Low confidence fallback
  const topExt = Object.entries(fileDistribution)
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([ext, count]) => `${ext}(${count})`).join(', ');
  return {
    type: 'custom', confidence: 'low',
    reason: `Mixed or unclear. Top extensions: ${topExt || 'none'}`,
  };
}

// ── Dependency warnings ───────────────────────────────────────────────────────

/** Pre-migration checks: symlinks, absolute path refs, large dirs */
export function getDependencyWarnings(sourcePath: string): DependencyWarning[] {
  const warnings: DependencyWarning[] = [];

  // Large directory
  let totalSize = 0;
  try {
    walkDirectory(sourcePath, {}, (size) => { totalSize += size; });
    if (totalSize > LARGE_DIR_THRESHOLD_BYTES) {
      warnings.push({
        type: 'large-directory', path: sourcePath,
        detail: `Directory is ${(totalSize / 1_073_741_824).toFixed(1)} GB — copy may take a while`,
      });
    }
  } catch { /* ignore */ }

  // Symlinks
  const symlinks = findSymlinks(sourcePath);
  for (const sl of symlinks.slice(0, 5)) { // Report first 5 only
    warnings.push({ type: 'symlink', path: sl, detail: 'Symlink may break if target is outside the directory' });
  }

  // Absolute path references in config files
  const absPathCount = countAbsolutePaths(sourcePath);
  if (absPathCount > 0) {
    warnings.push({
      type: 'absolute-path', path: sourcePath, count: absPathCount,
      detail: `${absPathCount} absolute path reference${absPathCount > 1 ? 's' : ''} in config files — may need updating after migration`,
    });
  }

  return warnings;
}

function findSymlinks(dir: string, found: string[] = []): string[] {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return found; }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) found.push(path.join(dir, entry.name));
    else if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) findSymlinks(path.join(dir, entry.name), found);
  }
  return found;
}

function countAbsolutePaths(dir: string): number {
  let count = 0;
  for (const file of CONFIG_FILES_TO_SCAN) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      const matches = content.match(/['"]((?:[A-Za-z]:\\|\/(?!\/|tmp|var|usr))[^'"]{10,})['"]/g) ?? [];
      count += matches.length;
    } catch { /* file not present */ }
  }
  return count;
}

// ── Migration: parallel copy + archive ───────────────────────────────────────

/**
 * Copy sourcePath → destPath, write scaffold files, rename original to archive.
 * NEVER modifies sourcePath content. Only renames the directory after copy succeeds.
 */
export function migrateProject(
  sourcePath: string,
  destPath: string,
  dna: ProjectDnaYaml,
  projectId: string,
): MigrationResult {
  if (!fs.existsSync(sourcePath)) {
    return { success: false, error: `Source does not exist: ${sourcePath}` };
  }
  if (fs.existsSync(destPath)) {
    return { success: false, error: `Destination already exists: ${destPath}` };
  }

  // Copy source → dest
  try {
    fs.cpSync(sourcePath, destPath, { recursive: true, errorOnExist: true });
  } catch (err) {
    return { success: false, error: `Copy failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Write scaffold files into copy
  try {
    fs.writeFileSync(path.join(destPath, 'PROJECT_DNA.yaml'), buildDnaYamlString(dna), 'utf8');
    if (!fs.existsSync(path.join(destPath, 'STATUS.md'))) {
      fs.writeFileSync(path.join(destPath, 'STATUS.md'), buildInitialStatus(dna), 'utf8');
    }
    const backlogFile = dna.type === 'research' ? 'TASK_LIST.md' : 'FEATURE_BACKLOG.md';
    if (!fs.existsSync(path.join(destPath, backlogFile))) {
      fs.writeFileSync(path.join(destPath, backlogFile), buildInitialBacklog(dna), 'utf8');
    }
  } catch (err) {
    console.warn('[portfolio/migrate] Could not write scaffold files:', err);
  }

  // Archive original (rename only — no delete)
  const dateStr = new Date().toISOString().slice(0, 10);
  const archivePath = `${sourcePath}_ARCHIVED_${dateStr}`;
  try {
    fs.renameSync(sourcePath, archivePath);
  } catch (err) {
    return {
      success: false,
      error: `Copy succeeded but archive rename failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Record archive in DB
  try {
    const db = getDatabase();
    const archiveId = `archive_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`
      INSERT INTO portfolio_archives (id, project_id, original_path, archive_path, archived_at, verified_by_user)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(archiveId, projectId, sourcePath, archivePath, Date.now());
  } catch (err) {
    console.warn('[portfolio/migrate] Could not record archive:', err);
  }

  return { success: true, archivePath, newPath: destPath };
}

/** Write DNA/STATUS/BACKLOG into an existing directory (in-place option) */
export function writeInPlaceDna(dirPath: string, dna: ProjectDnaYaml): void {
  fs.writeFileSync(path.join(dirPath, 'PROJECT_DNA.yaml'), buildDnaYamlString(dna), 'utf8');
  if (!fs.existsSync(path.join(dirPath, 'STATUS.md'))) {
    fs.writeFileSync(path.join(dirPath, 'STATUS.md'), buildInitialStatus(dna), 'utf8');
  }
  const backlogFile = dna.type === 'research' ? 'TASK_LIST.md' : 'FEATURE_BACKLOG.md';
  if (!fs.existsSync(path.join(dirPath, backlogFile))) {
    fs.writeFileSync(path.join(dirPath, backlogFile), buildInitialBacklog(dna), 'utf8');
  }
}

// ── Scaffold builders ─────────────────────────────────────────────────────────

function buildDnaYamlString(dna: ProjectDnaYaml): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const obj: Record<string, unknown> = {
    identity: dna.identity,
    type: dna.type,
    ...(dna.type_label ? { type_label: dna.type_label } : {}),
    current_state: dna.current_state,
    metrics: dna.metrics,
    documents: dna.documents,
  };
  return `# PROJECT_DNA.yaml\n# Generated by GregLite onboarding — ${dateStr}\n\n${stringifyYaml(obj)}`;
}

function buildInitialStatus(dna: ProjectDnaYaml): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return [
    `# STATUS.md`,
    `# ${dna.identity.name}`,
    `# Registered: ${dateStr}`,
    ``,
    `## Current Phase`,
    `${dna.current_state.phase}`,
    ``,
    `## Status`,
    `${dna.current_state.status}`,
    ``,
    `## Next`,
    `TBD`,
    ``,
  ].join('\n');
}

function buildInitialBacklog(dna: ProjectDnaYaml): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const title = dna.type === 'research' ? 'TASK LIST' : 'FEATURE BACKLOG';
  return [
    `# ${title}`,
    `# ${dna.identity.name}`,
    `# Created: ${dateStr}`,
    ``,
    `## Priority 1 — Immediate`,
    ``,
    `## Priority 2 — Near Term`,
    ``,
    `## Backlog`,
    ``,
  ].join('\n');
}

// ── Re-export types for convenience ──────────────────────────────────────────
export type {
  DirectoryScanResult,
  InferResult,
  ProjectDnaYaml,
  MigrationResult,
  DependencyWarning,
  ProjectType,
};
